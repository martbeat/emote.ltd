(function (global) {
  'use strict';

  if (!Array.isArray(global.WORDS)) {
    throw new Error('wordlists.js requires global WORDS to be loaded first');
  }

  const WORDS = global.WORDS;
  const ANSWERS = WORDS.slice(0, 2315);
  const GUESSES = WORDS;

  global.WordleWordlists = {
    WORDS,
    ANSWERS,
    GUESSES,
  };
})(typeof self !== 'undefined' ? self : window);
