import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseText,
  detect,
  findLiteral,
  applyDecisions,
  canRelease,
  buildDocx,
  readZip,
  writeZip,
  LIMITS,
} from "../js/redactor/core.mjs";
const review = {
  caseRef: "TEST",
  reviewer: "Reviewer A",
  checker: "Checker B",
  complete: true,
  output: true,
  authorised: true,
};
test("normalisation rejects control characters and oversized input", () => {
  assert.equal(normaliseText("a\r\nb"), "a\nb");
  assert.throws(() => normaliseText("a\u0000b"));
  assert.throws(() => normaliseText("x".repeat(LIMITS.text + 1)));
});
test("suggestions find UK identifiers and remain pending", () => {
  const d = detect(
    "test@example.org, RG1 2AB, 07700 900123, +44 7700 900123, QQ 12 34 56 C, AB 12 34 56 C",
  );
  assert.deepEqual(
    d.map((x) => x.type),
    [
      "Email",
      "UK postcode",
      "Telephone",
      "Telephone",
      "National Insurance number",
    ],
  );
  assert(d.every((x) => x.status === "pending"));
});
test("literal phrase search handles punctuation and Unicode offsets", () => {
  assert.deepEqual(findLiteral("🙂 A+B a+b", "A+B"), [
    { start: 3, end: 6 },
    { start: 7, end: 10 },
  ]);
});
test("only approved spans are replaced and overlap fails closed", () => {
  const text = "One Secret Two",
    d = [{ id: "R1", start: 4, end: 10, status: "redact", reason: "Test" }];
  assert.equal(applyDecisions(text, d), "One [REDACTED R1] Two");
  assert.throws(() =>
    applyDecisions(text, [
      ...d,
      { id: "R2", start: 5, end: 8, status: "keep" },
    ]),
  );
  assert.throws(() =>
    applyDecisions(text, [{ start: -1, end: 2, status: "redact" }]),
  );
});
test("release rejects pending decisions, blank reasons and identical checker", () => {
  const d = { id: "R1", start: 0, end: 3, status: "pending", reason: "Test" };
  assert.equal(canRelease("abc", [d], review), false);
  assert.equal(
    canRelease("abc", [{ ...d, status: "redact", reason: "" }], review),
    false,
  );
  assert.equal(
    canRelease("abc", [{ ...d, status: "redact" }], {
      ...review,
      checker: " reviewer a ",
    }),
    false,
  );
  assert.equal(canRelease("abc", [{ ...d, status: "redact" }], review), true);
});
test("fresh Word package contains only three allowlisted entries and escapes text", async () => {
  const files = await readZip(buildDocx("Public & <text>\n[REDACTED R1]"));
  assert.deepEqual(
    [...files.keys()],
    ["[Content_Types].xml", "_rels/.rels", "word/document.xml"],
  );
  const xml = new TextDecoder().decode(files.get("word/document.xml"));
  assert(xml.includes("Public &amp; &lt;text&gt;"));
  assert(!xml.includes("Secret"));
});
test("ZIP rejects corruption, unsafe paths and size limits", async () => {
  const zip = writeZip(new Map([["test", "abcd"]]));
  const corrupt = zip.slice();
  corrupt[34] ^= 1;
  await assert.rejects(() => readZip(corrupt), /integrity/);
  await assert.rejects(
    () => readZip(writeZip(new Map([["../bad", "x"]]))),
    /Unsafe/,
  );
  await assert.rejects(() => readZip(new Uint8Array(LIMITS.file + 1)), /12 MB/);
  await assert.rejects(() => readZip(new Uint8Array(30)), /directory/);
});

test("standard deflate archive is decoded", async () => {
  const files = await readZip(
    Buffer.from(
      "UEsDBBQAAAAIANd2TV3CGNjYEQAAAA8AAAARAAAAd29yZC9kb2N1bWVudC54bWxLzs8tKEotLk5NUShJrSgBAFBLAQIUAxQAAAAIANd2TV3CGNjYEQAAAA8AAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAABAAAAAAAA=",
      "base64",
    ),
  );
  assert.equal(
    new TextDecoder().decode(files.get("word/document.xml")),
    "compressed text",
  );
});
