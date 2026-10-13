export const VERSION = "2.0.0-pilot.1";
export const LIMITS = Object.freeze({
  file: 12 * 1024 * 1024,
  expanded: 32 * 1024 * 1024,
  entries: 1000,
  text: 350000,
  decisions: 5000,
});
const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });
export function validText(text) {
  if (!text.trim()) throw new Error("No readable text found.");
  if (text.length > LIMITS.text)
    throw new Error(
      "This pilot supports up to 350,000 characters. Split the source into smaller documents.",
    );
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(text))
    throw new Error("Unsupported control characters in the source.");
  return text;
}
export function normaliseText(text) {
  return validText(text.replace(/\r\n?/g, "\n"));
}
export async function hash(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export const xmlEscape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// A deliberately small, bounded ZIP reader. ZIP64, encryption and unfamiliar methods fail closed.
export async function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > LIMITS.file || bytes.length < 22)
    throw new Error("Invalid file or file exceeds the 12 MB pilot limit.");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (n) => v.getUint16(n, true),
    u32 = (n) => v.getUint32(n, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Invalid ZIP directory.");
  const count = u16(end + 10),
    size = u32(end + 12),
    start = u32(end + 16);
  if (
    u16(end + 4) ||
    u16(end + 6) ||
    count !== u16(end + 8) ||
    count === 65535 ||
    count > LIMITS.entries ||
    start + size !== end
  )
    throw new Error("Unsupported ZIP directory.");
  const files = new Map();
  let p = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || u32(p) !== 0x02014b50)
      throw new Error("Invalid ZIP entry.");
    const flags = u16(p + 8),
      method = u16(p + 10),
      crc = u32(p + 16),
      compressed = u32(p + 20),
      length = u32(p + 24),
      nl = u16(p + 28),
      el = u16(p + 30),
      cl = u16(p + 32),
      local = u32(p + 42);
    if (
      p + 46 + nl + el + cl > end ||
      local + 30 > start ||
      u32(local) !== 0x04034b50
    )
      throw new Error("Invalid ZIP offsets.");
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    if (!name || /(^\/|\\|\x00|(^|\/)\.\.(\/|$))/.test(name) || files.has(name))
      throw new Error("Unsafe or duplicate ZIP path.");
    if (
      flags & 0x2041 ||
      ![0, 8].includes(method) ||
      u16(local + 8) !== method ||
      u16(local + 6) !== flags
    )
      throw new Error("Encrypted or unsupported ZIP entry.");
    const localNameLength = u16(local + 26),
      dataStart = local + 30 + localNameLength + u16(local + 28);
    if (
      dataStart + compressed > start ||
      dec.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !==
        name
    )
      throw new Error("Invalid ZIP data range.");
    total += length;
    if (total > LIMITS.expanded)
      throw new Error("Expanded document exceeds the 32 MB pilot limit.");
    let data = bytes.slice(dataStart, dataStart + compressed);
    if (method === 8) {
      const reader = new Blob([data])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .getReader();
      const chunks = [];
      let actual = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          actual += value.length;
          if (actual > length || actual > LIMITS.expanded)
            throw new Error("Expanded data exceeds declared size.");
          chunks.push(value);
        }
      } catch (e) {
        await reader.cancel().catch(() => {});
        throw e;
      }
      data = new Uint8Array(actual);
      let offset = 0;
      for (const c of chunks) {
        data.set(c, offset);
        offset += c.length;
      }
    }
    if (data.length !== length || crc32(data) !== crc)
      throw new Error("ZIP integrity check failed.");
    files.set(name, data);
    p += 46 + nl + el + cl;
  }
  if (p !== end) throw new Error("ZIP directory length mismatch.");
  return files;
}
export function writeZip(files) {
  const entries = [...files].map(([name, data]) => ({
    name: enc.encode(name),
    data: typeof data === "string" ? enc.encode(data) : data,
  }));
  const localSize = entries.reduce(
    (n, e) => n + 30 + e.name.length + e.data.length,
    0,
  );
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22),
    v = new DataView(out.buffer);
  const w16 = (p, n) => v.setUint16(p, n, true),
    w32 = (p, n) => v.setUint32(p, n, true);
  let p = 0;
  for (const e of entries) {
    e.offset = p;
    e.crc = crc32(e.data);
    w32(p, 0x04034b50);
    w16(p + 4, 20);
    w16(p + 6, 0x800);
    w32(p + 14, e.crc);
    w32(p + 18, e.data.length);
    w32(p + 22, e.data.length);
    w16(p + 26, e.name.length);
    out.set(e.name, p + 30);
    out.set(e.data, p + 30 + e.name.length);
    p += 30 + e.name.length + e.data.length;
  }
  for (const e of entries) {
    w32(p, 0x02014b50);
    w16(p + 4, 20);
    w16(p + 6, 20);
    w16(p + 8, 0x800);
    w32(p + 16, e.crc);
    w32(p + 20, e.data.length);
    w32(p + 24, e.data.length);
    w16(p + 28, e.name.length);
    w32(p + 42, e.offset);
    out.set(e.name, p + 46);
    p += 46 + e.name.length;
  }
  w32(p, 0x06054b50);
  w16(p + 8, entries.length);
  w16(p + 10, entries.length);
  w32(p + 12, centralSize);
  w32(p + 16, localSize);
  return out;
}
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
function parseXml(data) {
  const text = dec.decode(data);
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error("XML declarations with entities are unsupported.");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error("Invalid XML in the Word document.");
  return doc;
}
export async function importDocx(bytes) {
  const files = await readZip(bytes);
  if (!files.has("word/document.xml") || !files.has("[Content_Types].xml"))
    throw new Error("This is not a supported DOCX file.");
  const blocked = [];
  const warnings = new Set([
    "This is a text reconstruction. Fonts, layout, pagination, automatic numbering and table layout are not preserved. Compare with the original before use.",
    "Original metadata, comments, links and package parts are not copied to the export.",
  ]);
  for (const name of files.keys()) {
    if (
      /(^word\/(media|embeddings|charts|diagrams|activeX)\/|vbaProject|afchunk|altchunk)/i.test(
        name,
      )
    )
      blocked.push("Images, embedded content or active content");
    if (/^word\/comments/i.test(name))
      warnings.add(
        "Comments are excluded. Read them in the original and decide whether any information must be included.",
      );
    if (/^customXml\//.test(name))
      warnings.add(
        "Custom XML is excluded. Check whether it contains information within the scope of disclosure.",
      );
  }
  // Reject nonstandard text part locations instead of silently missing their contents.
  const types = parseXml(files.get("[Content_Types].xml"));
  for (const entry of types.getElementsByTagName("*")) {
    const type = entry.getAttribute("ContentType") || "",
      part = entry.getAttribute("PartName") || "";
    if (/macroEnabled|vbaProject/i.test(type))
      blocked.push("Macro-enabled content");
    if (
      /wordprocessingml\.(document\.main|header|footer|footnotes|endnotes)\+xml$/.test(
        type,
      ) &&
      !/^\/word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(
        part,
      )
    )
      blocked.push("Nonstandard Word text part location");
  }
  if (files.has("word/styles.xml")) {
    const styles = parseXml(files.get("word/styles.xml"));
    if (
      styles.getElementsByTagNameNS(W, "vanish").length ||
      styles.getElementsByTagNameNS(W, "webHidden").length
    )
      blocked.push("Styles containing hidden text settings");
  }
  const sections = [];
  const paths = [...files.keys()]
    .filter((n) =>
      /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n),
    )
    .sort((a, b) =>
      a === "word/document.xml"
        ? -1
        : b === "word/document.xml"
          ? 1
          : a.localeCompare(b),
    );
  const unsupported = new Set([
    "drawing",
    "pict",
    "object",
    "altChunk",
    "ins",
    "del",
    "moveFrom",
    "moveTo",
    "instrText",
    "fldSimple",
    "fldChar",
    "sym",
    "subDoc",
    "contentPart",
    "sdt",
  ]);
  for (const path of paths) {
    const doc = parseXml(files.get(path));
    if (
      doc.documentElement.namespaceURI !== W ||
      (path === "word/document.xml" &&
        doc.documentElement.localName !== "document")
    )
      throw new Error("Only standard transitional Word DOCX is supported.");
    for (const el of doc.getElementsByTagName("*")) {
      if (
        (el.namespaceURI === W && unsupported.has(el.localName)) ||
        el.localName === "AlternateContent" ||
        el.namespaceURI ===
          "http://schemas.openxmlformats.org/officeDocument/2006/math"
      )
        blocked.push(
          "Tracked changes, fields, drawings, equations or content controls",
        );
      if (
        el.namespaceURI === W &&
        ["vanish", "webHidden", "specVanish"].includes(el.localName)
      )
        blocked.push("Hidden text");
    }
    const paragraphs = [];
    for (const p of doc.getElementsByTagNameNS(W, "p")) {
      let text = "";
      for (const el of p.getElementsByTagName("*")) {
        if (el.namespaceURI !== W) continue;
        if (el.localName === "t") text += el.textContent;
        if (["br", "cr"].includes(el.localName)) text += "\n";
        if (["tab", "ptab"].includes(el.localName)) text += "\t";
        if (el.localName === "noBreakHyphen") text += "‑";
        if (el.localName === "softHyphen") text += "\u00ad";
        if (["footnoteReference", "endnoteReference"].includes(el.localName))
          text += ` [${el.localName === "footnoteReference" ? "Footnote" : "Endnote"} ${el.getAttributeNS(W, "id")}]`;
      }
      if (path.endsWith("notes.xml")) {
        let parent = p.parentElement;
        while (parent && !["footnote", "endnote"].includes(parent.localName))
          parent = parent.parentElement;
        if (parent) {
          const id = parent.getAttributeNS(W, "id");
          if (
            [
              "separator",
              "continuationSeparator",
              "continuationNotice",
            ].includes(parent.getAttributeNS(W, "type"))
          )
            continue;
          text = `[${path.endsWith("/footnotes.xml") ? "Footnote" : "Endnote"} ${id}] ${text}`;
        }
      }
      paragraphs.push(text);
    }
    if (doc.getElementsByTagNameNS(W, "tbl").length)
      warnings.add(
        "Tables are flattened into paragraphs in cell order. Check row and column meaning against the original.",
      );
    if (paragraphs.some((t) => t.trim()))
      sections.push({
        label:
          path === "word/document.xml"
            ? "Main document"
            : path.replace("word/", "").replace(".xml", ""),
        text: paragraphs.join("\n"),
      });
  }
  // Unsupported content cannot be silently discarded behind a successful export.
  if (blocked.length)
    throw new Error(
      `Cannot import this document: ${[...new Set(blocked)].join("; ")}. Use an approved tool for these features. The original has not been changed.`,
    );
  const text = normaliseText(
    sections.map((s) => `[${s.label}]\n${s.text}`).join("\n\n"),
  );
  return {
    text,
    warnings: [...warnings],
    sections: sections.map((s) => s.label),
  };
}
const patterns = [
  ["Email", /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi],
  ["UK postcode", /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi],
  [
    "Telephone",
    /(?<![\w])(?:\+44\s?(?:\(0\)\s?)?|0)(?:\d[\s().-]?){8,9}\d(?!\w)/g,
  ],
  [
    "National Insurance number",
    /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi,
  ],
];
export function detect(text) {
  const all = [];
  for (const [type, re] of patterns) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      all.push({
        start: m.index,
        end: m.index + m[0].length,
        type,
        status: "pending",
        reason: "",
      });
      if (all.length > LIMITS.decisions)
        throw new Error(
          "Too many suggestions for one review. Split the document.",
        );
    }
  }
  all.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const match of all)
    if (!out.some((x) => overlap(x, match))) out.push(match);
  if (out.length > LIMITS.decisions)
    throw new Error("Too many suggestions for one review. Split the document.");
  return out;
}
export function overlap(a, b) {
  return a.start < b.end && b.start < a.end;
}
export function findLiteral(text, term, ignoreCase = true) {
  if (!term) throw new Error("Enter text to find.");
  const re = new RegExp(
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ignoreCase ? "giu" : "gu",
  );
  return [...text.matchAll(re)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
}
export function validateDecisions(text, decisions) {
  if (decisions.length > LIMITS.decisions)
    throw new Error("Too many decisions.");
  const sorted = [...decisions].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    if (
      !Number.isInteger(d.start) ||
      !Number.isInteger(d.end) ||
      d.start < 0 ||
      d.end > text.length ||
      d.start >= d.end ||
      !["pending", "redact", "keep"].includes(d.status)
    )
      throw new Error("Invalid decision range.");
    if (i && overlap(sorted[i - 1], d))
      throw new Error("Overlapping decisions must be resolved.");
  }
  return sorted;
}
export function applyDecisions(text, decisions) {
  const sorted = validateDecisions(text, decisions);
  let out = "",
    cursor = 0;
  for (const d of sorted) {
    out += text.slice(cursor, d.start);
    out +=
      d.status === "redact" ? `[REDACTED ${d.id}]` : text.slice(d.start, d.end);
    cursor = d.end;
  }
  return out + text.slice(cursor);
}
export function canRelease(text, decisions, review) {
  validateDecisions(text, decisions);
  return (
    !!text.trim() &&
    decisions.every((d) => d.status !== "pending" && d.reason.trim()) &&
    !!review.caseRef.trim() &&
    !!review.reviewer.trim() &&
    !!review.checker.trim() &&
    review.reviewer.trim().toLowerCase() !==
      review.checker.trim().toLowerCase() &&
    review.complete &&
    review.output &&
    review.authorised
  );
}
export function buildDocx(text) {
  validText(text);
  const paragraphs = text
    .split("\n")
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line).replace(/\t/g, '</w:t><w:tab/><w:t xml:space="preserve">')}</w:t></w:r></w:p>`,
    )
    .join("");
  return writeZip(
    new Map([
      [
        "[Content_Types].xml",
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ],
      [
        "_rels/.rels",
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ],
      [
        "word/document.xml",
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
      ],
    ]),
  );
}
