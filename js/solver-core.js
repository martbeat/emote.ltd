export const ANSWER_COUNT = 2315;
export const PATTERN_SPACE = 243; // 3^5
export const MODE_THRESHOLD = 120;
export const FINISHING_THRESHOLD = 20;
export const CANDIDATE_ONLY_THRESHOLD = 50;
export const SOLVE_SEARCH_THRESHOLD = 25;
export const SOLVE_MAX_DEPTH = 6;

let positionalFrequencyTable = null;
let usagePriorTable = null;
const solveMemo = new Map();

export function normaliseWord(word) {
  return String(word || "").trim().toLowerCase();
}

export function isFiveLetterWord(word) {
  return /^[a-z]{5}$/.test(word);
}

export function uniqueWords(words) {
  const out = [];
  const seen = new Set();
  for (const raw of words || []) {
    const word = normaliseWord(raw);
    if (isFiveLetterWord(word) && !seen.has(word)) {
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

export function encodePatternArray(values) {
  let code = 0;
  for (let i = 0; i < 5; i++) code = code * 3 + values[i];
  return code;
}

export function decodePattern(code) {
  const chars = ["b", "b", "b", "b", "b"];
  for (let i = 4; i >= 0; i--) {
    const v = code % 3;
    chars[i] = v === 2 ? "g" : v === 1 ? "y" : "b";
    code = Math.floor(code / 3);
  }
  return chars.join("");
}

export function encodePatternString(pattern) {
  pattern = normaliseWord(pattern);
  if (!/^[byg]{5}$/.test(pattern)) {
    throw new Error("Pattern must be exactly 5 characters using only b, y or g.");
  }
  const values = Array.from(pattern, ch => (ch === "g" ? 2 : ch === "y" ? 1 : 0));
  return encodePatternArray(values);
}

export function scoreGuessEncoded(guess, answer) {

  guess = guess.toLowerCase();
  answer = answer.toLowerCase();

  const result = [0,0,0,0,0];   // 0=black, 1=yellow, 2=green
  const answerLetters = answer.split("");
  const guessLetters = guess.split("");

  const used = [false,false,false,false,false];

  // PASS 1 — greens
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i] = 2;
      used[i] = true;
      guessLetters[i] = null;
    }
  }

  // PASS 2 — yellows
  for (let i = 0; i < 5; i++) {

    if (result[i] === 2) continue;

    for (let j = 0; j < 5; j++) {

      if (!used[j] && guessLetters[i] === answerLetters[j]) {
        result[i] = 1;
        used[j] = true;
        break;
      }

    }

  }

  // encode base-3 pattern
  let code = 0;
  for (let i = 0; i < 5; i++) {
    code = code * 3 + result[i];
  }

  return code;
}
export function filterCandidates(candidates, guess, encodedPattern) {
  const out = [];
  if (out.length === 0) {
  console.warn("⚠️ Candidate collapse", { guess, encodedPattern });
}
  for (const candidate of candidates) {
    if (scoreGuessEncoded(guess, candidate) === encodedPattern) {
      out.push(candidate);
    }
  }
  return out;
}

export function chooseGuessPool(candidates, guesses, threshold = MODE_THRESHOLD, forceMode = "auto") {
  if (forceMode === "candidates") return candidates;
  if (forceMode === "all") return guesses;
  return candidates.length <= 15 ? candidates : guesses;
}

function buildPositionalFrequencyTable(dictionary) {
  const table = Array.from({ length: 5 }, () => Object.create(null));
  for (const word of dictionary) {
    for (let i = 0; i < 5; i++) {
      const letter = word[i];
      table[i][letter] = (table[i][letter] || 0) + 1;
    }
  }
  return table;
}

function resolveMode(candidateCount) {
  if (candidateCount > 60) return "exploration";
  if (candidateCount > FINISHING_THRESHOLD) return "mixed";
  return "exploitation";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function uniqueLetterScore(word) {
  return new Set(word).size;
}

export function positionalScore(word) {
  if (!positionalFrequencyTable) return 0;
  let score = 0;
  for (let i = 0; i < 5; i++) {
    const letter = word[i];
    score += positionalFrequencyTable[i][letter] || 0;
  }
  return score;
}

function buildUsagePriorTable(guesses) {
  const table = Object.create(null);
  const answerLike = Array.isArray(guesses) ? guesses.slice(0, ANSWER_COUNT) : [];
  const maxRank = Math.max(1, answerLike.length - 1);
  for (let i = 0; i < answerLike.length; i++) {
    table[answerLike[i]] = 1 - (i / maxRank);
  }
  return table;
}

export function usagePriorScore(word) {
  if (!usagePriorTable) return 0;
  if (Object.prototype.hasOwnProperty.call(usagePriorTable, word)) {
    return usagePriorTable[word];
  }
  return -0.2;
}

export function expectedRemainingCandidates(guess, candidates) {
  const buckets = new Uint16Array(PATTERN_SPACE);
  for (const answer of candidates) {
    buckets[scoreGuessEncoded(guess, answer)]++;
  }

  let totalSquared = 0;
  for (let i = 0; i < PATTERN_SPACE; i++) {
    const count = buckets[i];
    if (count) totalSquared += count * count;
  }

  return totalSquared / candidates.length;
}

// --- SOLVE CONFIG ---
const SOLVE_SEARCH_THRESHOLD = 25;
const SOLVE_MAX_DEPTH = 6;

// Use a fresh memo per ranking run (important!)
let solveMemo = new Map();

// --- CANONICAL KEY (FIXES YOUR BUG) ---
function keyForSet(words) {
  // Sort to ensure identical sets produce identical keys
  return words.length <= 1 ? words.join(",") : words.slice().sort().join(",");
}

function partitionCandidates(guess, candidates) {
  const map = new Map();

  for (const answer of candidates) {
    const code = scoreGuessEncoded(guess, answer);
    if (!map.has(code)) map.set(code, []);
    map.get(code).push(answer);
  }

  return map;
}

function bestSolveCost(candidates, guessPool, depth = 0) {
  if (candidates.length <= 1) return 1;
  if (depth >= SOLVE_MAX_DEPTH) return candidates.length;

  const key = keyForSet(candidates);
  if (solveMemo.has(key)) return solveMemo.get(key);

  let best = Infinity;

  for (const guess of guessPool) {
    const cost = expectedSolveCost(guess, candidates, guessPool, depth);
    if (cost < best) best = cost;
  }

  solveMemo.set(key, best);
  return best;
}

function expectedSolveCost(guess, candidates, guessPool, depth = 0) {
  const total = candidates.length;
  const parts = partitionCandidates(guess, candidates);

  let cost = 0;

  for (const [code, subset] of parts) {

    // solved
    if (code === 242) {
      cost += subset.length * 1;
      continue;
    }

    // recurse
    const future = bestSolveCost(subset, guessPool, depth + 1);
    cost += subset.length * (1 + future);
  }

  return cost / total;
}

export function clearSolveMemo() {
  solveMemo.clear();
}

export function analyseGuess(guess, candidates, mode = "exploration", candidateSet = null) {
  const buckets = new Uint16Array(PATTERN_SPACE);

  for (const answer of candidates) {
    buckets[scoreGuessEncoded(guess, answer)]++;
  }

  const total = candidates.length;
  let entropy = 0;
  let expectedLeft = 0;
  let worstCase = 0;

  for (let i = 0; i < PATTERN_SPACE; i++) {
    const count = buckets[i];
    if (!count) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
    expectedLeft += p * count;
    if (count > worstCase) worstCase = count;
  }

  if (mode === "exploitation") {
    expectedLeft = expectedRemainingCandidates(guess, candidates);
  }

  const isCandidate = candidateSet ? candidateSet.has(guess) : candidates.includes(guess);
  const solvedBucket = buckets[242];
  const expectedTurns = 1 + expectedLeft - ((solvedBucket * solvedBucket) / total);

  const score = -expectedTurns;

  return {
    word: guess,
    guess,
    entropy,
    expectedLeft,
    expectedTurns,
    worstCase,
    usagePrior: usagePriorScore(guess),
    isCandidate,
    score
  };
}

export function rankGuesses(candidates, guesses, limit = 10, forceMode = "auto") {
  const candidateCount = candidates.length;

  const dictionary = Array.isArray(guesses) && guesses.length ? guesses : candidates;
  positionalFrequencyTable = buildPositionalFrequencyTable(dictionary);
  usagePriorTable = buildUsagePriorTable(dictionary);

  const candidateSet = new Set(candidates);

  // 🔥 CRITICAL: reset memo per run (prevents corruption)
  solveMemo = new Map();

  // 🔥 TRUE SOLVE OPTIMISATION (late game)
  if (candidateCount <= SOLVE_SEARCH_THRESHOLD) {

    const ranked = [];
    const pool = candidates; // only real answers

for (const guess of pool) {
  const expectedTurns = expectedSolveCost(guess, candidates, pool);
  const worstCaseNorm = worstCase / candidates.length;
  const entropy = computeEntropy(guess, candidates);
  const worstCase = computeWorstCasePartition(guess, candidates);

  const score =
    -expectedTurns
    + 0.25 * entropy
    - 0.15 * worstCaseNorm;

  ranked.push({
    word: guess,
    guess,
    entropy,              // ✅ keep real value
    expectedLeft: 0,      // optional: you can improve this later
    expectedTurns,
    worstCase,            // ✅ keep real value
    usagePrior: usagePriorScore(guess),
    isCandidate: true,
    score                 // ✅ use computed score
  });
}

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.usagePrior !== a.usagePrior) return b.usagePrior - a.usagePrior;
if (b.usagePrior !== a.usagePrior) {
  return b.usagePrior - a.usagePrior;
}

// positional likelihood (THIS is the key)
const pa = positionalWordScore(a.word);
const pb = positionalWordScore(b.word);
if (pb !== pa) return pb - pa;

return a.word.localeCompare(b.word);
    });

    return ranked.slice(0, limit);
  }

  // ⚡ FAST MODE (early game)
  const restrictToCandidates = candidateCount <= CANDIDATE_ONLY_THRESHOLD;
  const pool = restrictToCandidates ? candidates : dictionary;

  const mode = resolveMode(candidateCount);
  const ranked = [];

  for (const guess of pool) {
    ranked.push(analyseGuess(guess, candidates, mode, candidateSet));
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.usagePrior !== a.usagePrior) return b.usagePrior - a.usagePrior;
    if (b.entropy !== a.entropy) return b.entropy - a.entropy;
    if (a.expectedLeft !== b.expectedLeft) return a.expectedLeft - b.expectedLeft;
    return a.word.localeCompare(b.word);
  });

  return ranked.slice(0, limit);
}
export function validateGuessPattern(guess, pattern, answers = [], guesses = []) {
  guess = normaliseWord(guess);
  pattern = normaliseWord(pattern);

  if (!isFiveLetterWord(guess)) return "Guess must be exactly 5 letters.";
  if (!/^[byg]{5}$/.test(pattern)) return "Pattern must be exactly 5 characters using only b, y or g.";

  if (answers.length || guesses.length) {
    const all = new Set([...answers, ...guesses]);
    if (!all.has(guess)) return "Guess is not in the loaded word lists.";
  }
  return "";
}

export function buildDefaultHistoryState(answers) {
  return {
    candidates: [...answers],
    history: []
  };
}
function computeEntropy(guess, candidates) {
  const parts = partitionCandidates(guess, candidates);
  const total = candidates.length;

  let entropy = 0;
  for (const subset of parts.values()) {
    const p = subset.length / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function computeWorstCasePartition(guess, candidates) {
  const parts = partitionCandidates(guess, candidates);
  let max = 0;
  for (const subset of parts.values()) {
    if (subset.length > max) max = subset.length;
  }
  return max;
}
