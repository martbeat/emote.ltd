const fileInput = document.getElementById('fileInput');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const playPauseBtn = document.getElementById('playPauseBtn');
const restartBtn = document.getElementById('restartBtn');
const wordDisplay = document.getElementById('wordDisplay');
const statusText = document.getElementById('statusText');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const sectionSelect = document.getElementById('sectionSelect');
const positionRange = document.getElementById('positionRange');
const positionValue = document.getElementById('positionValue');
const sectionBadge = document.getElementById('sectionBadge');

let words = [];
let sections = [];
let currentIndex = 0;
let timerId = null;
let isPlaying = false;
let pdfjsLib;

const ORP_POSITION_MAP = [0, 0, 1, 1, 1, 2, 2, 2, 3];

function tokenize(text) {
  return text
    .replace(/[\r\n]+/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function isLikelyHeading(line) {
  const cleaned = line.trim();
  if (!cleaned) return false;
  if (/^(chapter|section|part|prologue|epilogue)\b/i.test(cleaned)) return true;
  if (/^#{1,6}\s+/.test(cleaned)) return true;
  if (/^\d+(\.\d+)*\s+/.test(cleaned)) return true;
  const alpha = cleaned.replace(/[^a-z]/gi, '');
  const uppercaseRatio = alpha ? (alpha.match(/[A-Z]/g) || []).length / alpha.length : 0;
  return cleaned.length <= 70 && uppercaseRatio > 0.75;
}

function buildSectionsFromText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const detected = [];
  let currentTitle = 'Start';
  let currentBuffer = [];

  for (const line of lines) {
    if (isLikelyHeading(line) && currentBuffer.length) {
      detected.push({ title: currentTitle, words: tokenize(currentBuffer.join(' ')) });
      currentTitle = line.replace(/^#{1,6}\s+/, '');
      currentBuffer = [];
      continue;
    }
    if (isLikelyHeading(line) && !currentBuffer.length) {
      currentTitle = line.replace(/^#{1,6}\s+/, '');
      continue;
    }
    currentBuffer.push(line);
  }

  if (currentBuffer.length) {
    detected.push({ title: currentTitle, words: tokenize(currentBuffer.join(' ')) });
  }

  const normalized = detected.filter((section) => section.words.length);
  if (normalized.length > 1) return normalized;

  const allWords = tokenize(text);
  const chunkSize = 300;
  const fallback = [];
  for (let i = 0; i < allWords.length; i += chunkSize) {
    fallback.push({
      title: `Part ${Math.floor(i / chunkSize) + 1}`,
      words: allWords.slice(i, i + chunkSize),
    });
  }
  return fallback;
}

function flattenSections(sectionData) {
  const fullWords = [];
  const normalizedSections = [];

  for (const section of sectionData) {
    const start = fullWords.length;
    for (const word of section.words) {
      fullWords.push(word);
    }
    if (fullWords.length > start) {
      normalizedSections.push({ title: section.title, startIndex: start, endIndex: fullWords.length - 1 });
    }
  }

  return { fullWords, normalizedSections };
}

function getPivotIndex(word) {
  if (word.length <= ORP_POSITION_MAP.length) return ORP_POSITION_MAP[word.length - 1];
  return Math.floor(word.length * 0.35);
}

function decorateWord(rawWord) {
  const cleanWord = rawWord.trim();
  if (!cleanWord) return '';
  const pivotIndex = Math.min(getPivotIndex(cleanWord), cleanWord.length - 1);
  return `${cleanWord.slice(0, pivotIndex)}<span class="pivot">${cleanWord.charAt(pivotIndex)}</span>${cleanWord.slice(pivotIndex + 1)}`;
}

function getSectionForIndex(index) {
  return sections.find((section) => index >= section.startIndex && index <= section.endIndex) || sections[0];
}

function updateJumpControls() {
  const percent = words.length ? Math.round((Math.min(currentIndex, words.length) / words.length) * 100) : 0;
  positionRange.value = percent;
  positionValue.textContent = `${percent}%`;

  const activeSection = getSectionForIndex(Math.max(0, currentIndex - 1));
  if (activeSection) {
    sectionSelect.value = String(activeSection.startIndex);
    sectionBadge.textContent = activeSection.title;
  } else {
    sectionBadge.textContent = 'No section';
  }
}

function updateProgress() {
  progressText.textContent = `${Math.min(currentIndex, words.length)} / ${words.length}`;
  progressBar.max = words.length || 1;
  progressBar.value = Math.min(currentIndex, words.length);
  updateJumpControls();
}

function getIntervalMs() {
  return 60000 / Number(speedRange.value);
}

function stopPlayback(setButtonText = true) {
  if (timerId) clearTimeout(timerId);
  timerId = null;
  isPlaying = false;
  if (setButtonText) playPauseBtn.textContent = 'Play';
}

function showWord(index) {
  if (!words[index]) {
    wordDisplay.textContent = 'Done';
    return;
  }
  wordDisplay.innerHTML = decorateWord(words[index]);
}

function jumpToIndex(index) {
  currentIndex = Math.max(0, Math.min(index, Math.max(0, words.length - 1)));
  showWord(currentIndex);
  updateProgress();
  statusText.textContent = `Jumped to word ${currentIndex + 1}.`;
}

function tick() {
  if (!isPlaying) return;
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
  if (!words.length) return;
  isPlaying = true;
  playPauseBtn.textContent = 'Pause';
  statusText.textContent = `Reading at ${speedRange.value} WPM.`;
  tick();
}

function togglePlayback() {
  if (!words.length) return;
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

function populateSections() {
  sectionSelect.innerHTML = '';
  for (const section of sections) {
    const option = document.createElement('option');
    option.value = String(section.startIndex);
    option.textContent = `${section.title} (${section.startIndex + 1})`;
    sectionSelect.appendChild(option);
  }
}

async function parseTextFile(file) { return file.text(); }

async function parsePdf(file) {
  if (!pdfjsLib) {
    pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  let text = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const content = await (await pdf.getPage(pageNum)).getTextContent();
    text += `${content.items.map((item) => item.str).join(' ')}\n`;
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
    const spine = await book.loaded.spine;
    let collected = '';
    for (const section of spine.items) {
      const doc = await section.load(book.load.bind(book));
      collected += `${doc.body?.textContent || ''}\n`;
      section.unload();
    }
    return collected;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function parseFileToText(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'txt') return parseTextFile(file);
  if (extension === 'pdf') return parsePdf(file);
  if (extension === 'docx') return parseDocx(file);
  if (extension === 'epub') return parseEpub(file);
  throw new Error('Unsupported file type. Please use TXT, PDF, DOCX, or EPUB.');
}

async function handleFileSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  statusText.textContent = `Loading ${file.name}...`;
  wordDisplay.textContent = 'Loading…';
  playPauseBtn.disabled = true;
  restartBtn.disabled = true;
  sectionSelect.disabled = true;
  positionRange.disabled = true;

  try {
    const text = await parseFileToText(file);
    const parsedSections = buildSectionsFromText(text);
    const flattened = flattenSections(parsedSections);
    words = flattened.fullWords;
    sections = flattened.normalizedSections;
    currentIndex = 0;

    if (!words.length) throw new Error('No readable words found in this file.');

    populateSections();
    showWord(0);
    updateProgress();
    playPauseBtn.disabled = false;
    restartBtn.disabled = false;
    sectionSelect.disabled = false;
    positionRange.disabled = false;
    playPauseBtn.textContent = 'Play';
    statusText.textContent = `${words.length} words loaded from ${file.name}. ${sections.length} jump points available.`;
  } catch (error) {
    words = [];
    sections = [];
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

sectionSelect.addEventListener('change', (event) => {
  if (!words.length) return;
  stopPlayback();
  jumpToIndex(Number(event.target.value));
});

positionRange.addEventListener('input', () => {
  positionValue.textContent = `${positionRange.value}%`;
});

positionRange.addEventListener('change', () => {
  if (!words.length) return;
  stopPlayback();
  const target = Math.floor((Number(positionRange.value) / 100) * Math.max(0, words.length - 1));
  jumpToIndex(target);
});

fileInput.addEventListener('change', handleFileSelection);
playPauseBtn.addEventListener('click', togglePlayback);
restartBtn.addEventListener('click', resetReader);
updateProgress();
