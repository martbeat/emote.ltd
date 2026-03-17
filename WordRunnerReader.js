const fileInput = document.getElementById('fileInput');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const playPauseBtn = document.getElementById('playPauseBtn');
const restartBtn = document.getElementById('restartBtn');
const wordDisplay = document.getElementById('wordDisplay');
const statusText = document.getElementById('statusText');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');

let words = [];
let currentIndex = 0;
let timerId = null;
let isPlaying = false;
let pdfjsLib;

const ORP_POSITION_MAP = [0, 0, 1, 1, 1, 2, 2, 2, 3];

function getPivotIndex(word) {
  if (word.length <= ORP_POSITION_MAP.length) {
    return ORP_POSITION_MAP[word.length - 1];
  }
  return Math.floor(word.length * 0.35);
}

function decorateWord(rawWord) {
  const cleanWord = rawWord.trim();
  if (!cleanWord) {
    return '';
  }

  const pivotIndex = Math.min(getPivotIndex(cleanWord), cleanWord.length - 1);
  const before = cleanWord.slice(0, pivotIndex);
  const pivot = cleanWord.charAt(pivotIndex);
  const after = cleanWord.slice(pivotIndex + 1);

  return `${before}<span class="pivot">${pivot}</span>${after}`;
}

function updateProgress() {
  progressText.textContent = `${Math.min(currentIndex, words.length)} / ${words.length}`;
  progressBar.max = words.length || 1;
  progressBar.value = Math.min(currentIndex, words.length);
}

function getIntervalMs() {
  const wpm = Number(speedRange.value);
  return 60000 / wpm;
}

function stopPlayback(setButtonText = true) {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  isPlaying = false;
  if (setButtonText) {
    playPauseBtn.textContent = 'Play';
  }
}

function showWord(index) {
  if (!words[index]) {
    wordDisplay.textContent = 'Done';
    return;
  }
  wordDisplay.innerHTML = decorateWord(words[index]);
}

function tick() {
  if (!isPlaying) {
    return;
  }

  if (currentIndex >= words.length) {
    stopPlayback();
    statusText.textContent = 'Finished reading.';
    return;
  }

  showWord(currentIndex);
  currentIndex += 1;
  updateProgress();

  timerId = setTimeout(tick, getIntervalMs());
}

function startPlayback() {
  if (!words.length) {
    return;
  }
  isPlaying = true;
  playPauseBtn.textContent = 'Pause';
  statusText.textContent = `Reading at ${speedRange.value} WPM.`;
  tick();
}

function togglePlayback() {
  if (!words.length) {
    return;
  }

  if (isPlaying) {
    stopPlayback();
    statusText.textContent = 'Paused.';
  } else {
    startPlayback();
  }
}

function resetReader() {
  stopPlayback();
  currentIndex = 0;
  showWord(0);
  updateProgress();
  statusText.textContent = words.length ? 'Ready to read.' : 'Choose a file to begin.';
}

function tokenize(text) {
  return text
    .replace(/[\r\n]+/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

async function parseTextFile(file) {
  return file.text();
}

async function parsePdf(file) {
  if (!pdfjsLib) {
    pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  let text = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    text += `${pageText} `;
  }

  return text;
}

async function parseDocx(file) {
  const { value } = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

async function parseEpub(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const book = window.ePub(objectUrl);
    await book.ready;
    await book.loaded.navigation;
    const sections = await book.loaded.spine;

    let collected = '';
    for (const section of sections.items) {
      const doc = await section.load(book.load.bind(book));
      const text = doc.body?.textContent || '';
      collected += `${text} `;
      section.unload();
    }
    return collected;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function parseFileToText(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return parseTextFile(file);
  }
  if (extension === 'pdf') {
    return parsePdf(file);
  }
  if (extension === 'docx') {
    return parseDocx(file);
  }
  if (extension === 'epub') {
    return parseEpub(file);
  }

  throw new Error('Unsupported file type. Please use TXT, PDF, DOCX, or EPUB.');
}

async function handleFileSelection(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  statusText.textContent = `Loading ${file.name}...`;
  wordDisplay.textContent = 'Loading…';
  playPauseBtn.disabled = true;
  restartBtn.disabled = true;

  try {
    const text = await parseFileToText(file);
    words = tokenize(text);
    currentIndex = 0;

    if (!words.length) {
      throw new Error('No readable words found in this file.');
    }

    showWord(0);
    updateProgress();
    playPauseBtn.disabled = false;
    restartBtn.disabled = false;
    playPauseBtn.textContent = 'Play';
    statusText.textContent = `${words.length} words loaded from ${file.name}.`;
  } catch (error) {
    words = [];
    currentIndex = 0;
    wordDisplay.textContent = 'Error';
    updateProgress();
    statusText.textContent = error.message || 'Could not parse the selected file.';
    stopPlayback(false);
  }
}

speedRange.addEventListener('input', () => {
  speedValue.textContent = speedRange.value;
  if (isPlaying) {
    stopPlayback(false);
    startPlayback();
  }
});

fileInput.addEventListener('change', handleFileSelection);
playPauseBtn.addEventListener('click', togglePlayback);
restartBtn.addEventListener('click', resetReader);

updateProgress();
