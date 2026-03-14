const LETTERS_PER_WORD = 5;
const FEEDBACK_GREEN = "G";
const FEEDBACK_YELLOW = "Y";
const FEEDBACK_BLACK = "B";

// guess -> (solution -> patternKey)
const feedbackCache = new Map();

/**
 * Simulates Wordle feedback for a guess against a concrete solution.
 * @param {string} guess
 * @param {string} solution
 * @returns {string[]} feedback array of ["G"|"Y"|"B", ...]
 */
export function simulateFeedback(guess, solution) {
  const feedback = new Array(LETTERS_PER_WORD);
  const remainingCounts = new Int16Array(26);

  for (let i = 0; i < LETTERS_PER_WORD; i += 1) {
    const guessChar = guess.charCodeAt(i);
    const solutionChar = solution.charCodeAt(i);

    if (guessChar === solutionChar) {
      feedback[i] = FEEDBACK_GREEN;
    } else {
      const index = solutionChar - 97;
      if (index >= 0 && index < 26) {
        remainingCounts[index] += 1;
      }
    }
  }

  for (let i = 0; i < LETTERS_PER_WORD; i += 1) {
    if (feedback[i] === FEEDBACK_GREEN) {
      continue;
    }

    const index = guess.charCodeAt(i) - 97;
    if (index >= 0 && index < 26 && remainingCounts[index] > 0) {
      feedback[i] = FEEDBACK_YELLOW;
      remainingCounts[index] -= 1;
    } else {
      feedback[i] = FEEDBACK_BLACK;
    }
  }

  return feedback;
}

/**
 * Converts a feedback array into a stable key for map/group operations.
 * @param {string[]} feedbackArray
 * @returns {string}
 */
export function generatePatternKey(feedbackArray) {
  return feedbackArray.join(",");
}

function getCachedPatternKey(guess, solution) {
  let guessCache = feedbackCache.get(guess);
  if (!guessCache) {
    guessCache = new Map();
    feedbackCache.set(guess, guessCache);
  }

  let patternKey = guessCache.get(solution);
  if (patternKey) {
    return patternKey;
  }

  patternKey = generatePatternKey(simulateFeedback(guess, solution));
  guessCache.set(solution, patternKey);
  return patternKey;
}

/**
 * Computes Shannon entropy in bits for a guess over candidate solutions.
 * @param {string} guess
 * @param {string[]} candidateWords
 * @returns {number}
 */
export function computeEntropy(guess, candidateWords) {
  if (!Array.isArray(candidateWords) || candidateWords.length === 0) {
    return 0;
  }

  const patternCounts = new Map();
  const total = candidateWords.length;

  for (let i = 0; i < total; i += 1) {
    const solution = candidateWords[i];
    const patternKey = getCachedPatternKey(guess, solution);
    patternCounts.set(patternKey, (patternCounts.get(patternKey) || 0) + 1);
  }

  let entropy = 0;
  for (const count of patternCounts.values()) {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Scores every allowed guess by entropy.
 * @param {string[]} candidateWords currently viable solutions
 * @param {string[]} dictionary all allowed guess words
 * @returns {{guess: string, entropy: number}[]}
 */
export function scoreAllGuesses(candidateWords, dictionary) {
  if (!Array.isArray(dictionary) || dictionary.length === 0) {
    return [];
  }

  const scores = new Array(dictionary.length);
  for (let i = 0; i < dictionary.length; i += 1) {
    const guess = dictionary[i];
    scores[i] = {
      guess,
      entropy: computeEntropy(guess, candidateWords)
    };
  }

  scores.sort((a, b) => b.entropy - a.entropy || a.guess.localeCompare(b.guess));
  return scores;
}
