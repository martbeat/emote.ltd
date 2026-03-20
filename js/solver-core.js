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

function keyForSet(words) {
  return words.join(",");
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

  if (candidateCount <= SOLVE_SEARCH_THRESHOLD) {
    const ranked = [];

  // 🚀 EARLY COMMIT (fixes 6-guess problem)
  if (candidateCount <= 10) {

    const strength = computePatternStrength(candidates);

    if (candidateCount <= 6 || strength > 0.6) {

      const ordered = candidates.slice().sort((a, b) => {
        const pa = positionalWordScore(b) - positionalWordScore(a);
        if (pa !== 0) return pa;

        const ua = usagePriorScore(b) - usagePriorScore(a);
        if (ua !== 0) return ua;

        return a.localeCompare(b);
      });

      return ordered.slice(0, limit).map(word => ({
        word,
        guess: word,
        entropy: 0,
        expectedLeft: 1,
        expectedTurns: 1,
        worstCase: 1,
        usagePrior: usagePriorScore(word),
        isCandidate: true,
        score: 999
      }));
    }
  }
    
    for (const guess of pool) {
      const expectedTurns = expectedSolveCost(guess, candidates, pool);
      ranked.push({
        word: guess,
        guess,
        entropy: 0,
        expectedLeft: 0,
        expectedTurns,
        worstCase: 0,
        usagePrior: usagePriorScore(guess),
        isCandidate: candidateSet.has(guess),
        score: -expectedTurns
      });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.isCandidate !== a.isCandidate) return Number(b.isCandidate) - Number(a.isCandidate);
      if (b.usagePrior !== a.usagePrior) return b.usagePrior - a.usagePrior;
      return a.word.localeCompare(b.word);
    });

    return ranked.slice(0, limit);
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
    const score = mode === "exploration"
      ? (1.5 * coverageScore(guess, usedLetters)) + analysis.entropy - (0.2 * repeatPenalty(guess))
      : analysis.score;

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
