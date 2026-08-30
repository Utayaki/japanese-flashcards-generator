import { isKanji } from "./japanese.js";

function createFrozenUnit(char, kana, kanji) {
  const unit = document.createElement("div");
  unit.className = `character-unit${kanji ? " has-reading" : " kana-unit"}`;

  const readingArea = document.createElement("div");
  readingArea.className = "reading-area";
  if (kanji) {
    const reading = document.createElement("span");
    reading.className = "furigana-text";
    reading.textContent = kana;
    readingArea.append(reading);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "reading-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    readingArea.append(placeholder);
  }

  const display = document.createElement("span");
  display.className = `char-display ${kanji ? "kanji-display" : "kana-display"}`;
  display.textContent = char;
  unit.append(readingArea, display);
  return unit;
}

function createFrozenStitch(kanjiChars, kana) {
  const el = document.createElement("div");
  el.className = "stitch-group";
  el.style.setProperty("--group-count", String(kanjiChars.length));

  const readingArea = document.createElement("div");
  readingArea.className = "reading-area stitched";
  const reading = document.createElement("span");
  reading.className = "furigana-text is-spanning";
  reading.textContent = kana;
  readingArea.append(reading);

  const chars = document.createElement("div");
  chars.className = "stitch-chars";
  for (const char of kanjiChars) {
    const display = document.createElement("span");
    display.className = "char-display kanji-display";
    display.textContent = char;
    chars.append(display);
  }

  el.append(readingArea, chars);
  return el;
}

export function renderWritingLine(word) {
  const line = document.createElement("div");
  line.className = "writing-line is-frozen";
  line.setAttribute("aria-hidden", "false");

  const spelling = [...(word.spelling ?? "")];
  const mappings = Array.isArray(word.readingMappings) ? word.readingMappings : [];
  let i = 0;
  let mappingIndex = 0;
  let hasStitches = false;

  while (i < spelling.length) {
    const mapping = mappings[mappingIndex];
    if (mapping && typeof mapping.kanji === "string") {
      const kanjiChars = [...mapping.kanji];
      const slice = spelling.slice(i, i + kanjiChars.length).join("");
      if (slice === mapping.kanji && kanjiChars.length > 0) {
        const kana = typeof mapping.kana === "string" ? mapping.kana : "";
        if (kanjiChars.length > 1) {
          line.append(createFrozenStitch(kanjiChars, kana));
          hasStitches = true;
        } else {
          line.append(createFrozenUnit(kanjiChars[0], kana, true));
        }
        i += kanjiChars.length;
        mappingIndex += 1;
        continue;
      }
    }

    const char = spelling[i];
    line.append(createFrozenUnit(char, "", isKanji(char)));
    i += 1;
  }

  if (hasStitches) line.classList.add("has-stitches");
  return line;
}
