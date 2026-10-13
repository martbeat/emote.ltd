// Run with a local HTTP server at http://127.0.0.1:8765.
// Requires Playwright; optional CHROMIUM_EXECUTABLE selects an installed browser.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  page.on("dialog", (d) => d.accept());
  await page.goto("http://127.0.0.1:8765/redactor.html");
  await page
    .locator("#paste")
    .fill(
      "Alice Example\nEmail alice@example.org\nTelephone 07700 900123\nAddress RG1 2AB\nPublic information & <ordinary text>.",
    );
  await page.locator("#loadText").click();
  await page.waitForFunction(() =>
    document.querySelector("#source").value.startsWith("Alice"),
  );
  assert.equal(await page.locator("#docx").isDisabled(), true);
  await page.locator("#selectAll").check();
  await page.locator("#reason").fill("Synthetic test: identifiers withheld");
  await page.locator("#redact").click();
  await page.locator("#term").fill("Alice Example");
  await page.locator("#find").click();
  await page.locator("#filter").selectOption("pending");
  await page.locator("#selectAll").check();
  await page.locator("#redact").click();
  assert(!(await page.locator("#output").inputValue()).includes("Alice"));
  await page.locator("#caseRef").fill("TEST-001");
  await page.locator("#reviewer").fill("Test reviewer");
  await page.locator("#checker").fill("Test checker");
  for (const id of ["complete", "outputCheck", "authorised"])
    await page.locator("#" + id).check();
  assert.equal(await page.locator("#docx").isEnabled(), true);
  const docxDownload = page.waitForEvent("download");
  await page.locator("#docx").click();
  const docx = await docxDownload;
  await docx.saveAs("/tmp/redactor-export-test.docx");
  const core = await import("../js/redactor/core.mjs");
  const files = await core.readZip(
    await fs.readFile("/tmp/redactor-export-test.docx"),
  );
  assert.equal(files.size, 3);
  const xml = new TextDecoder().decode(files.get("word/document.xml"));
  assert(!xml.includes("alice@example.org"));
  assert(!xml.includes("Alice Example"));
  assert(xml.includes("[REDACTED"));
  const recordDownload = page.waitForEvent("download");
  await page.locator("#audit").click();
  const record = await recordDownload;
  const audit = JSON.parse(await fs.readFile(await record.path(), "utf8"));
  assert.equal(
    audit.docxSha256,
    await core.hash(await fs.readFile("/tmp/redactor-export-test.docx")),
  );
  assert(!JSON.stringify(audit).includes("alice@example.org"));
  await page.locator("#term").fill("Public information");
  await page.locator("#find").click();
  assert.equal(await page.locator("#docx").isDisabled(), true);
  assert.equal(await page.locator("#complete").isChecked(), false);
  await page.locator("#source").evaluate((el) => {
    el.focus();
    el.setSelectionRange(
      el.value.indexOf("ordinary"),
      el.value.indexOf("ordinary") + 8,
    );
  });
  await page.locator("#mark").click();
  assert((await page.locator("#counts").textContent()).includes("6 decisions"));
  await page.locator("#paste").fill("New replacement text");
  assert.equal(await page.locator("#source").inputValue(), "");
  assert.equal(
    await page.locator("#paste").inputValue(),
    "New replacement text",
  );
  assert.equal(await page.locator("#docx").isDisabled(), true);
  const result = await page.evaluate(async () => {
    const c = await import("/js/redactor/core.mjs");
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const base = await c.readZip(c.buildDocx("Public text"));
    const results = [];
    async function check(name, mutate, fail = true) {
      const f = new Map(base);
      mutate(f);
      try {
        const r = await c.importDocx(c.writeZip(f));
        if (fail) throw new Error("UNEXPECTED ACCEPT: " + name);
        results.push(name);
        return r;
      } catch (e) {
        if (!fail || e.message.startsWith("UNEXPECTED")) throw e;
        results.push(name);
      }
    }
    const doc = (body) =>
      `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`;
    await check("image", (f) =>
      f.set("word/media/image.png", new Uint8Array([1, 2])),
    );
    await check("tracked change", (f) =>
      f.set(
        "word/document.xml",
        doc("<w:ins><w:p><w:r><w:t>Secret</w:t></w:r></w:p></w:ins>"),
      ),
    );
    await check("hidden text", (f) =>
      f.set(
        "word/document.xml",
        doc(
          "<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Secret</w:t></w:r></w:p>",
        ),
      ),
    );
    await check("inherited hidden style", (f) =>
      f.set(
        "word/styles.xml",
        `<w:styles xmlns:w="${W}"><w:style><w:rPr><w:vanish/></w:rPr></w:style></w:styles>`,
      ),
    );
    await check("field", (f) =>
      f.set(
        "word/document.xml",
        doc(
          '<w:p><w:fldSimple w:instr="test"><w:r><w:t>Secret</w:t></w:r></w:fldSimple></w:p>',
        ),
      ),
    );
    await check("content control", (f) =>
      f.set(
        "word/document.xml",
        doc(
          "<w:sdt><w:sdtContent><w:p><w:r><w:t>Secret</w:t></w:r></w:p></w:sdtContent></w:sdt>",
        ),
      ),
    );
    await check("DTD", (f) =>
      f.set(
        "word/document.xml",
        '<!DOCTYPE x [<!ENTITY e "Secret">]>' + doc("<w:p/>"),
      ),
    );
    await check("invalid XML", (f) =>
      f.set("word/document.xml", "<w:document>"),
    );
    await check("nonstandard header path", (f) =>
      f.set(
        "[Content_Types].xml",
        '<Types><Override PartName="/word/other.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>',
      ),
    );
    const imported = await check(
      "split runs, header and comments",
      (f) => {
        f.set(
          "word/document.xml",
          doc(
            "<w:p><w:r><w:t>alice@</w:t></w:r><w:r><w:t>example.org</w:t></w:r></w:p>",
          ),
        );
        f.set(
          "word/footnotes.xml",
          `<w:footnotes xmlns:w="${W}"><w:footnote w:id="0"><w:p><w:r><w:t>Footnote zero</w:t></w:r></w:p></w:footnote></w:footnotes>`,
        );
        f.set(
          "word/header1.xml",
          `<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>Header secret</w:t></w:r></w:p></w:hdr>`,
        );
        f.set(
          "word/comments.xml",
          `<w:comments xmlns:w="${W}"><w:comment><w:p><w:r><w:t>Comment secret</w:t></w:r></w:p></w:comment></w:comments>`,
        );
      },
      false,
    );
    if (
      !imported.text.includes("Footnote zero") ||
      !imported.text.includes("alice@example.org") ||
      !imported.text.includes("Header secret") ||
      imported.text.includes("Comment secret") ||
      !imported.warnings.some((w) => w.includes("Comments"))
    )
      throw new Error("Import text or warning mismatch");
    return results;
  });
  assert.equal(result.length, 10);
  await page
    .locator("#file")
    .setInputFiles({
      name: "bad.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("not a zip"),
    });
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Invalid"),
  );
  assert.equal(await page.locator("#docx").isDisabled(), true);
  await page.locator("#file").setInputFiles("/tmp/redactor-export-test.docx");
  await page.waitForFunction(() =>
    document.querySelector("#source").value.includes("Public information"),
  );
  assert(
    (await page.locator("#warnings").textContent()).includes("reconstruction"),
  );
  await page.screenshot({ path: "/tmp/redactor-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/redactor-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert(requests.every((url) => url.startsWith("http://127.0.0.1:8765/")));
  console.log(
    "PASS: review, manual and batch decisions, stale export reset, DOCX and audit verification, replacement source, 10 DOCX fixtures, failed import, reimport, mobile width and no external requests.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
