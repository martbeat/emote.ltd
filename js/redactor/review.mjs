import {
  VERSION,
  LIMITS,
  normaliseText,
  detect,
  findLiteral,
  overlap,
  applyDecisions,
  canRelease,
  importDocx,
  buildDocx,
  hash,
  readZip,
} from "./core.mjs";
const $ = (id) => document.getElementById(id),
  encoder = new TextEncoder();
let state = {
    text: "",
    decisions: [],
    sourceHash: "",
    warnings: [],
    revision: 0,
    nextId: 1,
    started: null,
  },
  epoch = 0,
  page = 0,
  busy = false;
const selected = new Set();
function status(message) {
  $("status").textContent = message;
}
function review() {
  return {
    caseRef: $("caseRef").value,
    reviewer: $("reviewer").value,
    checker: $("checker").value,
    complete: $("complete").checked,
    output: $("outputCheck").checked,
    authorised: $("authorised").checked,
  };
}
function invalidate() {
  state.revision++;
  for (const id of ["complete", "outputCheck", "authorised"])
    $(id).checked = false;
  gate();
}
function gate() {
  const ok = !busy && canRelease(state.text, state.decisions, review());
  for (const id of ["docx", "txt", "audit"]) $(id).disabled = !ok;
  $("gate").textContent = ok
    ? "Review declarations complete. Evaluation exports are enabled."
    : "Export requires a source, a decision and reason for every suggestion, a case reference, two different names and all three checks.";
}
function render() {
  $("source").value = state.text;
  $("output").value = state.text
    ? applyDecisions(state.text, state.decisions)
    : "";
  const pending = state.decisions.filter((d) => d.status === "pending").length;
  $("counts").textContent =
    `${state.decisions.length} decisions · ${pending} pending`;
  const filtered = state.decisions
    .filter(
      (d) => $("filter").value === "all" || d.status === $("filter").value,
    )
    .sort((a, b) => a.start - b.start);
  page = Math.max(0, Math.min(page, Math.ceil(filtered.length / 100) - 1));
  const visible = filtered.slice(page * 100, page * 100 + 100);
  $("decisions").replaceChildren();
  for (const d of visible) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(d.id);
    cb.setAttribute("aria-label", `Select ${d.id}`);
    cb.addEventListener("change", () => {
      cb.checked ? selected.add(d.id) : selected.delete(d.id);
      selectionGate();
    });
    cell.append(cb);
    row.append(cell);
    for (const value of [
      `${d.id} · ${d.type}`,
      state.text.slice(Math.max(0, d.start - 30), d.start) +
        "【" +
        state.text.slice(d.start, d.end) +
        "】" +
        state.text.slice(d.end, d.end + 30),
      d.status,
      d.reason || "Reason required",
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      row.append(td);
    }
    row.children[3].className = `decision-${d.status}`;
    $("decisions").append(row);
  }
  if (!visible.length) {
    const row = document.createElement("tr"),
      cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent =
      "No decisions in this view. Read the entire source and mark anything the suggestions missed.";
    row.append(cell);
    $("decisions").append(row);
  }
  $("selectAll").checked =
    visible.length > 0 && visible.every((d) => selected.has(d.id));
  $("selectAll").onchange = () => {
    for (const d of visible)
      $("selectAll").checked ? selected.add(d.id) : selected.delete(d.id);
    render();
  };
  $("pageInfo").textContent =
    `${filtered.length ? page * 100 + 1 : 0}–${Math.min(page * 100 + 100, filtered.length)} of ${filtered.length} decisions · ${selected.size} selected across all views`;
  $("previous").disabled = page === 0;
  $("next").disabled = (page + 1) * 100 >= filtered.length;
  const residual = state.text ? detect($("output").value).length : 0;
  $("residual").textContent = state.text
    ? `${residual} identifier pattern(s) remain in the proposed output, including any you chose to keep. Zero matches does not establish that all sensitive information has been removed.`
    : "Pattern checks are an aid, not a clearance to disclose.";
  for (const id of ["mark", "find"]) $(id).disabled = !state.text || busy;
  selectionGate();
  gate();
}
function selectionGate() {
  for (const id of ["redact", "keep", "remove"])
    $(id).disabled = !selected.size || busy;
}
function reset() {
  epoch++;
  state = {
    text: "",
    decisions: [],
    sourceHash: "",
    warnings: [],
    revision: 0,
    nextId: 1,
    started: null,
  };
  selected.clear();
  page = 0;
  for (const id of [
    "paste",
    "file",
    "term",
    "reason",
    "caseRef",
    "reviewer",
    "checker",
  ])
    $(id).value = "";
  $("warnings").hidden = true;
  $("warnings").textContent = "";
  $("sourceInfo").textContent = "";
  invalidate();
  render();
}
async function load(text, bytes, warnings = [], token) {
  text = normaliseText(text);
  const suggestions = detect(text),
    sourceHash = await hash(bytes);
  if (token !== epoch) return;
  state = {
    text,
    decisions: suggestions.map((d, i) => ({ ...d, id: `R${i + 1}` })),
    sourceHash,
    warnings,
    revision: 1,
    nextId: suggestions.length + 1,
    started: new Date().toISOString(),
  };
  selected.clear();
  page = 0;
  $("warnings").hidden = !warnings.length;
  $("warnings").textContent = warnings.join("\n");
  $("sourceInfo").textContent =
    `${text.length.toLocaleString()} characters · Source SHA-256: ${sourceHash}`;
  invalidate();
  render();
  status(
    "Source loaded. Review suggestions, then read the entire text for anything missed.",
  );
}
function wrap(fn) {
  return async () => {
    try {
      await fn();
    } catch (e) {
      status(e.message || "Operation failed.");
    }
  };
}
$("loadText").onclick = wrap(async () => {
  const text = $("paste").value;
  reset();
  busy = true;
  const token = epoch;
  try {
    await load(text, encoder.encode(text), [], token);
  } finally {
    busy = false;
    render();
  }
});
$("file").onchange = wrap(async () => {
  const file = $("file").files[0];
  if (!file) return;
  reset();
  busy = true;
  const token = epoch;
  status("Checking Word document…");
  try {
    if (!/\.docx$/i.test(file.name))
      throw new Error(
        "Only .docx is supported. Convert legacy .doc using an approved application.",
      );
    if (file.size > LIMITS.file)
      throw new Error("The file exceeds the 12 MB pilot limit.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const imported = await importDocx(bytes);
    await load(imported.text, bytes, imported.warnings, token);
  } finally {
    busy = false;
    render();
  }
});
$("paste").oninput = () => {
  if (state.text) {
    const value = $("paste").value;
    reset();
    $("paste").value = value;
    status(
      "Source entry changed. The previous review has been cleared. Start a new text review when ready.",
    );
  }
};
function add(ranges, type) {
  if (state.decisions.length + ranges.length > LIMITS.decisions)
    throw new Error(
      "Too many matches. Use a longer phrase or split the source.",
    );
  let count = 0;
  for (const r of ranges) {
    if (!state.decisions.some((d) => overlap(d, r))) {
      if (state.decisions.length >= LIMITS.decisions)
        throw new Error("Decision limit reached. Split the source.");
      state.decisions.push({
        ...r,
        type,
        status: "pending",
        reason: "",
        id: `R${state.nextId++}`,
      });
      count++;
    }
  }
  invalidate();
  render();
  status(
    `${count} suggestion(s) added. Overlaps with existing decisions were skipped. Remove an overlapping decision first if you need a larger passage.`,
  );
}
$("find").onclick = wrap(() =>
  add(findLiteral(state.text, $("term").value), "Custom phrase"),
);
$("mark").onclick = wrap(() => {
  const start = $("source").selectionStart,
    end = $("source").selectionEnd;
  if (start === end)
    throw new Error("Select a passage in the source text first.");
  add([{ start, end }], "Selected passage");
});
for (const action of ["redact", "keep"])
  $(action).onclick = wrap(() => {
    const reason = $("reason").value.trim();
    if (!reason) throw new Error("Enter a reason for the selected decisions.");
    for (const d of state.decisions)
      if (selected.has(d.id)) {
        d.status = action;
        d.reason = reason;
      }
    selected.clear();
    invalidate();
    render();
    status("Decisions updated. Final checks reset.");
  });
$("remove").onclick = () => {
  state.decisions = state.decisions.filter((d) => !selected.has(d.id));
  selected.clear();
  invalidate();
  render();
  status(
    "Decisions removed. Their original text is present in the output again.",
  );
};
$("filter").onchange = () => {
  page = 0;
  render();
};
$("previous").onclick = () => {
  page--;
  render();
};
$("next").onclick = () => {
  page++;
  render();
};
for (const id of ["caseRef", "reviewer", "checker"])
  $(id).oninput = () => {
    invalidate();
  };
for (const id of ["complete", "outputCheck", "authorised"])
  $(id).onchange = gate;
$("clear").onclick = () => {
  reset();
  status(
    "Session cleared. Downloads already saved on your device are not deleted.",
  );
};
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function exportFile(kind) {
  if (!canRelease(state.text, state.decisions, review()) || busy)
    throw new Error("Complete the review before exporting.");
  const revision = state.revision,
    token = epoch,
    r = review(),
    output = applyDecisions(state.text, state.decisions),
    decisions = structuredClone(state.decisions),
    sourceHash = state.sourceHash,
    warnings = [...state.warnings],
    started = state.started;
  busy = true;
  gate();
  try {
    const txt = encoder.encode(output),
      docx = buildDocx(output),
      files = await readZip(docx);
    if (
      files.size !== 3 ||
      ![...files.keys()].every((n) =>
        ["[Content_Types].xml", "_rels/.rels", "word/document.xml"].includes(n),
      )
    )
      throw new Error("Output package validation failed.");
    const xml = new DOMParser().parseFromString(
      new TextDecoder().decode(files.get("word/document.xml")),
      "application/xml",
    );
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const roundTrip = [...xml.getElementsByTagNameNS(W, "p")]
      .map((p) =>
        [...p.getElementsByTagName("*")]
          .filter(
            (n) => n.namespaceURI === W && ["t", "tab"].includes(n.localName),
          )
          .map((n) => (n.localName === "tab" ? "\t" : n.textContent))
          .join(""),
      )
      .join("\n");
    if (xml.getElementsByTagName("parsererror").length || roundTrip !== output)
      throw new Error("Export text verification failed. No download created.");
    const textHash = await hash(txt),
      docxHash = await hash(docx);
    if (
      token !== epoch ||
      revision !== state.revision ||
      JSON.stringify(r) !== JSON.stringify(review())
    )
      throw new Error(
        "The review changed during export. Recheck before downloading.",
      );
    const record = {
      toolVersion: VERSION,
      exportedAt: new Date().toISOString(),
      startedAt: started,
      caseRef: r.caseRef,
      reviewer: r.reviewer,
      checker: r.checker,
      declarations: r,
      identityVerification: "Self-declared names, not authenticated signatures",
      sourceSha256: sourceHash,
      textSha256: textHash,
      docxSha256: docxHash,
      revision,
      warnings,
      checks: {
        cleanPackage: true,
        exportTextRoundTrip: true,
        residualPatternCount: detect(output).length,
      },
      decisions: decisions.map(({ id, start, end, type, status, reason }) => ({
        id,
        start,
        end,
        type,
        status,
        reason,
      })),
      scope:
        "Text reconstruction; no layout preservation. Not an assurance that all sensitive content was identified.",
    };
    if (kind === "docx")
      download(
        docx,
        "redacted-copy.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    if (kind === "txt")
      download(txt, "redacted-copy.txt", "text/plain;charset=utf-8");
    if (kind === "audit")
      download(
        JSON.stringify(record, null, 2),
        "internal-decision-record.json",
        "application/json",
      );
    status(
      "Export created and its text verified. Save the internal decision record separately and inspect the downloaded copy.",
    );
  } finally {
    busy = false;
    gate();
  }
}
for (const kind of ["docx", "txt", "audit"])
  $(kind).onclick = wrap(() => exportFile(kind));
window.addEventListener("beforeunload", (e) => {
  if (state.text) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("version").textContent = VERSION;
render();
