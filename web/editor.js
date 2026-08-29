import {
  filterJapanese,
  filterKana,
  isJapaneseChar,
  isKanji,
} from "./japanese.js";

const MAX_CHARACTERS = 12;
const MIN_READING_WIDTH = 54;
const MAX_READING_WIDTH = 82;

const characters = [];
const furiganaInputs = new Map();
let nextId = 0;
let isFull = false;
let limitTimer = 0;

const pageShell = document.querySelector(".page-shell");
const writingLine = document.querySelector(".writing-line");
const mirrorLine = document.querySelector(".mirror-line");
const composerUnit = document.querySelector(".composer-unit");
const mainInput = document.querySelector(".main-input");
const statusRow = document.querySelector(".status-row");
const compareBoard = document.querySelector(".compare-board");
const composerSizer = document.querySelector(".composer-sizer");
const cePlayground = document.querySelector(".width-preview-ce");

const PREVIEW_SAMPLE = "あいこと";
const CARET_FUDGE = 4;
const GEOMETRY_CLASSES = {
  natural: "is-geometry-natural",
  fixed: "is-geometry-fixed",
  frame: "is-geometry-frame",
};

let composingMain = false;
let lastCompositionCommit = null;
let activeWidthMode = "current";
let activeCap = "none";
let activeGeometry = "";
let measureCanvasContext = null;

function readingWidth(value) {
  const length = [...value].length;
  if (length === 0) return MIN_READING_WIDTH;
  return Math.min(MAX_READING_WIDTH, Math.max(MIN_READING_WIDTH, 18 + length * 13));
}

function furiganaIds() {
  return characters.filter((entry) => isKanji(entry.char)).map((entry) => entry.id);
}

function cssPx(style, name, fallback) {
  const parsed = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function graphemeCount(value) {
  return [...value].length;
}

function previewText() {
  return mainInput.value || PREVIEW_SAMPLE;
}

function kanjiSlotPx() {
  const fromMin = Number.parseFloat(getComputedStyle(composerUnit).minWidth);
  if (Number.isFinite(fromMin) && fromMin > 0) return fromMin;
  return cssPx(getComputedStyle(writingLine), "--kanji-slot", 74);
}

function remainingComposerWidth() {
  const lineStyle = window.getComputedStyle(writingLine);
  const padding =
    Number.parseFloat(lineStyle.paddingLeft) + Number.parseFloat(lineStyle.paddingRight);
  const available = writingLine.clientWidth - padding;
  const usedCharacterWidth = [...writingLine.children]
    .filter(
      (child) =>
        child.classList.contains("character-unit") &&
        !child.classList.contains("composer-unit")
    )
    .reduce((total, child) => total + child.getBoundingClientRect().width, 0);
  return Math.max(kanjiSlotPx(), available - usedCharacterWidth);
}

function applyWidthCap(width) {
  if (activeCap === "css") {
    return Math.min(width, Math.min(340, window.innerWidth * 0.28));
  }
  if (activeCap === "line") {
    return Math.min(width, remainingComposerWidth());
  }
  return width;
}

function panelAFont() {
  const probe = compareBoard?.querySelector('[data-panel="width"] .width-preview');
  const cs = getComputedStyle(probe || mainInput);
  return {
    family: cs.fontFamily,
    weight: cs.fontWeight,
    size: Number.parseFloat(cs.fontSize) || 64,
    paddingX:
      (Number.parseFloat(cs.paddingLeft) || 0) + (Number.parseFloat(cs.paddingRight) || 0),
  };
}

function configureSizer(font) {
  if (!composerSizer) return;
  composerSizer.style.fontFamily = font.family;
  composerSizer.style.fontSize = `${font.size}px`;
  composerSizer.style.fontWeight = font.weight;
  composerSizer.style.letterSpacing = "normal";
}

function measureSizer(text, font) {
  if (!composerSizer) return font.size * Math.max(1, graphemeCount(text));
  configureSizer(font);
  composerSizer.textContent = text.length ? text : "\u00a0";
  return composerSizer.offsetWidth;
}

function measureCanvas(text, font) {
  if (!measureCanvasContext) {
    measureCanvasContext = document.createElement("canvas").getContext("2d");
  }
  measureCanvasContext.font = `${font.weight} ${font.size}px ${font.family}`;
  return measureCanvasContext.measureText(text || " ").width;
}

function formatOverflowCaption(boxWidth, textWidth) {
  const overflow = Math.max(0, textWidth - boxWidth);
  const overflowLabel = overflow > 0.5 ? `+${Math.round(overflow)}` : "0";
  return `box ${Math.round(boxWidth)}px · text ${Math.round(textWidth)}px · overflow ${overflowLabel}px`;
}

const WIDTH_MODES = {
  current: {
    measure(value, font) {
      const n = Math.max(1, graphemeCount(value));
      const box = n * measureSizer("0", font) + font.paddingX;
      return applyWidthCap(Math.max(kanjiSlotPx(), box));
    },
    apply(input, value) {
      input.size = Math.max(1, graphemeCount(value) || 1);
      input.style.removeProperty("width");
      input.style.removeProperty("max-width");
      input.style.removeProperty("field-sizing");
    },
  },
  "em-per-char": {
    measure(value, font) {
      const n = Math.max(1, graphemeCount(value));
      const box = n * font.size + font.paddingX;
      return applyWidthCap(Math.max(kanjiSlotPx(), box));
    },
    apply(input, value) {
      const cs = getComputedStyle(input);
      const font = {
        family: cs.fontFamily,
        weight: cs.fontWeight,
        size: Number.parseFloat(cs.fontSize) || 64,
        paddingX:
          (Number.parseFloat(cs.paddingLeft) || 0) +
          (Number.parseFloat(cs.paddingRight) || 0),
      };
      const width = value
        ? WIDTH_MODES["em-per-char"].measure(value, font)
        : kanjiSlotPx();
      input.size = 1;
      input.style.fieldSizing = "fixed";
      input.style.width = `${width}px`;
      input.style.maxWidth = "none";
    },
  },
  "sizer-span": {
    measure(value, font) {
      const box = measureSizer(value, font) + font.paddingX + CARET_FUDGE;
      return applyWidthCap(Math.max(kanjiSlotPx(), box));
    },
    apply(input, value) {
      const cs = getComputedStyle(input);
      const font = {
        family: cs.fontFamily,
        weight: cs.fontWeight,
        size: Number.parseFloat(cs.fontSize) || 64,
        paddingX:
          (Number.parseFloat(cs.paddingLeft) || 0) +
          (Number.parseFloat(cs.paddingRight) || 0),
      };
      const width = value
        ? WIDTH_MODES["sizer-span"].measure(value, font)
        : kanjiSlotPx();
      input.size = 1;
      input.style.fieldSizing = "fixed";
      input.style.width = `${width}px`;
      input.style.maxWidth = "none";
    },
  },
  measureText: {
    measure(value, font) {
      const box = measureCanvas(value, font) + font.paddingX + CARET_FUDGE;
      return applyWidthCap(Math.max(kanjiSlotPx(), box));
    },
    apply(input, value) {
      const cs = getComputedStyle(input);
      const font = {
        family: cs.fontFamily,
        weight: cs.fontWeight,
        size: Number.parseFloat(cs.fontSize) || 64,
        paddingX:
          (Number.parseFloat(cs.paddingLeft) || 0) +
          (Number.parseFloat(cs.paddingRight) || 0),
      };
      const width = value
        ? WIDTH_MODES.measureText.measure(value, font)
        : kanjiSlotPx();
      input.size = 1;
      input.style.fieldSizing = "fixed";
      input.style.width = `${width}px`;
      input.style.maxWidth = "none";
    },
  },
};

function applyGeometry(mode) {
  for (const className of Object.values(GEOMETRY_CLASSES)) {
    composerUnit.classList.remove(className);
  }
  if (mode && GEOMETRY_CLASSES[mode]) {
    composerUnit.classList.add(GEOMETRY_CLASSES[mode]);
    pageShell.dataset.composerGeometry = mode;
  } else {
    delete pageShell.dataset.composerGeometry;
  }
}

function updateCompareSelection() {
  if (!compareBoard) return;
  for (const row of compareBoard.querySelectorAll(".compare-row[data-width-mode]")) {
    const selected = row.dataset.widthMode === activeWidthMode;
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-pressed", String(selected));
  }
  for (const row of compareBoard.querySelectorAll("[data-geometry-mode]")) {
    if (row.dataset.geometryMode === "contenteditable") continue;
    const selected = row.dataset.geometryMode === activeGeometry;
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-pressed", String(selected));
  }
}

function syncComposerWidth() {
  pageShell.dataset.composerWidth = activeWidthMode;
  pageShell.dataset.widthCap = activeCap;
  if (activeCap === "line") {
    pageShell.style.setProperty("--composer-line-cap", `${remainingComposerWidth()}px`);
  } else {
    pageShell.style.removeProperty("--composer-line-cap");
  }
  WIDTH_MODES[activeWidthMode].apply(mainInput, mainInput.value);
}

function syncComparePreviews() {
  if (!compareBoard) return;
  const text = previewText();
  const font = panelAFont();
  const textWidth = measureSizer(text, font);

  for (const row of compareBoard.querySelectorAll(".compare-row[data-width-mode]")) {
    const mode = row.dataset.widthMode;
    const box = WIDTH_MODES[mode].measure(text, font);
    const preview = row.querySelector(".width-preview");
    const caption = row.querySelector(".compare-caption");
    const label = row.querySelector(".width-preview-text");
    preview.style.width = `${box}px`;
    label.textContent = text;
    caption.textContent = formatOverflowCaption(box, textWidth);
  }

  for (const row of compareBoard.querySelectorAll("[data-geometry-mode]")) {
    if (row.dataset.geometryMode === "contenteditable") continue;
    const preview = row.querySelector(".width-preview");
    const label = row.querySelector(".width-preview-text");
    const caption = row.querySelector(".compare-caption");
    label.textContent = text;
    preview.style.width = "max-content";
    const box = preview.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    const fontSize = Number.parseFloat(getComputedStyle(preview).fontSize) || 0;
    const overflow = Math.max(0, labelBox.width - box.width);
    const overflowLabel = overflow > 0.5 ? `+${Math.round(overflow)}` : "0";
    caption.textContent = `box ${Math.round(box.width)}px · text ${Math.round(labelBox.width)}px · overflow ${overflowLabel}px · boxH ${Math.round(box.height)}px · font ${Math.round(fontSize)}px`;
  }

  if (cePlayground && document.activeElement !== cePlayground) {
    cePlayground.textContent = text;
  }
}

function syncComposerChrome() {
  syncComposerWidth();
  syncComparePreviews();
}

function getLineMetrics() {
  if (!composerUnit) return null;

  const lineStyle = window.getComputedStyle(writingLine);
  const composerStyle = window.getComputedStyle(composerUnit);
  const kanjiSlot =
    Number.parseFloat(composerStyle.minWidth) ||
    cssPx(lineStyle, "--kanji-slot", 74);
  const readingReserve = cssPx(lineStyle, "--reading-max", kanjiSlot);
  const kanaSlot = cssPx(lineStyle, "--kana-slot", kanjiSlot * 0.85);
  const padding =
    Number.parseFloat(lineStyle.paddingLeft) + Number.parseFloat(lineStyle.paddingRight);

  const usedCharacterWidth = [...writingLine.children]
    .filter(
      (child) =>
        child.classList.contains("character-unit") &&
        !child.classList.contains("composer-unit")
    )
    .reduce((total, child) => total + child.getBoundingClientRect().width, 0);

  return {
    available: writingLine.clientWidth - padding,
    used: usedCharacterWidth + kanjiSlot,
    kanjiWidth: Math.max(kanjiSlot, readingReserve),
    kanaWidth: kanaSlot,
  };
}

function recalculateFull() {
  if (characters.length >= MAX_CHARACTERS) {
    isFull = true;
  } else {
    const metrics = getLineMetrics();
    isFull = metrics
      ? metrics.used + metrics.kanjiWidth > metrics.available + 0.5
      : false;
  }
  composerUnit.classList.toggle("is-full", isFull);
  mainInput.readOnly = isFull;
  mainInput.setAttribute("aria-disabled", String(isFull));
  mainInput.placeholder = isFull ? "満" : "入力";
  updateStatus();
}

function updateStatus() {
  if (limitTimer || isFull) {
    statusRow.innerHTML =
      '<span class="limit-message">Line full · Backspace to continue</span>';
  } else {
    statusRow.innerHTML = '<span class="status-spacer" aria-hidden="true"></span>';
  }
}

function showLimitNotice() {
  window.clearTimeout(limitTimer);
  limitTimer = window.setTimeout(() => {
    limitTimer = 0;
    updateStatus();
  }, 1700);
  updateStatus();
}

function createCharColumn(entry) {
  const canHaveReading = isKanji(entry.char);
  const unit = document.createElement("div");
  unit.className = `character-unit${canHaveReading ? " has-reading" : " kana-unit"}`;
  unit.dataset.id = String(entry.id);

  const readingArea = document.createElement("div");
  readingArea.className = "reading-area";

  if (canHaveReading) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "furigana-input";
    input.maxLength = 5;
    input.setAttribute("aria-label", `Furigana for ${entry.char}`);
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.inputMode = "text";
    input.style.setProperty("--reading-width", `${readingWidth("")}px`);

    let composing = false;

    function commitValue(value) {
      const filtered = filterKana(value);
      input.value = filtered;
      entry.furigana = filtered;
      input.style.setProperty("--reading-width", `${readingWidth(filtered)}px`);
    }

    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (!composing && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        handleFuriganaArrow(entry.id, event.key === "ArrowLeft" ? -1 : 1);
      }
    });
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", (event) => {
      composing = false;
      commitValue(event.currentTarget.value);
    });
    input.addEventListener("input", (event) => {
      if (!composing) commitValue(event.currentTarget.value);
      else {
        input.style.setProperty(
          "--reading-width",
          `${readingWidth(event.currentTarget.value)}px`
        );
      }
    });

    furiganaInputs.set(entry.id, input);
    readingArea.append(input);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "reading-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    readingArea.append(placeholder);
  }

  const display = document.createElement("span");
  display.className = `char-display ${canHaveReading ? "kanji-display" : "kana-display"}`;
  display.textContent = entry.char;

  unit.append(readingArea, display);
  return unit;
}

function createMirrorColumn(entry) {
  const canHaveReading = isKanji(entry.char);
  const unit = document.createElement("div");
  unit.className = `mirror-unit${canHaveReading ? " has-reading" : " kana-unit"}`;
  unit.dataset.id = String(entry.id);

  const display = document.createElement("span");
  display.className = `mirror-char ${canHaveReading ? "kanji-display" : "kana-display"}`;
  display.textContent = entry.char;

  unit.append(display);
  return unit;
}

function syncMirrorLine() {
  const existing = [...mirrorLine.querySelectorAll(".mirror-unit")];
  const byId = new Map(existing.map((node) => [Number(node.dataset.id), node]));
  const wanted = new Set(characters.map((entry) => entry.id));

  for (const node of existing) {
    const id = Number(node.dataset.id);
    if (!wanted.has(id)) node.remove();
  }

  for (const entry of characters) {
    if (!byId.has(entry.id)) {
      mirrorLine.append(createMirrorColumn(entry));
    }
  }
}

function syncWritingLine() {
  const existing = [...writingLine.querySelectorAll(".character-unit:not(.composer-unit)")];
  const byId = new Map(existing.map((node) => [Number(node.dataset.id), node]));
  const wanted = new Set(characters.map((entry) => entry.id));

  for (const node of existing) {
    const id = Number(node.dataset.id);
    if (!wanted.has(id)) {
      furiganaInputs.delete(id);
      node.remove();
    }
  }

  for (const entry of characters) {
    if (!byId.has(entry.id)) {
      writingLine.insertBefore(createCharColumn(entry), composerUnit);
    }
  }

  syncMirrorLine();
  recalculateFull();
}

function addCharacters(chars) {
  const metrics = getLineMetrics();
  let remainingWidth = metrics ? metrics.available - metrics.used : Number.POSITIVE_INFINITY;
  let remainingCount = MAX_CHARACTERS - characters.length;
  const accepted = [];

  for (const char of chars) {
    if (remainingCount <= 0) break;
    const predictedWidth = metrics
      ? isKanji(char)
        ? metrics.kanjiWidth
        : metrics.kanaWidth
      : 0;
    if (metrics && predictedWidth > remainingWidth + 0.5) break;
    accepted.push(char);
    remainingWidth -= predictedWidth;
    remainingCount -= 1;
  }

  if (accepted.length < chars.length) showLimitNotice();
  if (accepted.length === 0) return;

  for (const char of accepted) {
    characters.push({ id: nextId++, char, furigana: "" });
  }
  syncWritingLine();
}

function removeLast() {
  window.clearTimeout(limitTimer);
  limitTimer = 0;
  if (characters.length === 0) return;
  characters.pop();
  syncWritingLine();
  syncComposerChrome();
}

function focusFuriganaAt(index) {
  const ids = furiganaIds();
  if (index < 0 || index >= ids.length) return;
  const input = furiganaInputs.get(ids[index]);
  if (!input) return;
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

function handleFuriganaArrow(id, direction) {
  const ids = furiganaIds();
  const index = ids.indexOf(id);
  if (index === -1) return;
  const nextIndex = index + direction;
  if (nextIndex >= ids.length) {
    mainInput.focus();
    return;
  }
  focusFuriganaAt(nextIndex);
}

function commitMainInput(value) {
  const chars = [...value].filter(isJapaneseChar);
  mainInput.value = "";
  if (chars.length === 0) {
    queueMicrotask(syncComposerChrome);
    return false;
  }
  addCharacters(chars);
  queueMicrotask(syncComposerChrome);
  return true;
}

function focusMainInput() {
  mainInput.focus();
}

writingLine.addEventListener("click", focusMainInput);
mirrorLine.addEventListener("click", focusMainInput);

mainInput.addEventListener("click", (event) => event.stopPropagation());

mainInput.addEventListener("compositionstart", () => {
  if (!isFull) composingMain = true;
});

mainInput.addEventListener("compositionupdate", () => {
  syncComposerChrome();
});

mainInput.addEventListener("compositionend", (event) => {
  composingMain = false;
  if (isFull) {
    mainInput.value = "";
    syncComposerChrome();
    return;
  }
  const value = event.currentTarget.value;
  const committed = commitMainInput(value);
  lastCompositionCommit = committed ? value : null;
});

mainInput.addEventListener("input", (event) => {
  if (isFull) {
    mainInput.value = "";
    syncComposerChrome();
    return;
  }

  const value = event.currentTarget.value;
  if (lastCompositionCommit === value) {
    lastCompositionCommit = null;
    syncComposerChrome();
    return;
  }
  lastCompositionCommit = null;

  if (!composingMain && [...value].some(isJapaneseChar)) {
    commitMainInput(value);
    return;
  }

  syncComposerChrome();
});

mainInput.addEventListener("keydown", (event) => {
  if (event.key === "Backspace" && mainInput.value === "" && !composingMain) {
    event.preventDefault();
    removeLast();
  }
  if (event.key === "ArrowLeft" && mainInput.value === "" && !composingMain) {
    event.preventDefault();
    focusFuriganaAt(furiganaIds().length - 1);
  }
});

mainInput.addEventListener("paste", (event) => {
  event.preventDefault();
  if (isFull) return;
  const pasted = filterJapanese(event.clipboardData.getData("text"));
  if (!pasted) return;
  addCharacters([...pasted]);
  mainInput.value = "";
  queueMicrotask(syncComposerChrome);
});

if (compareBoard) {
  compareBoard.addEventListener("click", (event) => {
    if (event.target.closest(".width-preview-ce")) return;
    if (event.target.closest(".compare-caps")) return;

    const widthRow = event.target.closest(".compare-row[data-width-mode]");
    if (widthRow) {
      activeWidthMode = widthRow.dataset.widthMode;
      updateCompareSelection();
      syncComposerChrome();
      mainInput.focus();
      return;
    }

    const geometryRow = event.target.closest(".compare-row[data-geometry-mode]");
    if (!geometryRow) return;
    const mode = geometryRow.dataset.geometryMode;
    if (mode === "contenteditable") return;
    activeGeometry = activeGeometry === mode ? "" : mode;
    applyGeometry(activeGeometry);
    updateCompareSelection();
    syncComposerChrome();
    mainInput.focus();
  });

  compareBoard.addEventListener("change", (event) => {
    if (event.target.name !== "width-cap") return;
    activeCap = event.target.value;
    syncComposerChrome();
  });
}

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    recalculateFull();
    syncComposerChrome();
  }).observe(writingLine);
}

if (document.fonts?.ready) {
  document.fonts.ready.then(() => syncComposerChrome());
}

recalculateFull();
syncComposerChrome();
mainInput.focus();
