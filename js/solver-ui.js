import "./solver-core.module.js?v=20260411.1";
import { loadWordLists } from "./wordlists.js?v=20260406.3";

const {
  normaliseWord,
  decodePattern,
  encodePatternString,
  scoreGuessEncoded,
  filterCandidates,
  rankGuesses,
  chooseGuessPool,
  clearSolveMemo,
  validateGuessPattern,
  buildDefaultHistoryState
} = globalThis.SolverCore || {};

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
const SOLVER_ASSET_VERSION = "20260411.1";

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
  martinSolutionInput: document.getElementById("martinSolutionInput"),
  martinSimulateBtn: document.getElementById("martinSimulateBtn"),
  martinSimulationOutput: document.getElementById("martinSimulationOutput"),
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
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  for (const [index, row] of safeRows.entries()) {
    const guess = row.guess || row.word || "-";
    const entropy = Number.isFinite(row.entropy) ? row.entropy : 0;
    const expectedLeft = Number.isFinite(row.expectedLeft) ? row.expectedLeft : 0;
    const worstCase = Number.isFinite(row.worstCase) ? row.worstCase : 0;
    const isCandidate = Boolean(row.isCandidate);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="mono">${guess}</td>
      <td>${entropy.toFixed(3)}</td>
      <td>${expectedLeft.toFixed(2)}</td>
      <td>${worstCase}</td>
      <td>${isCandidate ? "yes" : "no"}</td>
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

  const bestGuess = best.guess || best.word || "-";
  ui.bestGuess.textContent = bestGuess;
  ui.bestEntropy.textContent = Number.isFinite(best.entropy) ? best.entropy.toFixed(3) : "-";
  ui.bestExpected.textContent = Number.isFinite(best.expectedLeft) ? best.expectedLeft.toFixed(2) : "-";
  renderTiles(bestGuess === "-" ? "" : bestGuess);
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
  ui.martinSimulationOutput.innerHTML = "";
}

function getBaseCandidatesForMode() {
  if (state.answerMode === "fair") return [...state.guesses];
  return [...state.answers];
}

function countVowelHits(guess, patternCode) {
  const pattern = decodePattern(patternCode);
  let hits = 0;
  for (let i = 0; i < 5; i++) {
    if ("aeiou".includes(guess[i]) && pattern[i] !== "b") {
      hits++;
    }
  }
  return hits;
}

function pickCandidateAvoidingGreens(candidates, greenLetters, used) {
  if (!Array.isArray(candidates) || !candidates.length) return "";
  const filtered = candidates.filter((word) => {
    if (used.has(word)) return false;
    for (const ch of word) {
      if (greenLetters.has(ch)) return false;
    }
    return true;
  });
  if (filtered.length) return filtered[0];
  return candidates.find(word => !used.has(word)) || candidates[0];
}

function pickProbeGuessIgnoringGreens(guessPool, candidates, greenLetters, used) {
  if (!Array.isArray(guessPool) || !guessPool.length) return "";
  const remaining = Array.isArray(candidates) ? candidates : [];
  const candidateSet = new Set(remaining);

  const scoreWord = (word) => {
    const seen = new Set();
    let score = 0;
    for (const candidate of remaining) {
      for (const ch of word) {
        if (seen.has(`${candidate}|${ch}`)) continue;
        if (candidate.includes(ch)) {
          score++;
          seen.add(`${candidate}|${ch}`);
        }
      }
    }
    return score;
  };

  const available = guessPool.filter(word => !used.has(word));
  if (!available.length) return "";

  const noGreen = available.filter((word) => {
    for (const ch of word) {
      if (greenLetters.has(ch)) return false;
    }
    return true;
  });

  const ranked = (noGreen.length ? noGreen : available).map(word => ({
    word,
    score: scoreWord(word),
    isCandidate: candidateSet.has(word)
  }));

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isCandidate !== b.isCandidate) return a.isCandidate ? 1 : -1;
    return a.word.localeCompare(b.word);
  });

  return ranked[0]?.word || "";
}

async function runMartinSimulation() {
  const solution = normaliseWord(ui.martinSolutionInput.value);
  const validTargets = state.answerMode === "fair" ? state.guesses : state.answers;
  if (!solution || !validTargets.includes(solution)) {
    ui.martinSimulationOutput.innerHTML = "<p class=\"subtle\">Enter a valid 5-letter target word, then run the simulation.</p>";
    setStatus("Enter a valid target word from the loaded lists.", "error");
    return;
  }

  ui.martinSimulationOutput.innerHTML = "<p>Running Martin simulation…</p>";

  let candidates = getBaseCandidatesForMode();
  const used = new Set();
  const steps = [];
  const greenLetters = new Set();

  const commitStep = (guess) => {
    const patternCode = scoreGuessEncoded(guess, solution);
    const pattern = decodePattern(patternCode);
    candidates = filterCandidates(candidates, guess, patternCode);
    used.add(guess);

    for (let i = 0; i < 5; i++) {
      if (pattern[i] === "g") {
        greenLetters.add(guess[i]);
      }
    }

    steps.push({
      guess,
      pattern,
      remaining: candidates.length
    });

    return pattern;
  };

  let guess = "tales";
  if (!state.guesses.includes(guess)) {
    setStatus("Martin opener 'tales' is not in the allowed guess list.", "error");
    return;
  }

  for (let turn = 1; turn <= 8; turn++) {
    const pattern = commitStep(guess);
    if (guess === solution || pattern === "ggggg") break;
    if (candidates.length <= 1) {
      guess = candidates[0] || solution;
      continue;
    }

    if (turn === 1) {
      const vowelHits = countVowelHits(guess, encodePatternString(pattern));
      guess = vowelHits >= 2 ? "chink" : "proud";
      if (!state.guesses.includes(guess)) {
        guess = candidates[0];
      }
      continue;
    }

    if (candidates.length <= 2) {
      guess = candidates.find(word => !used.has(word)) || candidates[0] || solution;
      continue;
    }

    if (candidates.length > 2) {
      guess = pickProbeGuessIgnoringGreens(state.guesses, candidates, greenLetters, used);
      if (!guess) {
        guess = pickCandidateAvoidingGreens(candidates, greenLetters, used);
      }
      continue;
    }

    guess = candidates.find(word => !used.has(word)) || candidates[0];
  }

  const solved = steps.length && steps[steps.length - 1].guess === solution;
  const rows = steps
    .map((step, index) => `<tr><td>${index + 1}</td><td class="mono">${step.guess}</td><td class="mono">${step.pattern}</td><td>${step.remaining}</td></tr>`)
    .join("");

  ui.martinSimulationOutput.innerHTML = `
    <div class="stats small-gap">
      <div class="stat"><div class="k">Target solution</div><div class="v mono">${solution}</div></div>
      <div class="stat"><div class="k">Solved</div><div class="v">${solved ? "Yes" : "No"}</div></div>
      <div class="stat"><div class="k">Guesses used</div><div class="v">${steps.length}</div></div>
      <div class="stat"><div class="k">Final candidates</div><div class="v">${steps.length ? steps[steps.length - 1].remaining : candidates.length}</div></div>
    </div>
    <h4 style="margin-top:16px;">Guess path</h4>
    <table class="table">
      <thead><tr><th>#</th><th>Guess</th><th>Pattern</th><th>Remaining</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  setStatus(
    solved
      ? `Martin simulation solved ${solution} in ${steps.length} guesses.`
      : `Martin simulation finished without solving ${solution} after ${steps.length} guesses.`,
    solved ? "ok" : "warn"
  );
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
ui.martinSimulateBtn.addEventListener("click", () => runMartinSimulation().catch(err => setStatus(err.message, "error")));
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
ui.martinSolutionInput.addEventListener("input", (e) => {
  e.target.value = normaliseWord(e.target.value).replace(/[^a-z]/g, "").slice(0, 5);
});

initialise();
