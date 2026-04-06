const ANSWER_COUNT = 2315;
const PATTERN_SPACE = 243; // 3^5
const MODE_THRESHOLD = 120;
const FINISHING_THRESHOLD = 10;
const CANDIDATE_ONLY_THRESHOLD = 4;
const SOLVE_SEARCH_THRESHOLD = 25;
const SOLVE_MAX_DEPTH = 6;

let positionalFrequencyTable = null;
let usagePriorTable = null;
const solveMemo = new Map();

function normaliseWord(word) {
  return String(word || "").trim().toLowerCase();
}

function isFiveLetterWord(word) {
  return /^[a-z]{5}$/.test(word);
}

function uniqueWords(words) {
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

function encodePatternArray(values) {
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

function decodePattern(code) {
  const chars = ["b", "b", "b", "b", "b"];
  for (let i = 4; i >= 0; i--) {
    const v = code % 3;
    chars[i] = v === 2 ? "g" : v === 1 ? "y" : "b";
    code = Math.floor(code / 3);
  }
  return chars.join("");
}

function encodePattern(pattern) {
  pattern = normaliseWord(pattern);
  if (!/^[byg]{5}$/.test(pattern)) {
    throw new Error("Pattern must be exactly 5 characters using only b, y or g.");
  }
  const values = Array.from(pattern, ch => (ch === "g" ? 2 : ch === "y" ? 1 : 0));
  return encodePatternArray(values);
}

const encodePatternString = encodePattern;

function scoreGuessEncoded(guess, answer) {

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

function filterCandidates(candidates, guess, pattern) {
  const encoded =
    typeof pattern === "string"
      ? encodePattern(pattern)
      : pattern;

  const out = [];
  for (const candidate of candidates) {
    if (scoreGuessEncoded(guess, candidate) === encoded) {
      out.push(candidate);
    }
  }
  return out;
}

function chooseGuessPool(candidates, guesses, threshold = MODE_THRESHOLD, forceMode = "auto") {
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

function nearlyEqual(a, b, epsilon = 0.05) {
  return Math.abs(a - b) <= epsilon;
}

function shouldUseBreakerGuess(bestCandidate, bestOverall, candidateCount) {
  if (!bestOverall) return false;
  if (!bestCandidate) return true; // no candidate available → allow breaker

  if (bestOverall.isCandidate) return false;

  if (candidateCount <= 6) {
    return bestOverall.expectedTurns + 0.20 < bestCandidate.expectedTurns &&
           bestOverall.worstCase + 1 < bestCandidate.worstCase;
  }

  if (candidateCount <= 12) {
    return bestOverall.expectedTurns + 0.15 < bestCandidate.expectedTurns &&
           bestOverall.worstCase + 1 < bestCandidate.worstCase;
  }

  return false;
}

function compareRankedRows(a, b, candidateCount) {
  // Strong preference for actual candidate answers in small endgames
  if (candidateCount <= 12) {
    if (a.isCandidate !== b.isCandidate) {
      return Number(b.isCandidate) - Number(a.isCandidate);
    }
  }

  if (a.expectedTurns !== b.expectedTurns) {
    return a.expectedTurns - b.expectedTurns;
  }

  if (a.isCandidate !== b.isCandidate) {
    return Number(b.isCandidate) - Number(a.isCandidate);
  }

  if (b.solveProbability !== a.solveProbability) {
    return b.solveProbability - a.solveProbability;
  }

  if (a.worstCase !== b.worstCase) {
    return a.worstCase - b.worstCase;
  }

  if (b.entropy !== a.entropy) {
    return b.entropy - a.entropy;
  }

  return a.word.localeCompare(b.word);
}


function resolveMode(candidateCount) {
  if (candidateCount > 70) return "exploration";
  if (candidateCount > 20) return "mixed";
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


function uniqueLetterScore(word) {
  return new Set(word).size;
}

function positionalScore(word) {
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

function selectRecursivePool(candidates, guesses, candidateSet, maxExtra = 10) {
  // Always include candidates
  const pool = new Set(candidates);

  // 🔥 HARD STOP: small sets should NOT expand much
  if (candidates.length <= 6) {
    return [...pool];
  }

  const ranked = [];

  for (const guess of guesses) {
    if (pool.has(guess)) continue;

    const analysis = analyseGuess(guess, candidates, "exploration", candidateSet);
    if (analysis.entropy === 0) continue;

    ranked.push({
      guess,
      expectedLeft: analysis.expectedLeft,
      worstCase: analysis.worstCase
    });
  }

  ranked.sort((a, b) => {
    if (a.expectedLeft !== b.expectedLeft) return a.expectedLeft - b.expectedLeft;
    if (a.worstCase !== b.worstCase) return a.worstCase - b.worstCase;
    return a.guess.localeCompare(b.guess);
  });

  // 🔥 VERY IMPORTANT: limit size
  const limit =
    candidates.length <= 12 ? 3 :
    candidates.length <= 20 ? 5 :
    maxExtra;

  for (const row of ranked.slice(0, limit)) {
    pool.add(row.guess);
  }

  return [...pool];
}

function recursiveExpectedSolveDepth(candidates, guesses, memo, depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) {
    return Math.min(6, candidates.length);
  }
  if (candidates.length <= 1) return 1;
  if (depth >= maxDepth) return candidates.length;

  const key = keyForSet(candidates);
  if (memo.has(key)) return memo.get(key);

  const candidateSet = new Set(candidates);
  const guessPool = selectRecursivePool(candidates, guesses, candidateSet)
    .slice(0, 15); // 🔥 hard cap

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
      solveProbability: analysis.solveProbability
    });
  }

  ranked.sort((a, b) => compareRankedRows(a, b, candidates.length));

  // In small sets, suppress non-candidate breaker guesses unless clearly justified
  if (candidates.length <= 12) {
    const bestCandidate = ranked.find(x => x.isCandidate) || null;
    const bestOverall = ranked.length ? ranked[0] : null;

    if (!bestOverall) return [];

    if (bestCandidate && shouldUseBreakerGuess(bestCandidate, bestOverall, candidates.length)) {
      return ranked.slice(0, limit).map(row => ({
        ...row,
        score: -row.expectedTurns
      }));
    }

    return ranked
      .filter(x => x.isCandidate)
      .slice(0, limit)
      .map(row => ({
        ...row,
        score: -row.expectedTurns
      }));
  }

  return ranked.slice(0, limit).map(row => ({
    ...row,
    score: -row.expectedTurns
  }));
}


function buildUsagePriorTable(words) {
  const table = Object.create(null);
  if (!Array.isArray(words) || !words.length) return table;

  const maxRank = Math.max(1, words.length - 1);
  for (let i = 0; i < words.length; i++) {
    table[words[i]] = 1 - (i / maxRank);
  }
  return table;
}
function usagePriorScore(word) {
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

function expectedRemainingCandidates(guess, candidates) {
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

function clearSolveMemo() {
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

function analyseGuess(guess, candidates, mode = "exploration", candidateSet = null) {
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

function rankGuesses(
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

  positionalFrequencyTable = buildPositionalFrequencyTable(candidates);
  usagePriorTable = buildUsagePriorTable(candidates);

  const candidateSet = new Set(candidates);

  // Very small sets: solve, do not get clever
  if (candidateCount <= 12) {
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

  const usedLetters = new Set();
  const usedGuesses = new Set();

  for (const h of history || []) {
    if (!h || !h.guess) continue;
    for (const ch of h.guess) usedLetters.add(ch);
    usedGuesses.add(h.guess);
  }

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
          .slice(0, 1200)
      : dictionary;

  const ranked = [];

  for (const guess of fastPool) {
    const analysis = analyseGuess(guess, candidates, mode, candidateSet);

    if (analysis.entropy === 0 && candidateCount > 1) continue;

    const reductionRatio = analysis.expectedLeft / candidateCount;
    const worstRatio = analysis.worstCase / candidateCount;

    if (candidateCount > 80 && reductionRatio > 0.78) continue;
    if (candidateCount > 40 && reductionRatio > 0.52) continue;
    if (candidateCount > 40 && worstRatio > 0.62) continue;
    if (candidateCount > 40 && worstRatio > 0.74) continue;

    let score = 0;

    if (mode === "exploration") {
      score += 2.4 * analysis.entropy;
      score -= 1.1 * worstRatio;
      score -= 0.6 * reductionRatio;
      score += 0.35 * coverageScore(guess, usedLetters);
      score += 0.18 * uniqueLetterScore(guess);
      score += 0.01 * positionalScore(guess);
      score -= 0.25 * repeatPenalty(guess);
      if (analysis.isCandidate) score += 0.05;
} else if (mode === "mixed") {
  const reduction = candidateCount - analysis.expectedLeft;

  // 🔥 PRIMARY: maximise reduction
  score += 2.2 * reduction;

  // 🔥 SECOND: minimise worst-case branch
  score -= 1.8 * analysis.worstCase;

  // 🔥 THIRD: reward solve probability
  score += 2.5 * analysis.solveProbability;

  // 🔥 LIGHT entropy (only as tie-breaker)
  score += 0.2 * analysis.entropy;
  const reductionRatio = (candidateCount - analysis.expectedLeft) / candidateCount;
  score += 1.5 * reductionRatio;
  // 🔥 prefer real answers increasingly
const candidateBias =
  candidateCount <= 20 ? 1.2 :
  candidateCount <= 40 ? 0.7 :
  candidateCount <= 80 ? 0.35 :
  0.1;

if (analysis.isCandidate) {
  score += candidateBias;
}

  // minor stabilisers
  score += 0.02 * positionalScore(guess);
} else {
      score -= 2.2 * analysis.expectedLeft;
      score -= 1.4 * analysis.worstCase;
      score += 3.0 * analysis.solveProbability;
      score += 0.04 * positionalScore(guess);
      if (analysis.isCandidate) score += 0.60;
    }

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

    if (candidateCount <= 20 && a.isCandidate !== b.isCandidate) {
      return Number(b.isCandidate) - Number(a.isCandidate);
    }

    if (b.solveProbability !== a.solveProbability) {
      return b.solveProbability - a.solveProbability;
    }

    if (a.expectedLeft !== b.expectedLeft) {
      return a.expectedLeft - b.expectedLeft;
    }

    if (a.worstCase !== b.worstCase) {
      return a.worstCase - b.worstCase;
    }

    if (b.entropy !== a.entropy) {
      return b.entropy - a.entropy;
    }

    return a.word.localeCompare(b.word);
  });

  return ranked.slice(0, limit);
}

function validateGuessPattern(guess, pattern, answers = [], guesses = []) {
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

function buildDefaultHistoryState(answers) {
  return {
    candidates: [...answers],
    history: []
  };
}

const SolverCore = {
  ANSWER_COUNT,
  PATTERN_SPACE,
  MODE_THRESHOLD,
  FINISHING_THRESHOLD,
  CANDIDATE_ONLY_THRESHOLD,
  SOLVE_SEARCH_THRESHOLD,
  SOLVE_MAX_DEPTH,
  normaliseWord,
  isFiveLetterWord,
  uniqueWords,
  encodePatternArray,
  decodePattern,
  encodePattern,
  encodePatternString,
  scoreGuessEncoded,
  filterCandidates,
  chooseGuessPool,
  uniqueLetterScore,
  positionalScore,
  usagePriorScore,
  expectedRemainingCandidates,
  clearSolveMemo,
  analyseGuess,
  rankGuesses,
  validateGuessPattern,
  buildDefaultHistoryState
};

if (typeof globalThis !== "undefined") {
  globalThis.SolverCore = SolverCore;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SolverCore;
}
