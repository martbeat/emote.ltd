import {
  openPdf,
  renderPage,
  buildRelease,
  validateMarks,
  pixelRect,
  savePdfReview,
  restorePdfReview,
  PDF_LIMITS,
  PDF_VERSION,
} from "./pdf-engine.js";
import { detect } from "./core.js";
const $ = (id) => document.getElementById(id);
let source = null,
  marks = [],
  pageIndex = 0,
  nextId = 1,
  selected = null,
  prepared = null;
let generation = 0,
  revision = 0,
  viewToken = 0,
  viewReady = false,
  busy = false,
  drag = null;
const workingChecks = new Set(),
  finalChecks = new Set(),
  urls = new Set();
const fields = () => ({
  caseRef: $("caseRef").value.trim(),
  reviewer: $("reviewer").value.trim(),
  checker: $("checker").value.trim(),
});
const status = (text, error = false) => {
  $("status").textContent = text;
  $("status").className = error ? "error" : "";
};
function discardPrepared() {
  if (prepared) prepared.doc.destroy().catch(() => {});
  prepared = null;
  finalChecks.clear();
  $("finalMode").checked = false;
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
}
function invalidate(resetPages = true) {
  const wasFinal = $("finalMode").checked;
  revision++;
  discardPrepared();
  if (wasFinal) showPage();
  if (resetPages) workingChecks.clear();
  for (const id of ["imageAccepted", "reviewComplete", "authorised"])
    $(id).checked = false;
  update();
  paintOverlay();
}
function ready() {
  const f = fields();
  return (
    !!source &&
    !busy &&
    workingChecks.size === source.pages.length &&
    marks.every((m) => m.status !== "pending" && m.reason.trim()) &&
    f.caseRef &&
    f.reviewer &&
    f.checker &&
    f.reviewer.toLowerCase() !== f.checker.toLowerCase() &&
    $("imageAccepted").checked &&
    $("reviewComplete").checked &&
    $("authorised").checked
  );
}
function releaseReady() {
  return (
    !!prepared &&
    prepared.revision === revision &&
    ready() &&
    finalChecks.size === source.pages.length
  );
}
function update() {
  $("demo").disabled = busy;
  const pending = marks.filter((m) => m.status === "pending").length;
  $("counts").textContent = source
    ? `${marks.length} areas · ${pending} pending`
    : "No PDF loaded";
  $("pageNumber").textContent = source
    ? `Page ${pageIndex + 1} of ${source.pages.length}`
    : "No page";
  $("prev").disabled = !source || busy || pageIndex === 0;
  $("next").disabled = !source || busy || pageIndex === source.pages.length - 1;
  for (const id of ["save", "resume", "return", "find", "add"])
    $(id).disabled = !source || busy;
  const item = marks.find((m) => m.id === selected);
  for (const id of ["redact", "keep", "remove", "adjust"])
    $(id).disabled = !item || busy || $("finalMode").checked;
  $("prepare").disabled = !ready();
  $("download").disabled = !releaseReady();
  $("report").disabled = !releaseReady();
  $("finalMode").disabled = !prepared || busy;
  $("pageChecked").disabled = !source || busy || !viewReady;
  const final = $("finalMode").checked;
  $("pageChecked").checked = (final ? finalChecks : workingChecks).has(
    pageIndex,
  );
  $("pageCheckLabel").textContent = final
    ? "The checker inspected this actual final PDF page and confirmed the approved areas and retained content."
    : "I checked this whole working page against the original and all proposed areas.";
  $("pageCheckInfo").textContent = source
    ? `${workingChecks.size}/${source.pages.length} working pages checked · ${finalChecks.size}/${source.pages.length} final PDF pages confirmed`
    : "";
  $("gate").textContent = !source
    ? "Load a PDF to begin."
    : busy
      ? "Preparing and verifying page images…"
      : pending
        ? `Resolve ${pending} pending area decisions.`
        : marks.some((m) => !m.reason.trim())
          ? "Record a reason for every area decision."
          : workingChecks.size !== source.pages.length
            ? "Check and confirm every working page."
            : !ready()
              ? "Enter case and reviewer details, then complete all three declarations."
              : !prepared
                ? "The working review is complete. Prepare the separate final PDF."
                : finalChecks.size !== source.pages.length
                  ? "Inspect and confirm every page of the actual prepared final PDF."
                  : "All final pages confirmed. The checked final PDF and internal record can be downloaded.";
}
function populateAreas() {
  $("areas").replaceChildren();
  const items = marks.filter((m) => m.page === pageIndex);
  for (const m of items) {
    const row = document.createElement("div");
    row.className = "area" + (m.id === selected ? " selected" : "");
    const label = document.createElement("strong");
    label.textContent = `${m.id} · ${m.status.toUpperCase()}`;
    const hint = document.createElement("p");
    hint.textContent = m.hint || "Manually marked area";
    const detail = document.createElement("p");
    detail.textContent = m.reason || "Reason required";
    const button = document.createElement("button");
    button.textContent = "Select area";
    button.disabled = busy;
    button.onclick = () => {
      selected = m.id;
      setCoordinates(m.rect);
      $("reason").value = m.reason;
      populateAreas();
      update();
      paintOverlay();
    };
    row.append(label, hint, detail, button);
    $("areas").append(row);
  }
  if (!items.length)
    $("areas").textContent =
      "No marked areas on this page. Check every part of the page.";
}
function paintOverlay() {
  const canvas = $("overlay"),
    ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!source || $("finalMode").checked) return;
  const size = source.pages[pageIndex];
  for (const m of marks.filter(
    (m) => m.page === pageIndex && m.status !== "keep",
  )) {
    const r = pixelRect(
      m.rect,
      size.width,
      size.height,
      canvas.width,
      canvas.height,
    );
    ctx.fillStyle = m.status === "redact" ? "#000" : "rgba(220,130,10,.3)";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle =
      m.id === selected
        ? "#00a8dd"
        : m.status === "redact"
          ? "#000"
          : "#a66506";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
  }
  if (drag) {
    const r = dragRect(drag);
    ctx.strokeStyle = "#00a8dd";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (r.x / size.width) * canvas.width,
      (r.y / size.height) * canvas.height,
      (r.width / size.width) * canvas.width,
      (r.height / size.height) * canvas.height,
    );
  }
}
async function showPage() {
  const token = ++viewToken,
    epoch = generation,
    index = pageIndex;
  viewReady = false;
  update();
  if (!source) return;
  const doc = $("finalMode").checked ? prepared?.doc : source.doc;
  if (!doc) return;
  try {
    const canvas = await renderPage(doc, index);
    if (token !== viewToken || epoch !== generation) {
      canvas.width = 0;
      return;
    }
    const target = $("pageCanvas");
    target.width = canvas.width;
    target.height = canvas.height;
    target.getContext("2d", { alpha: false }).drawImage(canvas, 0, 0);
    $("overlay").width = canvas.width;
    $("overlay").height = canvas.height;
    canvas.width = 0;
    viewReady = true;
    populateAreas();
    paintOverlay();
    update();
  } catch (e) {
    if (token === viewToken)
      status(`Could not render this page: ${e.message}`, true);
  }
}
function reset() {
  generation++;
  viewToken++;
  revision++;
  discardPrepared();
  source?.doc.destroy().catch(() => {});
  source = null;
  marks = [];
  workingChecks.clear();
  selected = null;
  pageIndex = 0;
  nextId = 1;
  viewReady = false;
  busy = false;
  drag = null;
  for (const id of [
    "pdfFile",
    "resume",
    "search",
    "reason",
    "caseRef",
    "reviewer",
    "checker",
  ])
    $(id).value = "";
  for (const id of [
    "imageAccepted",
    "reviewComplete",
    "authorised",
    "pageChecked",
  ])
    $(id).checked = false;
  $("pageCanvas").width = 0;
  $("overlay").width = 0;
  $("areas").replaceChildren();
  $("results").replaceChildren();
  $("sourceInfo").textContent = "";
  update();
}
$("clear").onclick = () => {
  reset();
  status("Session cleared. Already downloaded files remain on your device.");
};
async function loadFile(file) {
  if (!file) return;
  reset();
  const token = generation;
  busy = true;
  update();
  status("Opening and checking the PDF…");
  try {
    if (!/\.pdf$/i.test(file.name) || file.size > PDF_LIMITS.file)
      throw new Error("Choose a PDF no larger than 12 MB.");
    const loaded = await openPdf(new Uint8Array(await file.arrayBuffer()));
    if (token !== generation) {
      await loaded.doc.destroy();
      return;
    }
    source = loaded;
    for (let page = 0; page < source.pages.length; page++)
      for (const fragment of source.pages[page].fragments) {
        const types = detect(fragment.text).map((d) => d.type);
        if (types.length && fragment.rect) {
          if (marks.length >= PDF_LIMITS.marks)
            throw new Error(
              "Too many suggestions for one PDF. Split the source.",
            );
          marks.push({
            id: `P${nextId++}`,
            page,
            rect: { ...fragment.rect },
            status: "pending",
            reason: "",
            hint: `${[...new Set(types)].join(", ")} suggestion: ${fragment.text}`,
          });
        }
      }
    $("sourceInfo").textContent =
      `${source.pages.length} pages · Source SHA-256 ${source.sourceHash}. Text-pattern suggestions cover whole fragments. No guarantee of complete detection.`;
    status(
      "PDF loaded. Inspect whole-fragment suggestions, mark anything missed and check every page against the original.",
    );
  } catch (e) {
    if (token === generation) {
      source?.doc.destroy().catch(() => {});
      source = null;
      marks = [];
      status(e.message, true);
    }
  } finally {
    if (token === generation) {
      busy = false;
      update();
      await showPage();
    }
  }
}
$("pdfFile").onchange = () => loadFile($("pdfFile").files[0]);
$("demo").onclick = async () => {
  const token = generation;
  $("demo").disabled = true;
  status("Loading the fictional demonstration PDF…");
  try {
    const response = await fetch(new URL("../../assets/redaction-demo.pdf", import.meta.url));
    if (!response.ok) throw new Error("Could not load the demonstration PDF.");
    const bytes = await response.arrayBuffer();
    if (token !== generation) return;
    await loadFile(new File([bytes], "fictional-demo.pdf", {type:"application/pdf"}));
  } catch (error) {
    if (token === generation) status(error.message, true);
  } finally {
    update();
  }
};
$("prev").onclick = () => {
  if (pageIndex > 0) {
    pageIndex--;
    selected = null;
    showPage();
  }
};
$("next").onclick = () => {
  if (source && pageIndex < source.pages.length - 1) {
    pageIndex++;
    selected = null;
    showPage();
  }
};
$("finalMode").onchange = () => {
  showPage();
};
$("pageChecked").onchange = () => {
  if (!source || !viewReady) return;
  if ($("finalMode").checked) {
    $("pageChecked").checked
      ? finalChecks.add(pageIndex)
      : finalChecks.delete(pageIndex);
  } else {
    revision++;
    discardPrepared();
    $("pageChecked").checked
      ? workingChecks.add(pageIndex)
      : workingChecks.delete(pageIndex);
  }
  update();
};
function setCoordinates(r) {
  for (const [id, key] of [
    ["x", "x"],
    ["y", "y"],
    ["w", "width"],
    ["h", "height"],
  ])
    $(id).value = String(Math.round(r[key] * 100) / 100);
}
function coordinates() {
  return {
    x: Number($("x").value),
    y: Number($("y").value),
    width: Number($("w").value),
    height: Number($("h").value),
  };
}
function addArea(rect, hint = "Manually marked area") {
  if (!source || busy || $("finalMode").checked) return;
  const item = {
    id: `P${nextId}`,
    page: pageIndex,
    rect,
    status: "pending",
    reason: "",
    hint,
  };
  try {
    validateMarks([...marks, item], source.pages);
    nextId++;
    marks.push(item);
    selected = item.id;
    setCoordinates(rect);
    $("reason").value = "";
    invalidate();
    populateAreas();
    status(
      "Pending area added. Inspect its bounds and record a decision with a reason.",
    );
  } catch (e) {
    status(e.message, true);
  }
}
$("add").onclick = () => addArea(coordinates());
$("adjust").onclick = () => {
  const m = marks.find((m) => m.id === selected);
  if (!m || busy || $("finalMode").checked) return;
  try {
    const changed = { ...m, rect: coordinates(), status: "pending" };
    validateMarks(
      marks.map((x) => (x === m ? changed : x)),
      source.pages,
    );
    Object.assign(m, changed);
    invalidate();
    populateAreas();
    status("Area adjusted. It needs a fresh decision and review.");
  } catch (e) {
    status(e.message, true);
  }
};
for (const action of ["redact", "keep"])
  $(action).onclick = () => {
    const m = marks.find((m) => m.id === selected);
    if (!m || busy || $("finalMode").checked) return;
    const reason = $("reason").value.trim();
    if (!reason)
      return status("Record a reason before deciding this area.", true);
    m.status = action;
    m.reason = reason;
    invalidate();
    populateAreas();
    status(`Area ${m.id} set to ${action}. Page checks and final copy reset.`);
  };
$("reason").oninput = () => {
  const m = marks.find((m) => m.id === selected);
  if (m && !busy && !$("finalMode").checked) {
    m.reason = $("reason").value;
    invalidate();
    populateAreas();
  }
};
$("remove").onclick = () => {
  if (busy || $("finalMode").checked) return;
  marks = marks.filter((m) => m.id !== selected);
  selected = null;
  invalidate();
  populateAreas();
  status(
    "Area removed. The original appearance is restored there unless another area overlaps it.",
  );
};
function point(e) {
  const r = $("overlay").getBoundingClientRect(),
    p = source.pages[pageIndex];
  return {
    x: Math.max(
      0,
      Math.min(p.width, ((e.clientX - r.left) / r.width) * p.width),
    ),
    y: Math.max(
      0,
      Math.min(p.height, ((e.clientY - r.top) / r.height) * p.height),
    ),
  };
}
function dragRect(d) {
  return {
    x: Math.min(d.start.x, d.end.x),
    y: Math.min(d.start.y, d.end.y),
    width: Math.abs(d.end.x - d.start.x),
    height: Math.abs(d.end.y - d.start.y),
  };
}
$("overlay").onpointerdown = (e) => {
  if (!source || busy || !viewReady || $("finalMode").checked) return;
  drag = { start: point(e), end: point(e) };
  $("overlay").setPointerCapture(e.pointerId);
};
$("overlay").onpointermove = (e) => {
  if (drag) {
    drag.end = point(e);
    paintOverlay();
  }
};
$("overlay").onpointerup = (e) => {
  if (!drag) return;
  drag.end = point(e);
  const r = dragRect(drag);
  drag = null;
  if (r.width > 1 && r.height > 1) addArea(r);
  paintOverlay();
};
$("overlay").onpointercancel = () => {
  drag = null;
  paintOverlay();
};
$("find").onclick = () => {
  if (!source || busy) return;
  const term = $("search").value.trim().toLocaleLowerCase();
  if (!term) return status("Enter exact text to find.", true);
  $("results").replaceChildren();
  let count = 0;
  for (let page = 0; page < source.pages.length; page++)
    for (const f of source.pages[page].fragments)
      if (f.text.toLocaleLowerCase().includes(term)) {
        if (++count > 100) continue;
        const row = document.createElement("div");
        row.className = "result";
        const text = document.createElement("p");
        text.textContent = `Page ${page + 1}: ${f.text}`;
        const b = document.createElement("button");
        b.textContent = f.rect
          ? "Mark whole fragment"
          : "Use manual area for this fragment";
        b.disabled = !f.rect;
        b.onclick = async () => {
          if (busy) return;
          if ($("finalMode").checked) {
            invalidate(false);
          }
          $("finalMode").checked = false;
          pageIndex = page;
          await showPage();
          addArea({ ...f.rect }, `Search result: ${f.text}`);
        };
        row.append(text, b);
        $("results").append(row);
      }
  status(
    `${count} matching fragments found${count > 100 ? "; only the first 100 are shown. Use a more specific phrase" : ""}. Text in images is not searched.`,
  );
};
for (const id of ["caseRef", "reviewer", "checker"])
  $(id).oninput = () => invalidate(false);
for (const id of ["imageAccepted", "reviewComplete", "authorised"])
  $(id).onchange = () => {
    revision++;
    discardPrepared();
    update();
  };
$("return").onclick = () => {
  invalidate();
  showPage();
  status(
    "Editable working review reopened. Change areas as needed, then check again and prepare a fresh final PDF.",
  );
};
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  urls.add(url);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    urls.delete(url);
  }, 30000);
}
$("save").onclick = () => {
  if (!source || busy) return;
  try {
    const plan = JSON.stringify(
      savePdfReview(source, marks, fields()),
      null,
      2,
    );
    if (new TextEncoder().encode(plan).length > PDF_LIMITS.plan)
      throw new Error("Working review exceeds 2 MB.");
    download(plan, "internal-pdf-working-review.json", "application/json");
    status(
      "Internal working review saved without source PDF bytes or text excerpts. Keep the unchanged original separately.",
    );
  } catch (e) {
    status(e.message, true);
  }
};
$("resume").onchange = async () => {
  const file = $("resume").files[0];
  if (!file || !source || busy) return;
  const token = generation;
  invalidate();
  const rev = revision;
  try {
    if (file.size > PDF_LIMITS.plan)
      throw new Error("Saved reviews must be no larger than 2 MB.");
    const restored = restorePdfReview(JSON.parse(await file.text()), source);
    if (token !== generation || rev !== revision) return;
    marks = restored.marks;
    nextId = Math.max(0, ...marks.map((m) => Number(m.id.slice(1)))) + 1;
    selected = null;
    for (const id of ["caseRef", "reviewer", "checker"])
      $(id).value = restored.fields[id];
    populateAreas();
    update();
    paintOverlay();
    status(
      "Working areas restored against the matching PDF. All page confirmations and release declarations must be repeated.",
    );
  } catch (e) {
    if (token === generation) status(`Could not resume: ${e.message}`, true);
  } finally {
    $("resume").value = "";
  }
};
$("prepare").onclick = async () => {
  if (!ready()) return;
  discardPrepared();
  busy = true;
  update();
  const token = generation,
    rev = revision;
  const snapshot = structuredClone(marks);
  const check = () => {
    if (token !== generation || rev !== revision)
      throw new Error(
        "The working review changed during preparation. No release copy was retained.",
      );
  };
  try {
    const output = await buildRelease(source, snapshot, {
      check,
      progress: (i, n) =>
        status(`Preparing and verifying page ${i + 1} of ${n}…`),
    });
    check();
    prepared = { ...output, revision: rev, marks: snapshot };
    $("finalMode").checked = true;
    status(
      "Final PDF prepared from redacted pixels and verified for page sizes, empty text layers and absent annotations. Inspect every actual final page before downloading.",
    );
  } catch (e) {
    if (token === generation) {
      discardPrepared();
      status(e.message, true);
    }
  } finally {
    if (token === generation) {
      busy = false;
      update();
      await showPage();
    }
  }
};
$("download").onclick = () => {
  if (!releaseReady()) return;
  download(prepared.bytes, "checked-redacted.pdf", "application/pdf");
  status(
    "Checked final PDF downloaded. Keep the working review internally if further revisions are needed.",
  );
};
$("report").onclick = () => {
  if (!releaseReady()) return;
  const record = {
    schema: "emote-pdf-release-record/1",
    version: PDF_VERSION,
    createdAt: new Date().toISOString(),
    sourceSha256: source.sourceHash,
    outputSha256: prepared.sha256,
    fields: fields(),
    reviewerIdentity: "Self-declared, not authenticated",
    pageDimensions: source.pages.map(({ width, height }) => ({
      width,
      height,
    })),
    decisions: prepared.marks.map(({ id, page, rect, status, reason }) => ({
      id,
      page: page + 1,
      rect,
      status,
      reason,
    })),
    verification: {
      freshRasterPdf: true,
      resolutionDpi: 144,
      noTextLayer: true,
      noAnnotations: true,
      noAttachments: true,
      workingPagesConfirmed: workingChecks.size,
      finalPagesConfirmed: finalChecks.size,
    },
    scope:
      "Image-only evaluation copy. No guarantee all sensitive content was identified. Retained page content is rasterised; text search and accessibility tags are lost.",
  };
  download(
    JSON.stringify(record, null, 2),
    "internal-pdf-decision-record.json",
    "application/json",
  );
};
window.addEventListener("beforeunload", (e) => {
  if (source) {
    e.preventDefault();
    e.returnValue = "";
  }
});
update();
