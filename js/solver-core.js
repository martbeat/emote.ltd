export const ANSWER_COUNT = 2315;
export const PATTERN_SPACE = 243; // 3^5
export const MODE_THRESHOLD = 120;
export const FINISHING_THRESHOLD = 10;
export const CANDIDATE_ONLY_THRESHOLD = 4;
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

function computePatternStrength(candidates) {
  if (!Array.isArray(candidates) || candidates.length <= 1) return 1;

  const wordLength = candidates[0].length;
  let fixedPositions = 0;

  for (let i = 0; i < wordLength; i++) {
    const letters = new Set();
    for (const word of candidates) {
      letters.add(word[i]);
      if (letters.size > 1) break;
    }
    if (letters.size === 1) fixedPositions++;
  }

  return fixedPositions / wordLength;
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

export function encodePattern(pattern) {
  pattern = normaliseWord(pattern);
  if (!/^[byg]{5}$/.test(pattern)) {
    throw new Error("Pattern must be exactly 5 characters using only b, y or g.");
  }
  const values = Array.from(pattern, ch => (ch === "g" ? 2 : ch === "y" ? 1 : 0));
  return encodePatternArray(values);
}

export const encodePatternString = encodePattern;

export function scoreGuessEncoded(guess, answer) {

  guess = guess.toLowerCase();
  answer = answer.toLowerCase();

  const result = [0,0,0,0,0];
  const answerCounts = {};

  // count letters in answer
  for (const ch of answer) {
    answerCounts[ch] = (answerCounts[ch] || 0) + 1;
  }

  // PASS 1 — greens
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 2;
      answerCounts[guess[i]]--;
    }
  }

  // PASS 2 — yellows
  for (let i = 0; i < 5; i++) {
    if (result[i] === 0) {
      const ch = guess[i];
      if (answerCounts[ch] > 0) {
        result[i] = 1;
        answerCounts[ch]--;
      }
    }
  }

  // encode base-3
  let code = 0;
  for (let i = 0; i < 5; i++) {
    code = code * 3 + result[i];
  }

  return code;
}

export function filterCandidates(candidates, guess, pattern) {
  const encoded =
    typeof pattern === "string"
      ? encodePattern(pattern)
      : pattern;

  const out = [];

for (const candidate of candidates) {

  const score = scoreGuessEncoded(guess, candidate);

  // 🔍 DEBUG: see what patterns are being generated
  console.log(
    "[FILTER DEBUG]",
    "guess:", guess,
    "candidate:", candidate,
    "score:", score,
    "target:", encoded
  );

  if (score === encoded) {
    out.push(candidate);
  }
}
console.log("Before:", candidates.length, "After:", out.length);
console.log("Pattern in:", pattern);
console.log("Encoded:", typeof pattern === "string" ? encodePattern(pattern) : pattern);
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
  if (candidateCount > 80) return "exploration";
  if (candidateCount > FINISHING_THRESHOLD) return "mixed";
  return "exploitation";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lateAnswerScore(word) {
  let score = 0;

  // prefer common letter positions from your current dictionary
  score += 2 * positionalScore(word);

  // prefer unique letters a bit less at this stage
  score += 1.2 * uniqueLetterScore(word);

  // mild vowel preference
  const vowels = new Set(["a", "e", "i", "o", "u"]);
  let vowelCount = 0;
  for (const ch of word) {
    if (vowels.has(ch)) vowelCount++;
  }
  score += vowelCount;

  return score;
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

function positionEntropyScore(candidates) {
  if (!candidates.length) return 0;

  const length = 5;
  let totalEntropy = 0;

  for (let i = 0; i < length; i++) {
    const counts = Object.create(null);

    for (const word of candidates) {
      const ch = word[i];
      counts[ch] = (counts[ch] || 0) + 1;
    }

    let entropy = 0;
    const total = candidates.length;

    for (const ch in counts) {
      const p = counts[ch] / total;
      entropy -= p * Math.log2(p);
    }

    totalEntropy += entropy;
  }

  return totalEntropy; // higher = more uncertainty
}


function keyForSet(words) {
  return words.slice().sort().join(",");
}

function solvedPatternCode() {
  return 242; // ggggg in base-3 with your encoding
}

function selectRecursivePool(candidates, guesses, candidateSet, maxExtra = 25) {
  // Always include candidates
  const pool = new Set(candidates);

  // Add a few strong breaker guesses from the wider guess list
  const ranked = [];
  for (const guess of guesses) {
    if (pool.has(guess)) continue;
    const analysis = analyseGuess(guess, candidates, "exploration", candidateSet);
    if (analysis.entropy === 0) continue;
    ranked.push({
      guess,
      entropy: analysis.entropy,
      worstCase: analysis.worstCase
    });
  }

  ranked.sort((a, b) => {
    if (b.entropy !== a.entropy) return b.entropy - a.entropy;
    if (a.worstCase !== b.worstCase) return a.worstCase - b.worstCase;
    return a.guess.localeCompare(b.guess);
  });

  for (const row of ranked.slice(0, maxExtra)) {
    pool.add(row.guess);
  }

  return [...pool];
}

function recursiveExpectedSolveDepth(candidates, guesses, memo, depth = 0, maxDepth = 8) {
  if (candidates.length <= 1) return 1;
  if (depth >= maxDepth) return candidates.length;

  const key = keyForSet(candidates);
  if (memo.has(key)) return memo.get(key);

  const candidateSet = new Set(candidates);
  const guessPool = selectRecursivePool(candidates, guesses, candidateSet);

  let best = Infinity;

  for (const guess of guessPool) {
    const parts = partitionCandidates(guess, candidates);
    let totalCost = 0;
    const total = candidates.length;

    for (const [code, subset] of parts.entries()) {
      const p = subset.length / total;

      if (code === solvedPatternCode()) {
        totalCost += p * 1;
      } else {
        const future = recursiveExpectedSolveDepth(subset, guesses, memo, depth + 1, maxDepth);
        totalCost += p * (1 + future);
      }
    }

    if (totalCost < best) best = totalCost;
  }

  memo.set(key, best);
  return best;
}

function rankByRecursiveSolveDepth(candidates, guesses, limit = 10, maxDepth = 8) {
  const memo = new Map();
  const candidateSet = new Set(candidates);
  const guessPool = selectRecursivePool(candidates, guesses, candidateSet);

  const ranked = [];

  for (const guess of guessPool) {
    const parts = partitionCandidates(guess, candidates);
    let totalCost = 0;
    const total = candidates.length;

    for (const [code, subset] of parts.entries()) {
      const p = subset.length / total;

      if (code === solvedPatternCode()) {
        totalCost += p * 1;
      } else {
        const future = recursiveExpectedSolveDepth(subset, guesses, memo, 1, maxDepth);
        totalCost += p * (1 + future);
      }
    }

    const analysis = analyseGuess(guess, candidates, "exploration", candidateSet);

    ranked.push({
      word: guess,
      guess,
      entropy: analysis.entropy,
      expectedLeft: analysis.expectedLeft,
      expectedTurns: totalCost,
      worstCase: analysis.worstCase,
      usagePrior: usagePriorScore(guess),
      isCandidate: candidateSet.has(guess),
      score: -totalCost
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.isCandidate !== a.isCandidate) return Number(b.isCandidate) - Number(a.isCandidate);
    if (b.entropy !== a.entropy) return b.entropy - a.entropy;
    if (a.worstCase !== b.worstCase) return a.worstCase - b.worstCase;
    return a.word.localeCompare(b.word);
  });

  return ranked.slice(0, limit);
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

function coverageScore(guess, usedLetters) {
  let score = 0;
  for (const ch of new Set(guess)) {
    if (!usedLetters.has(ch)) score++;
  }
  return score;
}

function repeatPenalty(word) {
  return word.length - new Set(word).size;
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
  if (depth > SOLVE_MAX_DEPTH) return candidates.length;

  const key = keyForSet(candidates);
  const cached = solveMemo.get(key);
  if (cached != null) return cached;

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
    if (code === 242) {
      cost += subset.length;
    } else {
      const future = bestSolveCost(subset, guessPool, depth + 1);
      cost += subset.length * (1 + future);
    }
  }

  return cost / total;
}

export function clearSolveMemo() {
  solveMemo.clear();
}

function isFlatInformationLandscape(candidates, guesses) {
  const sample = candidates.slice(0, Math.min(6, candidates.length));

  let maxEntropy = 0;

  for (const guess of sample) {
    const analysis = analyseGuess(guess, candidates, "exploration");
    if (analysis.entropy > maxEntropy) {
      maxEntropy = analysis.entropy;
    }
  }

  return maxEntropy < 1.2; // threshold tweakable
}

export function analyseGuess(guess, candidates, mode = "exploration", candidateSet = null) {
const buckets = new Uint16Array(PATTERN_SPACE);

for (const answer of candidates) {
  buckets[scoreGuessEncoded(guess, answer)]++;
}

const total = candidates.length;  // ✅ MUST be before usage

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

// ✅ NOW safe to use total
const solvedBucket = buckets[242];
const solveProbability = solvedBucket / total;
  
if (mode === "exploitation") {
    expectedLeft = expectedRemainingCandidates(guess, candidates);
}

const isCandidate = candidateSet ? candidateSet.has(guess) : candidates.includes(guess);
let expectedTurns = 0;

for (let i = 0; i < PATTERN_SPACE; i++) {
  const count = buckets[i];
  if (!count) continue;

  const p = count / total;

  if (i === 242) {
    expectedTurns += p * 1; // solved
  } else {
    expectedTurns += p * (1 + Math.log2(count + 1));
  }
}

  let score = entropy;
  if (mode === "mixed") {
    score = entropy + 0.02 * uniqueLetterScore(guess) + 0.02 * positionalScore(guess);
  } else if (mode === "exploitation") {
    score = -expectedLeft;
  }

  return {
    word: guess,
    guess,
    entropy,
    expectedLeft,
    expectedTurns,
    worstCase,
    usagePrior: usagePriorScore(guess),
    isCandidate,
    score,
    solveProbability
  };
}

export function rankGuesses(
  candidates,
  guesses,
  limit = 10,
  historyOrForceMode = [],
  explicitForceMode = "auto"
) {
  const hasHistory = Array.isArray(historyOrForceMode);
  const history = hasHistory ? historyOrForceMode : [];
  const forceMode = hasHistory
    ? explicitForceMode
    : historyOrForceMode || "auto";

  const candidateCount = candidates.length;

  const dictionary =
    Array.isArray(guesses) && guesses.length ? guesses : candidates;

  positionalFrequencyTable = buildPositionalFrequencyTable(dictionary);
  usagePriorTable = buildUsagePriorTable(dictionary);

  const candidateSet = new Set(candidates);

  // small sets → full recursive solve
  if (candidateCount <= 20) {
    return rankByRecursiveSolveDepth(candidates, dictionary, limit, 6);
  }

  const mode =
    forceMode === "candidates"
      ? "exploitation"
      : forceMode === "all"
      ? candidateCount > 60
        ? "exploration"
        : candidateCount <= FINISHING_THRESHOLD
        ? "exploitation"
        : "mixed"
      : resolveMode(candidateCount);

  // track used letters and guesses
  const usedLetters = new Set();
  const usedGuesses = new Set();

  for (const h of history || []) {
    if (!h || !h.guess) continue;
    for (const ch of h.guess) usedLetters.add(ch);
    usedGuesses.add(h.guess);
  }

  // reduce search space for speed
  const fastPool =
    mode === "exploration" && dictionary.length > 2500
      ? dictionary
          .slice()
          .sort((a, b) => {
            const aCov = coverageScore(a, usedLetters);
            const bCov = coverageScore(b, usedLetters);
            if (bCov !== aCov) return bCov - aCov;

            const aUni = uniqueLetterScore(a);
            const bUni = uniqueLetterScore(b);
            if (bUni !== aUni) return bUni - aUni;

            const aPos = positionalScore(a);
            const bPos = positionalScore(b);
            if (bPos !== aPos) return bPos - aPos;

            return a.localeCompare(b);
          })
          .slice(0, 1500)
      : dictionary;

  const ranked = [];

  for (const guess of fastPool) {
    const analysis = analyseGuess(guess, candidates, mode, candidateSet);

    // 🚫 reject useless guesses
    if (analysis.entropy === 0 && candidateCount > 1) continue;

    const reductionRatio = analysis.expectedLeft / candidateCount;
    const worstRatio = analysis.worstCase / candidateCount;

    if (candidateCount > 80 && reductionRatio > 0.75) continue;
    if (candidateCount > 40 && reductionRatio > 0.60) continue;
    if (candidateCount > 20 && reductionRatio > 0.55) continue;

    if (candidateCount > 80 && worstRatio > 0.85) continue;
    if (candidateCount > 40 && worstRatio > 0.72) continue;
    if (candidateCount > 20 && worstRatio > 0.68) continue;

    let score = 0;

    // 🔥 PRIMARY: avoid bad branches
    score -= 1.6 * worstRatio;

    // 🔥 SECONDARY: ensure meaningful reduction
    score -= 1.0 * reductionRatio;

    // 🔥 THIRD: expected solve depth
    score -= 0.35 * analysis.expectedTurns;

    // 🔥 encourage quick wins
    score += 1.2 * analysis.solveProbability;

    // mild tie-breakers
    score += 0.05 * analysis.entropy;
    score += 0.02 * positionalScore(guess);

    // prefer candidates (scaled by phase)
    if (analysis.isCandidate) {
      score += candidateCount <= 12 ? 0.45 : 0.12;
    }

    // avoid repeats
    if (usedGuesses.has(guess)) {
      score -= 10;
    }

    ranked.push({
      ...analysis,
      score
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.usagePrior !== a.usagePrior) return b.usagePrior - a.usagePrior;
    if (b.entropy !== a.entropy) return b.entropy - a.entropy;
    if (a.expectedLeft !== b.expectedLeft)
      return a.expectedLeft - b.expectedLeft;
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
