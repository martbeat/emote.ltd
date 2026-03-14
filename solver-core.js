(function (global) {
  'use strict';

  const WORD_LEN = 5;
  const PATTERN_SPACE = 3 ** WORD_LEN; // 243 => 0..242

  function encodePattern(guess, answer) {
    const counts = new Uint8Array(26);
    const marks = new Uint8Array(WORD_LEN); // 0=b,1=y,2=g

    for (let i = 0; i < WORD_LEN; i += 1) {
      counts[answer.charCodeAt(i) - 97] += 1;
    }

    for (let i = 0; i < WORD_LEN; i += 1) {
      if (guess.charCodeAt(i) === answer.charCodeAt(i)) {
        marks[i] = 2;
        counts[guess.charCodeAt(i) - 97] -= 1;
      }
    }

    for (let i = 0; i < WORD_LEN; i += 1) {
      if (marks[i] !== 0) continue;
      const idx = guess.charCodeAt(i) - 97;
      if (counts[idx] > 0) {
        marks[i] = 1;
        counts[idx] -= 1;
      }
    }

    let code = 0;
    for (let i = 0; i < WORD_LEN; i += 1) {
      code += marks[i] * (3 ** i);
    }
    return code;
  }

  function decodePattern(code) {
    const out = new Array(WORD_LEN);
    for (let i = 0; i < WORD_LEN; i += 1) {
      const trit = code % 3;
      code = Math.floor(code / 3);
      out[i] = trit === 2 ? 'g' : trit === 1 ? 'y' : 'b';
    }
    return out.join('');
  }

  function filterCandidates(candidates, guess, patternCode) {
    return candidates.filter((answer) => encodePattern(guess, answer) === patternCode);
  }

  function entropyForGuess(guess, candidates) {
    const buckets = new Uint16Array(PATTERN_SPACE);
    const total = candidates.length;

    for (let i = 0; i < total; i += 1) {
      const patternCode = encodePattern(guess, candidates[i]);
      buckets[patternCode] += 1;
    }

    let entropy = 0;
    for (let i = 0; i < PATTERN_SPACE; i += 1) {
      const count = buckets[i];
      if (count === 0) continue;
      const p = count / total;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  function rankGuesses(candidates, guessPool, topN) {
    const scored = new Array(guessPool.length);

    for (let i = 0; i < guessPool.length; i += 1) {
      const guess = guessPool[i];
      scored[i] = {
        guess,
        entropy: entropyForGuess(guess, candidates),
      };
    }

    scored.sort((a, b) => {
      if (b.entropy !== a.entropy) return b.entropy - a.entropy;
      return a.guess.localeCompare(b.guess);
    });

    return scored.slice(0, topN);
  }

  class SolverState {
    constructor(answers) {
      this._allAnswers = answers.slice();
      this.candidates = answers.slice();
      this.history = [];
    }

    reset() {
      this.candidates = this._allAnswers.slice();
      this.history = [];
    }

    applyFeedback(guess, patternCode) {
      this.candidates = filterCandidates(this.candidates, guess, patternCode);
      this.history.push({ guess, patternCode });
      return this.candidates;
    }

    chooseGuessPool(allGuesses) {
      return this.candidates.length > 120 ? this.candidates : allGuesses;
    }
  }

  global.WordleSolverCore = {
    WORD_LEN,
    PATTERN_SPACE,
    encodePattern,
    decodePattern,
    filterCandidates,
    entropyForGuess,
    rankGuesses,
    SolverState,
  };
})(typeof self !== 'undefined' ? self : window);
