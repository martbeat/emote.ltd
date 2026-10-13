import * as pdfjs from "./vendor/pdf.mjs";
import "./vendor/pdf-lib.js";
import { hash } from "./core.mjs";
const { PDFDocument, PDFName } = globalThis.PDFLib;
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdf.worker.mjs",
  import.meta.url,
).href;
export const PDF_VERSION = "2.1.0-pdf-pilot.1";
export const PDF_LIMITS = Object.freeze({
  file: 12 * 1024 * 1024,
  pages: 50,
  pagePixels: 16e6,
  totalPixels: 120e6,
  marks: 2000,
  output: 80 * 1024 * 1024,
  plan: 2 * 1024 * 1024,
  scale: 2,
});
export async function openPdf(bytes) {
  if (bytes.length > PDF_LIMITS.file)
    throw new Error("PDF inputs must be no larger than 12 MB.");
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    enableXfa: false,
    useWasm: false,
    useSystemFonts: false,
    standardFontDataUrl: new URL("./vendor/standard_fonts/", import.meta.url)
      .href,
    stopAtErrors: true,
  });
  task.onPassword = () => {
    task.destroy();
  };
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new Error(
      `Cannot open this PDF. Encrypted or unsupported PDFs need an approved handling route. ${e.message}`,
    );
  }
  try {
    if (doc.numPages < 1 || doc.numPages > PDF_LIMITS.pages)
      throw new Error("This pilot supports up to 50 PDF pages.");
    if (doc.isPureXfa) throw new Error("XFA forms are unsupported.");
    if (await doc.getAttachments())
      throw new Error(
        "PDF attachments are unsupported. Retain the original and use an approved handling route.",
      );
    if (await doc.hasJSActions())
      throw new Error("PDF scripts are unsupported.");
    const layers = await doc.getOptionalContentConfig();
    if (layers && [...layers].length)
      throw new Error("Layered PDFs are unsupported.");
    const pages = [];
    let total = 0,
      fragmentsTotal = 0,
      textTotal = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i),
        viewport = page.getViewport({ scale: 1 });
      if (
        !Number.isFinite(viewport.width) ||
        !Number.isFinite(viewport.height) ||
        viewport.width <= 0 ||
        viewport.height <= 0
      )
        throw new Error("Invalid page dimensions.");
      const pixels =
        Math.ceil(viewport.width * PDF_LIMITS.scale) *
        Math.ceil(viewport.height * PDF_LIMITS.scale);
      total += pixels;
      if (pixels > PDF_LIMITS.pagePixels || total > PDF_LIMITS.totalPixels)
        throw new Error("This PDF exceeds the pilot page-rendering limit.");
      const annotations = await page.getAnnotations();
      if (
        annotations.some(
          (a) =>
            a.subtype !== "Link" ||
            a.hasAppearance ||
            (a.borderStyle?.width ?? 0) > 0,
        )
      )
        throw new Error(
          "Forms, signatures and annotations with separate visible content or borders are unsupported. Review them in an approved application.",
        );
      const content = await page.getTextContent();
      fragmentsTotal += content.items.length;
      textTotal += content.items.reduce(
        (n, item) => n + (item.str?.length || 0),
        0,
      );
      if (fragmentsTotal > 50000 || textTotal > 500000)
        throw new Error("PDF text extraction exceeds the pilot limit.");
      const fragments = content.items
        .filter((item) => typeof item.str === "string" && item.str.trim())
        .map((item) => ({
          text: item.str,
          rect: fragmentRect(item, content.styles[item.fontName], viewport),
        }));
      pages.push({ width: viewport.width, height: viewport.height, fragments });
    }
    return { doc, pages, sourceHash: await hash(bytes) };
  } catch (e) {
    await doc.destroy();
    throw e;
  }
}
function fragmentRect(item, style, viewport) {
  const t = pdfjs.Util.transform(viewport.transform, item.transform),
    angle = Math.atan2(t[1], t[0]),
    height = Math.hypot(t[2], t[3]),
    width = item.width;
  if (
    item.dir === "ttb" ||
    ![...t, height, width].every(Number.isFinite) ||
    height <= 0 ||
    width <= 0
  )
    return null;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    ascent = style?.ascent ?? 0.9,
    descent = Math.abs(style?.descent ?? 0.3),
    boxHeight = height * (ascent + descent);
  const x = t[4] + s * height * ascent,
    y = t[5] - c * height * ascent;
  const points = [
    [x, y],
    [x + c * width, y + s * width],
    [x - s * boxHeight, y + c * boxHeight],
    [x + c * width - s * boxHeight, y + s * width + c * boxHeight],
  ];
  const left = Math.max(0, Math.min(...points.map((p) => p[0]))),
    top = Math.max(0, Math.min(...points.map((p) => p[1])));
  const right = Math.min(viewport.width, Math.max(...points.map((p) => p[0]))),
    bottom = Math.min(viewport.height, Math.max(...points.map((p) => p[1])));
  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : null;
}
export function validateMarks(marks, pages) {
  if (!Array.isArray(marks) || marks.length > PDF_LIMITS.marks)
    throw new Error("Too many PDF areas.");
  const ids = new Set();
  for (const m of marks) {
    if (
      !m ||
      typeof m.id !== "string" ||
      !/^P\d{1,6}$/.test(m.id) ||
      ids.has(m.id) ||
      !Number.isInteger(m.page) ||
      !pages[m.page] ||
      !["pending", "redact", "keep"].includes(m.status) ||
      typeof m.reason !== "string" ||
      m.reason.length > 600
    )
      throw new Error("Invalid PDF area decision.");
    ids.add(m.id);
    const r = m.rect,
      p = pages[m.page];
    if (
      !r ||
      ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.x < 0 ||
      r.y < 0 ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.x + r.width > p.width + 0.00001 ||
      r.y + r.height > p.height + 0.00001
    )
      throw new Error("A redaction area lies outside its page.");
  }
  return marks;
}
export function pixelRect(rect, width, height, canvasWidth, canvasHeight) {
  const pad = 1,
    sx = canvasWidth / width,
    sy = canvasHeight / height;
  const left = Math.max(0, Math.floor((rect.x - pad) * sx)),
    top = Math.max(0, Math.floor((rect.y - pad) * sy));
  const right = Math.min(
      canvasWidth,
      Math.ceil((rect.x + rect.width + pad) * sx),
    ),
    bottom = Math.min(
      canvasHeight,
      Math.ceil((rect.y + rect.height + pad) * sy),
    );
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export async function renderPage(doc, index, scale = PDF_LIMITS.scale) {
  const page = await doc.getPage(index + 1),
    viewport = page.getViewport({ scale }),
    canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  if (canvas.width * canvas.height > PDF_LIMITS.pagePixels)
    throw new Error("Page is too large to render.");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvasContext: ctx,
    viewport,
    annotationMode: pdfjs.AnnotationMode.DISABLE,
    background: "#fff",
  }).promise;
  return canvas;
}
export async function buildRelease(
  source,
  marks,
  { check = () => {}, progress = () => {} } = {},
) {
  validateMarks(marks, source.pages);
  if (marks.some((m) => m.status === "pending" || !m.reason.trim()))
    throw new Error("Resolve every area and record its reason before export.");
  const output = await PDFDocument.create();
  output.setProducer("eMote PDF release pilot");
  output.setCreator("eMote PDF release pilot");
  const rasterHashes = [];
  for (let i = 0; i < source.pages.length; i++) {
    check();
    progress(i, source.pages.length);
    const canvas = await renderPage(source.doc, i);
    check();
    const size = source.pages[i],
      ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    for (const mark of marks.filter(
      (m) => m.page === i && m.status === "redact",
    )) {
      const r = pixelRect(
        mark.rect,
        size.width,
        size.height,
        canvas.width,
        canvas.height,
      );
      ctx.fillRect(r.x, r.y, r.width, r.height);
    }
    // Encode only after changing the pixels. No original page, text layer or object is copied.
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Could not encode a redacted page.");
    const png = new Uint8Array(await blob.arrayBuffer());
    rasterHashes.push(await hash(png));
    const image = await output.embedPng(png),
      page = output.addPage([size.width, size.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });
    page.node.delete(PDFName.of("Annots"));
    canvas.width = 0;
    canvas.height = 0;
  }
  check();
  const bytes = await output.save({ useObjectStreams: false });
  if (bytes.length > PDF_LIMITS.output)
    throw new Error("Release PDF exceeds the 80 MB pilot limit.");
  const task = pdfjs.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      useWasm: false,
    }),
    doc = await task.promise;
  try {
    if (
      doc.numPages !== source.pages.length ||
      (await doc.getAttachments()) ||
      (await doc.hasJSActions())
    )
      throw new Error("Release PDF verification failed.");
    for (let i = 0; i < doc.numPages; i++) {
      check();
      const page = await doc.getPage(i + 1),
        v = page.getViewport({ scale: 1 }),
        size = source.pages[i];
      if (
        Math.abs(v.width - size.width) > 0.001 ||
        Math.abs(v.height - size.height) > 0.001 ||
        (await page.getAnnotations()).length ||
        (await page.getTextContent()).items.some((t) => t.str?.trim())
      )
        throw new Error(
          "Release page size, annotations or text-layer verification failed.",
        );
    }
    check();
    return { bytes, doc, sha256: await hash(bytes), rasterHashes };
  } catch (e) {
    await doc.destroy();
    throw e;
  }
}
export function savePdfReview(source, marks, fields) {
  validateMarks(marks, source.pages);
  return {
    schema: "emote-pdf-working-review/1",
    version: PDF_VERSION,
    savedAt: new Date().toISOString(),
    sourceSha256: source.sourceHash,
    pages: source.pages.map(({ width, height }) => ({ width, height })),
    fields: {
      caseRef: fields.caseRef,
      reviewer: fields.reviewer,
      checker: fields.checker,
    },
    marks: marks.map(({ id, page, rect, status, reason }) => ({
      id,
      page,
      rect: { ...rect },
      status,
      reason,
    })),
  };
}
export function restorePdfReview(plan, source) {
  if (
    !plan ||
    plan.schema !== "emote-pdf-working-review/1" ||
    plan.sourceSha256 !== source.sourceHash ||
    JSON.stringify(plan.pages) !==
      JSON.stringify(
        source.pages.map(({ width, height }) => ({ width, height })),
      )
  )
    throw new Error(
      "This working review does not match the unchanged original PDF.",
    );
  validateMarks(plan.marks, source.pages);
  if (
    !plan.fields ||
    ["caseRef", "reviewer", "checker"].some(
      (k) => typeof plan.fields[k] !== "string" || plan.fields[k].length > 120,
    )
  )
    throw new Error("Invalid saved review fields.");
  return {
    marks: plan.marks.map(({ id, page, rect, status, reason }) => ({
      id,
      page,
      rect: { ...rect },
      status,
      reason,
      hint: "Restored area",
    })),
    fields: plan.fields,
  };
}
