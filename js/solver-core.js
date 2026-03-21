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
  const targetPattern = typeof encodedPattern === "string"
    ? encodePattern(encodedPattern)
    : encodedPattern;
  const out = [];
  for (const candidate of candidates) {
    if (scoreGuessEncoded(guess, candidate) === targetPattern) {
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

function selectRecursivePool(candidates, guesses, candidateSet, maxExtra = 12) {
  // Always include candidates
  const pool = new Set(candidates);

  // Add a few strong breaker guesses from the wider guess list
  const ranked = [];
  for (const guess of guesses) {
    if (pool.has(guess)) continue;
    const analysis = analyseGuess(guess, candidates, "exploration", candidateSet);
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

  return maxEntropy < 0.5; // threshold tweakable
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
    score
  };
}

export function rankGuesses(candidates, guesses, limit = 10, historyOrForceMode = [], explicitForceMode = "auto") {
  const hasHistory = Array.isArray(historyOrForceMode);
  const history = hasHistory ? historyOrForceMode : [];
  const forceMode = hasHistory ? explicitForceMode : (historyOrForceMode || "auto");
  const candidateCount = candidates.length;

  const dictionary = Array.isArray(guesses) && guesses.length ? guesses : candidates;
  positionalFrequencyTable = buildPositionalFrequencyTable(dictionary);
  usagePriorTable = buildUsagePriorTable(dictionary);

  const restrictToCandidates = candidateCount <= CANDIDATE_ONLY_THRESHOLD;
  const pool = (restrictToCandidates || forceMode === "candidates") ? candidates : dictionary;
  const candidateSet = new Set(candidates);

  // 🔥 HUMAN-STYLE ELIMINATION MODE
if (candidateCount >= 10 && candidateCount <= 25) {

  const usedLetters = new Set();
  for (const h of history || []) {
    for (const ch of h.guess || "") {
      usedLetters.add(ch);
    }
  }

  const ranked = [];

  for (const guess of dictionary) {
    if (candidateSet.has(guess)) continue; // avoid committing early

    const unique = new Set(guess);
    let newLetters = 0;

    for (const ch of unique) {
      if (!usedLetters.has(ch)) newLetters++;
    }

    const penalty = repeatPenalty(guess);

    const score =
      (2.5 * newLetters)        // 🔥 key driver
      - (0.5 * penalty)
      + (0.2 * positionalScore(guess));

    ranked.push({
      word: guess,
      guess,
      entropy: 0,
      expectedLeft: 0,
      worstCase: 0,
      isCandidate: false,
      score
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

// 🔥 CLUSTER BREAK DETECTION
if (candidateCount > 4 && isFlatInformationLandscape(candidates, dictionary)) {

  const breakers = [];

  for (const guess of dictionary) {
    if (candidateSet.has(guess)) continue;

    const analysis = analyseGuess(guess, candidates, "exploration", candidateSet);

    breakers.push({
      word: guess,
      guess,
      entropy: analysis.entropy,
      expectedLeft: analysis.expectedLeft,
      worstCase: analysis.worstCase,
      usagePrior: usagePriorScore(guess),
      isCandidate: false,
      score:
        (2.0 * analysis.entropy) -
        (0.7 * (analysis.worstCase / candidateCount)) -
        (0.2 * repeatPenalty(guess))
    });
  }

  breakers.sort((a, b) => b.score - a.score);

  return breakers.slice(0, limit);
}
  
  if (candidateCount <= 10) {
    return rankByRecursiveSolveDepth(candidates, dictionary, limit, 8);
  }

  const mode = forceMode === "candidates"
    ? "exploitation"
    : forceMode === "all"
      ? (candidateCount > 60 ? "exploration" : candidateCount <= FINISHING_THRESHOLD ? "exploitation" : "mixed")
      : resolveMode(candidateCount);

  const usedLetters = new Set();
  for (const h of history || []) {
    if (!h || !h.guess) continue;
    for (const ch of h.guess) usedLetters.add(ch);
  }
const usedGuesses = new Set();
for (const h of history || []) {
  if (h?.guess) usedGuesses.add(h.guess);
}
  const fastPool = (mode === "exploration" && pool.length > 2500)
    ? pool
        .slice()
        .sort((a, b) => {
          const aCoverage = coverageScore(a, usedLetters);
          const bCoverage = coverageScore(b, usedLetters);
          if (bCoverage !== aCoverage) return bCoverage - aCoverage;

          const aUnique = uniqueLetterScore(a);
          const bUnique = uniqueLetterScore(b);
          if (bUnique !== aUnique) return bUnique - aUnique;

          const aPos = positionalScore(a);
          const bPos = positionalScore(b);
          if (bPos !== aPos) return bPos - aPos;

          return a.localeCompare(b);
        })
        .slice(0, 2500)
    : pool;

const ranked = [];
for (const guess of fastPool) {
  const analysis = analyseGuess(guess, candidates, mode, candidateSet);

  let score;

  if (mode === "exploration") {
    score =
      (1.5 * coverageScore(guess, usedLetters)) +
      analysis.entropy -
      (0.2 * repeatPenalty(guess));
  } else {
    // 🔥 THIS is your tweak zone
    const worstCaseNorm = analysis.worstCase / candidateCount;
const lateGameFactor = Math.max(0, 15 - candidateCount) / 15;
const currentEntropy = positionEntropyScore(candidates);

// simulate partitions
let expectedPositionReduction = 0;
const parts = partitionCandidates(guess, candidates);

for (const subset of parts.values()) {
  const p = subset.length / candidateCount;
  const subEntropy = positionEntropyScore(subset);
  expectedPositionReduction += p * (currentEntropy - subEntropy);
}

score =
  0.5 * expectedPositionReduction   // ⭐ NEW: core signal
  + 0.8 * analysis.entropy          // still useful
  - 0.6 * worstCaseNorm
  - 0.3 * analysis.expectedLeft
  + 0.1 * positionalScore(guess)
  + (0.8 * lateGameFactor * analysis.isCandidate); // 🔥 key fix;

    // small bias toward real answers
    if (analysis.isCandidate) {
      score += 0.3;
    }
    
if (usedGuesses.has(guess)) {
  score -= 10; // 🔥 strong penalty
}
    // kill useless guesses
    if (analysis.entropy === 0) {
      score -= 5;
    }
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
