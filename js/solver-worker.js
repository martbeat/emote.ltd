import "./solver-core.module.js?v=20260411-5";

if (!globalThis.SolverCore) {
  throw new Error("SolverCore failed to load in worker.");
}

const {
  rankGuesses,
  filterCandidates,
  scoreGuessEncoded,
  decodePattern,
  chooseGuessPool,
  clearSolveMemo,
  SOLVED_PATTERN
} = globalThis.SolverCore;

let workerAnswers = [];
let workerGuesses = [];

function setWordLists(payload) {
  workerAnswers = Array.isArray(payload.answers) ? payload.answers : [];
  workerGuesses = Array.isArray(payload.guesses) ? payload.guesses : [];
  clearSolveMemo();
}

function runRank(payload) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : workerAnswers;
  const limit = Number(payload.limit || 10);
  const history = Array.isArray(payload.history) ? payload.history : [];
  const forceMode = payload.forceMode || "auto";
  const reportingPool = chooseGuessPool(candidates, workerGuesses, undefined, forceMode);
  const ranked = rankGuesses(candidates, workerGuesses, limit, history, forceMode) || [];
  const top = ranked.filter(Boolean).map((row) => ({
    ...row,
    word: row.word || row.guess || "",
    guess: row.guess || row.word || "",
    entropy: Number.isFinite(row.entropy) ? row.entropy : 0,
    expectedLeft: Number.isFinite(row.expectedLeft) ? row.expectedLeft : 0,
    worstCase: Number.isFinite(row.worstCase) ? row.worstCase : 0,
    score: Number.isFinite(row.score) ? row.score : 0,
    isCandidate: Boolean(row.isCandidate)
  }));

  postMessage({
    type: "rankResult",
    requestId: payload.requestId,
    result: {
      candidatesCount: candidates.length,
      poolSize: reportingPool.length,
      forceMode,
      top
    }
  });
}

function selectBestGuess(candidates, history, forceMode) {
  const poolMode = candidates.length <= 40 ? "candidates" : forceMode;
  return rankGuesses(candidates, workerGuesses, 1, history, poolMode)[0]?.guess || candidates[0] || null;
}

function simulateOne(answer, openingWord, forceMode) {
  let candidates = [...workerAnswers];
  let guess = openingWord;
  let steps = 0;
  const seen = new Set();
  const history = [];

  while (steps < 10 && candidates.length > 0) {
    steps++;
    if (!guess || seen.has(guess)) {
      guess = selectBestGuess(candidates, history, forceMode);
    }
    if (!guess) return 10;

    seen.add(guess);
    const patternCode = scoreGuessEncoded(guess, answer);
    history.push({ guess, pattern: decodePattern(patternCode) });
    if (patternCode === SOLVED_PATTERN) return steps;

    candidates = filterCandidates(candidates, guess, patternCode);
    guess = selectBestGuess(candidates, history, forceMode);
  }
  return 10;
}

function shuffleCopy(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function runSimulation(payload) {
  const openingWord = payload.openingWord;
  const sampleSize = Math.max(1, Math.min(Number(payload.sampleSize || 100), workerAnswers.length));
  const forceMode = payload.forceMode || "auto";
  const sample = shuffleCopy(workerAnswers).slice(0, sampleSize);

  const distribution = new Map();
  let total = 0;
  let failures = 0;
  const hardest = [];

  for (const answer of sample) {
    const guessesNeeded = simulateOne(answer, openingWord, forceMode);
    total += guessesNeeded;
    distribution.set(guessesNeeded, (distribution.get(guessesNeeded) || 0) + 1);
    if (guessesNeeded > 6) failures++;
    hardest.push({ answer, guesses: guessesNeeded });
  }

  hardest.sort((a, b) => b.guesses - a.guesses || a.answer.localeCompare(b.answer));

  postMessage({
    type: "simulationResult",
    requestId: payload.requestId,
    result: {
      openingWord,
      sampleSize,
      average: total / sample.length,
      failures,
      distribution: [...distribution.entries()].sort((a, b) => a[0] - b[0]),
      hardest: hardest.slice(0, 12)
    }
  });
}

self.onmessage = (event) => {
  const payload = event.data || {};
  try {
    switch (payload.type) {
      case "init":
        setWordLists(payload);
        postMessage({
          type: "initResult",
          requestId: payload.requestId,
          result: {
            answers: workerAnswers.length,
            guesses: workerGuesses.length
          }
        });
        break;
      case "rank":
        runRank(payload);
        break;
      case "simulate":
        runSimulation(payload);
        break;
      case "scorePreview":
        postMessage({
          type: "scorePreviewResult",
          requestId: payload.requestId,
          result: {
            guess: payload.guess,
            preview: workerAnswers.slice(0, 50).map(answer => {
              const patternCode = scoreGuessEncoded(payload.guess, answer);
              return {
                answer,
                patternCode,
                pattern: decodePattern(patternCode)
              };
            })
          }
        });
        break;
      default:
        throw new Error(`Unknown worker message type: ${payload.type}`);
    }
  } catch (err) {
    postMessage({
      type: "error",
      requestId: payload.requestId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
