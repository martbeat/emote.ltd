export const ANSWER_COUNT = 2315;
export const PATTERN_SPACE = 243; // 3^5
export const MODE_THRESHOLD = 120;

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
  return candidates.length > threshold ? candidates : guesses;
}

export function analyseGuess(guess, candidates, candidateSet = null) {
  const buckets = new Uint16Array(PATTERN_SPACE);

  for (const answer of candidates) {
    buckets[scoreGuessEncoded(guess, answer)]++;
  }

  const total = candidates.length;
  let entropy = 0;
  let expectedLeft = 0;
  let worstCase = 0;
  let partitions = 0;

  for (let i = 0; i < PATTERN_SPACE; i++) {
    const count = buckets[i];
    if (!count) continue;
    partitions++;
    const p = count / total;
    entropy -= p * Math.log2(p);
    expectedLeft += p * count;
    if (count > worstCase) worstCase = count;
  }

  const isCandidate = candidateSet ? candidateSet.has(guess) : candidates.includes(guess);
  const answerProbability = isCandidate ? 1 / total : 0;
  const combined = entropy + 0.15 * answerProbability - 0.0005 * worstCase;

  return {
    guess,
    entropy,
    expectedLeft,
    worstCase,
    partitions,
    answerProbability,
    isCandidate,
    combined
  };
}

export function rankGuesses(candidates, guesses, limit = 10, forceMode = "auto") {
  const pool = chooseGuessPool(candidates, guesses, MODE_THRESHOLD, forceMode);
  const candidateSet = new Set(candidates);
  const ranked = [];

  for (const guess of pool) {
    ranked.push(analyseGuess(guess, candidates, candidateSet));
  }

  ranked.sort((a, b) => {
    if (b.combined !== a.combined) return b.combined - a.combined;
    if (b.entropy !== a.entropy) return b.entropy - a.entropy;
    if (a.expectedLeft !== b.expectedLeft) return a.expectedLeft - b.expectedLeft;
    if (a.isCandidate !== b.isCandidate) return a.isCandidate ? -1 : 1;
    return a.guess.localeCompare(b.guess);
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
