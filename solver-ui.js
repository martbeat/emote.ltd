(function (global) {
  'use strict';

  const { ANSWERS, GUESSES } = global.WordleWordlists;
  const { SolverState } = global.WordleSolverCore;

  class WordleSolverUI {
    constructor(workerUrl = 'solver-worker.js') {
      this.state = new SolverState(ANSWERS);
      this.worker = new Worker(workerUrl);
      this.pending = null;

      this.worker.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type !== 'rank-result') return;
        if (!this.pending) return;
        this.pending.resolve(payload.top);
        this.pending = null;
      };

      this.worker.onerror = (error) => {
        if (!this.pending) return;
        this.pending.reject(error);
        this.pending = null;
      };
    }

    reset() {
      this.state.reset();
    }

    applyFeedback(guess, patternCode) {
      return this.state.applyFeedback(guess, patternCode);
    }

    async getTopGuesses(topN = 10) {
      if (this.pending) {
        throw new Error('Ranking already in progress');
      }

      const candidates = this.state.candidates.slice();
      const guessPool = this.state.chooseGuessPool(GUESSES).slice();

      return new Promise((resolve, reject) => {
        this.pending = { resolve, reject };
        this.worker.postMessage({
          type: 'rank',
          payload: {
            candidates,
            guessPool,
            topN,
          },
        });
      });
    }

    terminate() {
      this.worker.terminate();
      this.pending = null;
    }
  }

  global.WordleSolverUI = {
    WordleSolverUI,
  };
})(typeof self !== 'undefined' ? self : window);
