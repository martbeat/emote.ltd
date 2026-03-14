'use strict';

importScripts('solver-core.js');

const { rankGuesses } = self.WordleSolverCore;

self.onmessage = function onMessage(event) {
  const { type, payload } = event.data || {};

  if (type !== 'rank') return;

  const { candidates, guessPool, topN = 10 } = payload;
  const top = rankGuesses(candidates, guessPool, topN);

  self.postMessage({
    type: 'rank-result',
    payload: { top },
  });
};
