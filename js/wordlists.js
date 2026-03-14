import { ANSWER_COUNT, uniqueWords } from "./solver-core.js";

export const WORD_SOURCE_URL = "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";
export const WORD_CACHE_KEY = "dwl:words:v1";

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
  const res = await fetch(WORD_SOURCE_URL, { cache: "force-cache" });
  if (!res.ok) throw new Error("Word list download failed.");
  const text = await res.text();
  const words = uniqueWords(text.split(/\r?\n/));
  if (words.length < ANSWER_COUNT) {
    throw new Error("Downloaded word list is too small.");
  }
  localStorage.setItem(WORD_CACHE_KEY, JSON.stringify(words));
  return words;
}

function getWindowWords() {
  if (Array.isArray(window.WORDS) && window.WORDS.length >= ANSWER_COUNT) {
    return uniqueWords(window.WORDS);
  }
  return [];
}

export async function loadWordLists() {
  let words = getWindowWords();

  if (!words.length) {
    words = readCachedWords();
  }

  if (!words.length) {
    words = await fetchWords();
  }

  if (words.length < ANSWER_COUNT) {
    throw new Error(`Need at least ${ANSWER_COUNT} words but only found ${words.length}.`);
  }

  return {
    words,
    answers: words.slice(0, ANSWER_COUNT),
    guesses: words
  };
}