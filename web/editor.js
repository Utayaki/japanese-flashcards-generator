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

const writingLine = document.querySelector(".writing-line");
const mirrorLine = document.querySelector(".mirror-line");
const composerUnit = document.querySelector(".composer-unit");
const mainInput = document.querySelector(".main-input");
const statusRow = document.querySelector(".status-row");

let composingMain = false;
let lastCompositionCommit = null;

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
  if (chars.length === 0) {
    mainInput.value = "";
    mainInput.size = 1;
    return false;
  }
  addCharacters(chars);
  mainInput.value = "";
  mainInput.size = 1;
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

mainInput.addEventListener("compositionend", (event) => {
  composingMain = false;
  if (isFull) {
    mainInput.value = "";
    mainInput.size = 1;
    return;
  }
  const value = event.currentTarget.value;
  const committed = commitMainInput(value);
  lastCompositionCommit = committed ? value : null;
});

mainInput.addEventListener("input", (event) => {
  if (isFull) {
    mainInput.value = "";
    mainInput.size = 1;
    return;
  }

  const value = event.currentTarget.value;
  if (lastCompositionCommit === value) {
    lastCompositionCommit = null;
    return;
  }
  lastCompositionCommit = null;
  mainInput.size = Math.max(1, [...value].length);

  if (!composingMain && [...value].some(isJapaneseChar)) {
    commitMainInput(value);
  }
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
  mainInput.size = 1;
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => recalculateFull()).observe(writingLine);
}

recalculateFull();
mainInput.focus();
