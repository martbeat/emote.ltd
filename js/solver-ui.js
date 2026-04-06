import {
  normaliseWord,
  decodePattern,
  encodePatternString,
  filterCandidates,
  rankGuesses,
  chooseGuessPool,
  clearSolveMemo,
  validateGuessPattern,
  buildDefaultHistoryState
} from "./solver-core.module.js?v=20260406";
import { loadWordLists } from "./wordlists.js?v=20260406";

const state = {
  answers: [],
  guesses: [],
  words: [],
  candidates: [],
  history: [],
  worker: null,
  nextRequestId: 1,
  pending: new Map(),
  lastRanking: [],
  workerReady: false,
  answerMode: "hard"
};
const SOLVER_ASSET_VERSION = "20260406";

const ui = {
  status: document.getElementById("status"),
  guessInput: document.getElementById("guessInput"),
  patternInput: document.getElementById("patternInput"),
  modeSelect: document.getElementById("modeSelect"),
  answerMode: document.getElementById("answerMode"),
  applyBtn: document.getElementById("applyBtn"),
  recalcBtn: document.getElementById("recalcBtn"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  remainingCount: document.getElementById("remainingCount"),
  bestGuess: document.getElementById("bestGuess"),
  bestEntropy: document.getElementById("bestEntropy"),
  bestExpected: document.getElementById("bestExpected"),
  poolSize: document.getElementById("poolSize"),
  bestGuessTiles: document.getElementById("bestGuessTiles"),
  historyBody: document.querySelector("#historyTable tbody"),
  rankingBody: document.querySelector("#rankingTable tbody"),
  openingWordInput: document.getElementById("openingWordInput"),
  simulationCountInput: document.getElementById("simulationCountInput"),
  simulationModeSelect: document.getElementById("simulationModeSelect"),
  simulateBtn: document.getElementById("simulateBtn"),
  simulationOutput: document.getElementById("simulationOutput"),
  answerCount: document.getElementById("answerCount"),
  guessCount: document.getElementById("guessCount"),
  sourceName: document.getElementById("sourceName"),
  answerModeLabel: document.getElementById("answerModeLabel")
};

function setStatus(message, kind = "info") {
  ui.status.textContent = message;
  ui.status.dataset.kind = kind;
}


function getAnswerModeLabel(mode) {
  if (mode === "official") return "Official";
  if (mode === "fair") return "Fair";
  return "Hard";
}

function getGuessPool() {
  return state.answerMode === "hard" ? state.candidates : state.guesses;
}

function renderTiles(word) {
  ui.bestGuessTiles.innerHTML = "";
  if (!word) return;
  for (const ch of word) {
    const span = document.createElement("span");
    span.className = "tile";
    span.textContent = ch.toUpperCase();
    ui.bestGuessTiles.appendChild(span);
  }
}

function renderHistory() {
  ui.historyBody.innerHTML = "";
  state.history.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="mono">${item.guess}</td>
      <td class="mono">${item.pattern}</td>
      <td>${item.remaining}</td>
    `;
    ui.historyBody.appendChild(tr);
  });
}

function renderRanking(rows) {
  ui.rankingBody.innerHTML = "";
  for (const [index, row] of rows.entries()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="mono">${row.guess}</td>
      <td>${row.entropy.toFixed(3)}</td>
      <td>${row.expectedLeft.toFixed(2)}</td>
      <td>${row.worstCase}</td>
      <td>${row.isCandidate ? "yes" : "no"}</td>
    `;
    ui.rankingBody.appendChild(tr);
  }
}

function updateStats(best = null, poolSize = 0) {
  ui.remainingCount.textContent = String(state.candidates.length);
  ui.poolSize.textContent = String(poolSize || 0);
  ui.answerCount.textContent = String(state.answers.length);
  ui.guessCount.textContent = String(state.guesses.length);
  ui.answerModeLabel.textContent = getAnswerModeLabel(state.answerMode);

  if (!best) {
    ui.bestGuess.textContent = "-";
    ui.bestEntropy.textContent = "-";
    ui.bestExpected.textContent = "-";
    renderTiles("");
    return;
  }

  ui.bestGuess.textContent = best.guess;
  ui.bestEntropy.textContent = best.entropy.toFixed(3);
  ui.bestExpected.textContent = best.expectedLeft.toFixed(2);
  renderTiles(best.guess);
}

function createWorker() {
  if (state.worker) state.worker.terminate();
  state.workerReady = false;
  state.worker = new Worker(`./js/solver-worker.js?v=${SOLVER_ASSET_VERSION}`, { type: "module" });

  state.worker.onmessage = (event) => {
    const { type, requestId, result, error } = event.data || {};
    if (type === "error") {
      const pending = state.pending.get(requestId);
      if (pending) {
        pending.reject(new Error(error));
        state.pending.delete(requestId);
      } else {
        setStatus(error || "Worker error.", "error");
      }
      return;
    }

    const pending = state.pending.get(requestId);
    if (pending) {
      pending.resolve(result);
      state.pending.delete(requestId);
    }
  };
}

function callWorker(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const requestId = state.nextRequestId++;
    state.pending.set(requestId, { resolve, reject });
    state.worker.postMessage({ type, requestId, ...payload });
  });
}

async function recalcRecommendations() {
  if (!state.answers.length || !state.guesses.length) {
    setStatus("Word lists are not loaded yet.", "warn");
    return;
  }

  if (state.candidates.length === 0) {
    state.lastRanking = [];
    renderRanking([]);
    updateStats(null, 0);
    setStatus("No candidates remain. The clues conflict with each other.", "warn");
    return;
  }

  if (state.candidates.length === 1) {
    const only = {
      guess: state.candidates[0],
      entropy: 0,
      expectedLeft: 1,
      worstCase: 1,
      isCandidate: true
    };
    state.lastRanking = [only];
    renderRanking([only]);
    updateStats(only, 1);
    setStatus("One candidate remains.", "ok");
    return;
  }

  setStatus("Calculating recommendations…", "working");
  const forceMode = state.answerMode === "hard" ? "candidates" : ui.modeSelect.value;
  const guessPool = getGuessPool();
  let result = null;
  if (state.workerReady) {
    result = await callWorker("rank", {
      candidates: state.candidates,
      guesses: guessPool,
      limit: 10,
      history: state.history,
      forceMode
    });
  } else {
    const pool = chooseGuessPool(state.candidates, guessPool, undefined, forceMode);
    result = {
      top: rankGuesses(state.candidates, guessPool, 10, state.history, forceMode),
      poolSize: pool.length
    };
    setStatus("Worker unavailable; used local fallback ranking.", "warn");
  }

  state.lastRanking = result.top || [];
  renderRanking(state.lastRanking);
  updateStats(state.lastRanking[0] || null, result.poolSize || 0);

  const best = state.lastRanking[0];
  setStatus(
    best
      ? `Best guess is ${best.guess} using ${result.poolSize} ranked options.`
      : "No recommendation available.",
    "ok"
  );
}

function resetState() {
  clearSolveMemo();
  if (state.answerMode === "official") {
    state.candidates = [...state.answers];
  }

  if (state.answerMode === "fair") {
    state.candidates = [...state.guesses];
  }

  if (state.answerMode === "hard") {
    state.candidates = [...state.answers];
  }

  const next = buildDefaultHistoryState(state.candidates);
  state.history = next.history;
  ui.simulationOutput.innerHTML = "";
}

async function applyClue() {
  const guess = normaliseWord(ui.guessInput.value);
  const pattern = normaliseWord(ui.patternInput.value);
  const validation = validateGuessPattern(guess, pattern, state.answers, state.guesses);
  if (validation) {
    setStatus(validation, "error");
    return;
  }

  const encoded = encodePatternString(pattern);
  state.candidates = filterCandidates(state.candidates, guess, encoded);
  state.history.push({
    guess,
    pattern: decodePattern(encoded),
    remaining: state.candidates.length
  });

  ui.guessInput.value = "";
  ui.patternInput.value = "";
  renderHistory();
  await recalcRecommendations();
}

async function undoClue() {
  if (!state.history.length) return;
  const nextHistory = state.history.slice(0, -1);
  resetState();
  state.history = nextHistory;

  for (const step of state.history) {
    state.candidates = filterCandidates(state.candidates, step.guess, encodePatternString(step.pattern));
    step.remaining = state.candidates.length;
  }

  renderHistory();
  await recalcRecommendations();
}

async function runSimulation() {
  const openingWord = normaliseWord(ui.openingWordInput.value || ui.bestGuess.textContent);
  const sampleSize = Number(ui.simulationCountInput.value || 100);
  const forceMode = ui.simulationModeSelect.value;

  if (!openingWord || !state.guesses.includes(openingWord)) {
    setStatus("Choose a valid opening word before running a simulation.", "error");
    return;
  }

  setStatus("Running simulation…", "working");
  ui.simulationOutput.innerHTML = "<p>Running simulation…</p>";

  const result = await callWorker("simulate", {
    openingWord,
    sampleSize,
    forceMode
  });

  const distributionRows = result.distribution
    .map(([guesses, count]) => {
      const label = guesses > 6 ? "7+" : String(guesses);
      return `<tr><td>${label}</td><td>${count}</td></tr>`;
    })
    .join("");

  const hardestRows = result.hardest
    .map(item => `<tr><td class="mono">${item.answer}</td><td>${item.guesses}</td></tr>`)
    .join("");

  ui.simulationOutput.innerHTML = `
    <div class="stats small-gap">
      <div class="stat"><div class="k">Opening word</div><div class="v mono">${result.openingWord}</div></div>
      <div class="stat"><div class="k">Sample tested</div><div class="v">${result.sampleSize}</div></div>
      <div class="stat"><div class="k">Average guesses</div><div class="v">${result.average.toFixed(2)}</div></div>
      <div class="stat"><div class="k">Over 6 guesses</div><div class="v">${result.failures}</div></div>
    </div>
    <div class="two-cols">
      <div>
        <h4>Distribution</h4>
        <table class="table">
          <thead><tr><th>Guesses</th><th>Count</th></tr></thead>
          <tbody>${distributionRows}</tbody>
        </table>
      </div>
      <div>
        <h4>Hardest sampled answers</h4>
        <table class="table">
          <thead><tr><th>Answer</th><th>Guesses</th></tr></thead>
          <tbody>${hardestRows}</tbody>
        </table>
      </div>
    </div>
  `;

  setStatus(`Simulation completed for opening word ${result.openingWord}.`, "ok");
}

async function initialise() {
  try {
    setStatus("Loading word lists…", "working");
    const loaded = await loadWordLists();
    state.words = loaded.words;
    state.answers = loaded.answers;
    state.guesses = loaded.guesses;
    ui.sourceName.textContent = loaded.source || "WORDS / local cache / remote list";
    state.answerMode = ui.answerMode.value || "hard";
    resetState();
    renderHistory();

    setStatus("Initializing solver worker…", "working");
    createWorker();
    const initResult = await callWorker("init", {
      answers: state.answers,
      guesses: state.guesses
    });
    state.workerReady = true;
    ui.openingWordInput.value = "slate";

    setStatus(
      `Loaded ${initResult.answers} answers and ${initResult.guesses} allowed guesses.`,
      "ok"
    );
    await recalcRecommendations();
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : String(err), "error");
  }
}

ui.applyBtn.addEventListener("click", () => applyClue().catch(err => setStatus(err.message, "error")));
ui.recalcBtn.addEventListener("click", () => recalcRecommendations().catch(err => setStatus(err.message, "error")));
ui.undoBtn.addEventListener("click", () => undoClue().catch(err => setStatus(err.message, "error")));
ui.resetBtn.addEventListener("click", () => {
  resetState();
  renderHistory();
  recalcRecommendations().catch(err => setStatus(err.message, "error"));
});
ui.simulateBtn.addEventListener("click", () => runSimulation().catch(err => setStatus(err.message, "error")));
ui.answerMode.addEventListener("change", () => {
  state.answerMode = ui.answerMode.value;
  resetState();
  renderHistory();
  recalcRecommendations().catch(err => setStatus(err.message, "error"));
});

ui.patternInput.addEventListener("input", (e) => {
  e.target.value = normaliseWord(e.target.value).replace(/[^byg]/g, "").slice(0, 5);
});
ui.guessInput.addEventListener("input", (e) => {
  e.target.value = normaliseWord(e.target.value).replace(/[^a-z]/g, "").slice(0, 5);
});
ui.openingWordInput.addEventListener("input", (e) => {
  e.target.value = normaliseWord(e.target.value).replace(/[^a-z]/g, "").slice(0, 5);
});

initialise();
