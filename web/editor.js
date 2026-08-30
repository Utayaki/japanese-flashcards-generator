import {
  filterAllowed,
  filterKana,
  isAllowed,
  isKana,
  isKanji,
} from "./japanese.js";

const MAX_CHARACTERS = 12;
const MIN_READING_WIDTH = 54;
const MAX_READING_WIDTH = 82;
const SOLO_READING_MAX = 5;

const characters = [];
const stitches = new Set();
const furiganaInputs = new Map();
let nextId = 0;
let isFull = false;
let limitTimer = 0;
let pendingFuriganaFocus = null;

const writingLine = document.querySelector(".writing-line");
const mirrorLine = document.querySelector(".mirror-line");
const composerUnit = document.querySelector(".composer-unit");
const composerShell = document.querySelector(".composer-shell");
const mainInput = document.querySelector(".main-input");
const statusRow = document.querySelector(".status-row");

let composingMain = false;
let lastCompositionCommit = null;

function seamKey(leftId, rightId) {
  return `${leftId}:${rightId}`;
}

function readingMaxLength(groupSize) {
  return Math.max(SOLO_READING_MAX, groupSize * 4);
}

function readingWidth(value, cap = MAX_READING_WIDTH) {
  const length = [...value].length;
  if (length === 0) return Math.min(MIN_READING_WIDTH, cap);
  return Math.min(cap, Math.max(MIN_READING_WIDTH, 18 + length * 13));
}

function clampReading(value, maxLength) {
  return [...filterKana(value)].slice(0, maxLength).join("");
}

function pruneStitches() {
  const valid = new Set();
  for (let i = 0; i < characters.length - 1; i += 1) {
    const left = characters[i];
    const right = characters[i + 1];
    const key = seamKey(left.id, right.id);
    if (isKanji(left.char) && isKanji(right.char) && stitches.has(key)) {
      valid.add(key);
    }
  }
  stitches.clear();
  for (const key of valid) stitches.add(key);
}

function readingGroups() {
  const groups = [];
  let i = 0;
  while (i < characters.length) {
    if (!isKanji(characters[i].char)) {
      i += 1;
      continue;
    }
    const members = [characters[i]];
    let j = i + 1;
    while (j < characters.length && isKanji(characters[j].char)) {
      const prev = members[members.length - 1];
      if (!stitches.has(seamKey(prev.id, characters[j].id))) break;
      members.push(characters[j]);
      j += 1;
    }
    groups.push({ members });
    i = j;
  }
  return groups;
}

function groupContaining(id) {
  return readingGroups().find((group) => group.members.some((member) => member.id === id));
}

function adjacentKanjiSeams() {
  const seams = [];
  for (let i = 0; i < characters.length - 1; i += 1) {
    const left = characters[i];
    const right = characters[i + 1];
    if (!isKanji(left.char) || !isKanji(right.char)) continue;
    seams.push({
      left,
      right,
      joined: stitches.has(seamKey(left.id, right.id)),
    });
  }
  return seams;
}

function stitchedMemberIds() {
  const ids = new Set();
  for (const group of readingGroups()) {
    if (group.members.length < 2) continue;
    for (const member of group.members) ids.add(member.id);
  }
  return ids;
}

function furiganaIds() {
  return readingGroups().map((group) => group.members[0].id);
}

function cssPx(style, name, fallback) {
  const parsed = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function graphemeCount(value) {
  return [...value].length;
}

function kanjiSlotPx() {
  const fromMin = Number.parseFloat(getComputedStyle(composerUnit).minWidth);
  if (Number.isFinite(fromMin) && fromMin > 0) return fromMin;
  return cssPx(getComputedStyle(writingLine), "--kanji-slot", 74);
}

function usedCharacterWidth() {
  return [...writingLine.children]
    .filter((child) => child !== composerUnit)
    .reduce((total, child) => total + child.getBoundingClientRect().width, 0);
}

function remainingComposerWidth() {
  const lineStyle = window.getComputedStyle(writingLine);
  const padding =
    Number.parseFloat(lineStyle.paddingLeft) + Number.parseFloat(lineStyle.paddingRight);
  const available = writingLine.clientWidth - padding;
  return Math.max(kanjiSlotPx(), available - usedCharacterWidth());
}

function composerShellChromeX() {
  const style = getComputedStyle(composerShell);
  return (
    (Number.parseFloat(style.borderLeftWidth) || 0) +
    (Number.parseFloat(style.borderRightWidth) || 0) +
    (Number.parseFloat(style.paddingLeft) || 0) +
    (Number.parseFloat(style.paddingRight) || 0)
  );
}

function remainingInputWidth() {
  return Math.max(0, remainingComposerWidth() - composerShellChromeX());
}

function syncComposerWidth() {
  const slot = kanjiSlotPx();
  const style = getComputedStyle(mainInput);
  const fontSize = Number.parseFloat(style.fontSize) || 64;
  const paddingX =
    (Number.parseFloat(style.paddingLeft) || 0) +
    (Number.parseFloat(style.paddingRight) || 0);
  const needed = mainInput.value
    ? graphemeCount(mainInput.value) * fontSize + paddingX
    : slot;
  const width = Math.min(remainingInputWidth(), Math.max(slot, needed));
  mainInput.style.width = `${width}px`;
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

  return {
    available: writingLine.clientWidth - padding,
    used: usedCharacterWidth() + kanjiSlot,
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

function rejectInsert(event, allowed, composing) {
  if (event.isComposing || composing) return;
  if (event.inputType !== "insertText" || event.data == null) return;
  if (![...event.data].every(allowed)) {
    event.preventDefault();
    syncComposerWidth();
  }
}

function bindFuriganaInput(input, headEntry, maxLength, spanning) {
  input.type = "text";
  input.className = spanning ? "furigana-input is-spanning" : "furigana-input";
  input.maxLength = maxLength;
  input.dataset.headId = String(headEntry.id);
  input.setAttribute(
    "aria-label",
    spanning ? input.getAttribute("aria-label") : `Furigana for ${headEntry.char}`
  );
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.inputMode = "text";
  input.value = headEntry.furigana;
  if (!spanning) {
    input.style.setProperty("--reading-width", `${readingWidth(headEntry.furigana)}px`);
  }

  let composing = false;

  function commitValue(value) {
    const limited = clampReading(value, maxLength);
    if (limited !== value) input.value = limited;
    headEntry.furigana = limited;
    if (!spanning) {
      input.style.setProperty("--reading-width", `${readingWidth(limited)}px`);
    }
  }

  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (!composing && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      handleFuriganaArrow(headEntry.id, event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  input.addEventListener("beforeinput", (event) => {
    rejectInsert(event, isKana, composing);
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    if (composing) return;
    const filtered = filterKana(event.clipboardData.getData("text"));
    if (!filtered) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const room = maxLength - (input.value.length - (end - start));
    const insert = [...filtered].slice(0, Math.max(0, room)).join("");
    if (!insert) return;
    input.setRangeText(insert, start, end, "end");
    commitValue(input.value);
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
    else if (!spanning) {
      input.style.setProperty(
        "--reading-width",
        `${readingWidth(event.currentTarget.value)}px`
      );
    }
  });

  furiganaInputs.set(headEntry.id, input);
}

function createSeamControl(seam) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `seam-control${seam.joined ? " is-unchain" : " is-open"}`;
  const leftGroup = groupContaining(seam.left.id);
  const rightGroup = groupContaining(seam.right.id);
  const leftWord = leftGroup
    ? leftGroup.members.map((member) => member.char).join("")
    : seam.left.char;
  const rightWord = rightGroup
    ? rightGroup.members.map((member) => member.char).join("")
    : seam.right.char;
  button.setAttribute(
    "aria-label",
    seam.joined
      ? `Unstitch ${seam.left.char} and ${seam.right.char}`
      : `Stitch readings for ${leftWord} and ${rightWord}`
  );

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (seam.joined) unchainSeam(seam.left.id, seam.right.id);
    else stitchSeam(seam.left.id, seam.right.id);
  });

  return button;
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
    bindFuriganaInput(input, entry, SOLO_READING_MAX, false);
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

function createStitchGroup(group) {
  const n = group.members.length;
  const head = group.members[0];
  const word = group.members.map((member) => member.char).join("");

  const el = document.createElement("div");
  el.className = "stitch-group";
  el.style.setProperty("--group-count", String(n));
  el.dataset.headId = String(head.id);
  el.dataset.memberIds = group.members.map((member) => member.id).join(",");

  const readingArea = document.createElement("div");
  readingArea.className = "reading-area stitched";

  for (let s = 0; s < n - 1; s += 1) {
    const left = group.members[s];
    const right = group.members[s + 1];
    const button = createSeamControl({ left, right, joined: true });
    button.style.left = `${((s + 1) / n) * 100}%`;
    readingArea.append(button);
  }

  const input = document.createElement("input");
  input.setAttribute("aria-label", `Furigana for ${word}`);
  bindFuriganaInput(input, head, readingMaxLength(n), true);
  readingArea.append(input);

  const chars = document.createElement("div");
  chars.className = "stitch-chars";
  for (const member of group.members) {
    const display = document.createElement("span");
    display.className = "char-display kanji-display";
    display.textContent = member.char;
    chars.append(display);
  }

  el.append(readingArea, chars);
  return el;
}

function nodeForCharId(id) {
  const unit = writingLine.querySelector(`.character-unit[data-id="${id}"]`);
  if (unit) return unit;
  for (const group of writingLine.querySelectorAll(".stitch-group")) {
    if (group.dataset.memberIds.split(",").includes(String(id))) return group;
  }
  return null;
}

function attachOpenSeamControls() {
  for (const seam of adjacentKanjiSeams()) {
    if (seam.joined) continue;
    const rightNode = nodeForCharId(seam.right.id);
    if (!rightNode) continue;
    rightNode.append(createSeamControl(seam));
  }
}

function createMirrorColumn(entry, inStitch) {
  const canHaveReading = isKanji(entry.char);
  const unit = document.createElement("div");
  unit.className = `mirror-unit${canHaveReading ? " has-reading" : " kana-unit"}`;
  if (inStitch) unit.classList.add("in-stitch");
  unit.dataset.id = String(entry.id);

  const display = document.createElement("span");
  display.className = `mirror-char ${canHaveReading ? "kanji-display" : "kana-display"}`;
  display.textContent = entry.char;

  unit.append(display);
  return unit;
}

function syncMirrorLine() {
  const grouped = stitchedMemberIds();
  mirrorLine.replaceChildren(
    ...characters.map((entry) => createMirrorColumn(entry, grouped.has(entry.id)))
  );
}

function captureFuriganaFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !active.classList.contains("furigana-input")) {
    return null;
  }
  return {
    headId: Number(active.dataset.headId),
    start: active.selectionStart,
    end: active.selectionEnd,
  };
}

function restoreFuriganaFocus(state) {
  const headId = pendingFuriganaFocus ?? state?.headId;
  pendingFuriganaFocus = null;
  if (headId == null || Number.isNaN(headId)) return;
  const input = furiganaInputs.get(headId);
  if (!input) return;
  input.focus();
  const end = input.value.length;
  const start = state?.headId === headId ? state.start ?? end : end;
  const stop = state?.headId === headId ? state.end ?? end : end;
  input.setSelectionRange(start, stop);
}

function assignGroupReading(group, value) {
  const limited = clampReading(value, readingMaxLength(group.members.length));
  group.members[0].furigana = limited;
  for (let i = 1; i < group.members.length; i += 1) {
    group.members[i].furigana = "";
  }
}

function stitchSeam(leftId, rightId) {
  const leftGroup = groupContaining(leftId);
  const rightGroup = groupContaining(rightId);
  if (!leftGroup || !rightGroup) return;
  const merged = `${leftGroup.members[0].furigana}${rightGroup.members[0].furigana}`;
  stitches.add(seamKey(leftId, rightId));
  const joined = groupContaining(leftId);
  assignGroupReading(joined, merged);
  pendingFuriganaFocus = joined.members[0].id;
  syncWritingLine();
}

function unchainSeam(leftId, rightId) {
  const group = groupContaining(leftId);
  if (!group) return;
  const reading = group.members[0].furigana;
  stitches.delete(seamKey(leftId, rightId));
  const leftGroup = groupContaining(leftId);
  const rightGroup = groupContaining(rightId);
  if (leftGroup) assignGroupReading(leftGroup, reading);
  if (rightGroup) assignGroupReading(rightGroup, "");
  pendingFuriganaFocus = leftGroup?.members[0].id ?? null;
  syncWritingLine();
}

function syncWritingLine() {
  pruneStitches();
  const focusState = captureFuriganaFocus();

  for (const node of [...writingLine.children]) {
    if (node !== composerUnit) node.remove();
  }
  furiganaInputs.clear();

  const consumed = new Set();
  const groupByHead = new Map(
    readingGroups().map((group) => [group.members[0].id, group])
  );

  for (const entry of characters) {
    if (consumed.has(entry.id)) continue;
    if (!isKanji(entry.char)) {
      writingLine.insertBefore(createCharColumn(entry), composerUnit);
      continue;
    }
    const group = groupByHead.get(entry.id);
    if (group && group.members.length > 1) {
      for (const member of group.members) consumed.add(member.id);
      writingLine.insertBefore(createStitchGroup(group), composerUnit);
      continue;
    }
    writingLine.insertBefore(createCharColumn(entry), composerUnit);
  }

  attachOpenSeamControls();
  writingLine.classList.toggle("has-stitches", stitches.size > 0);

  syncMirrorLine();
  recalculateFull();
  restoreFuriganaFocus(focusState);
  queueMicrotask(syncComposerWidth);
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
  const removed = characters.pop();
  for (const key of [...stitches]) {
    const [left, right] = key.split(":").map(Number);
    if (left === removed.id || right === removed.id) stitches.delete(key);
  }
  syncWritingLine();
  syncComposerWidth();
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
  const chars = [...value].filter(isAllowed);
  mainInput.value = "";
  if (chars.length === 0) {
    queueMicrotask(syncComposerWidth);
    return false;
  }
  addCharacters(chars);
  queueMicrotask(syncComposerWidth);
  return true;
}

function focusMainInput() {
  mainInput.focus();
}

writingLine.addEventListener("click", focusMainInput);
mirrorLine.addEventListener("click", focusMainInput);

mainInput.addEventListener("click", (event) => event.stopPropagation());

mainInput.addEventListener("beforeinput", (event) => {
  rejectInsert(event, isAllowed, composingMain);
});

mainInput.addEventListener("compositionstart", () => {
  if (!isFull) composingMain = true;
});

mainInput.addEventListener("compositionupdate", () => {
  syncComposerWidth();
});

mainInput.addEventListener("compositionend", (event) => {
  composingMain = false;
  if (isFull) {
    mainInput.value = "";
    syncComposerWidth();
    return;
  }
  const value = event.currentTarget.value;
  const committed = commitMainInput(value);
  lastCompositionCommit = committed ? value : null;
});

mainInput.addEventListener("input", (event) => {
  if (isFull) {
    mainInput.value = "";
    syncComposerWidth();
    return;
  }

  const value = event.currentTarget.value;
  if (lastCompositionCommit === value) {
    lastCompositionCommit = null;
    syncComposerWidth();
    return;
  }
  lastCompositionCommit = null;

  if (!composingMain && [...value].some(isAllowed)) {
    commitMainInput(value);
    return;
  }

  syncComposerWidth();
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
  const pasted = filterAllowed(event.clipboardData.getData("text"));
  if (!pasted) return;
  addCharacters([...pasted]);
  mainInput.value = "";
  queueMicrotask(syncComposerWidth);
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    recalculateFull();
    syncComposerWidth();
  }).observe(writingLine);
}

if (document.fonts?.ready) {
  document.fonts.ready.then(() => syncComposerWidth());
}

recalculateFull();
syncComposerWidth();
mainInput.focus();
