import "./solver-core.module.js?v=20260406.3";

const { ANSWER_COUNT, uniqueWords } = globalThis.SolverCore || {};

export const WORD_SOURCE_URL = "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";
export const WORD_CACHE_KEY = "dwl:words:v1";
const WORD_FETCH_TIMEOUT_MS = 8000;

function getPreloadedWordLists() {
  if (!window.WordleWordlists) return null;
  const words = uniqueWords(window.WordleWordlists.WORDS);
  if (words.length < ANSWER_COUNT) return null;
  return {
    words,
    source: "WordleWordlists"
  };
}

function readCachedWords() {
  const cached = localStorage.getItem(WORD_CACHE_KEY);
  if (!cached) return [];
  try {
    return uniqueWords(JSON.parse(cached));
  } catch {
    return [];
  }
}

async function fetchWords() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORD_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(WORD_SOURCE_URL, {
      cache: "force-cache",
      signal: controller.signal
    });
    if (!res.ok) throw new Error("Word list download failed.");
    const text = await res.text();
    const words = uniqueWords(text.split(/\r?\n/));
    if (words.length < ANSWER_COUNT) {
      throw new Error("Downloaded word list is too small.");
    }
    localStorage.setItem(WORD_CACHE_KEY, JSON.stringify(words));
    return words;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Timed out downloading word list. Check your network and retry.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function getWindowWords() {
  if (Array.isArray(window.WORDS) && window.WORDS.length >= ANSWER_COUNT) {
    return uniqueWords(window.WORDS);
  }
  return [];
}

export async function loadWordLists() {
  const preloaded = getPreloadedWordLists();
  if (preloaded) {
    return {
      words: preloaded.words,
      answers: preloaded.words.slice(0, ANSWER_COUNT),
      guesses: preloaded.words,
      source: preloaded.source
    };
  }

  let words = getWindowWords();
  let source = "window.WORDS";

  if (!words.length) {
    words = readCachedWords();
    source = "localStorage";
  }

  if (!words.length) {
    words = await fetchWords();
    source = "remote";
  }

  if (words.length < ANSWER_COUNT) {
    throw new Error(`Need at least ${ANSWER_COUNT} words but only found ${words.length}.`);
  }

  return {
    words,
    answers: words.slice(0, ANSWER_COUNT),
    guesses: words,
    source
  };
}
