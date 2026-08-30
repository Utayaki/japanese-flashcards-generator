const HALFWIDTH_RE = /[\uFF00-\uFFEF]/u;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const KANJI_RE = /[\p{Unified_Ideograph}々〇〻〆]/u;
const ALLOWED_RE =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Unified_Ideograph}ー々〇〻〆]/u;

function isHalfwidth(ch) {
  return HALFWIDTH_RE.test(ch);
}

export function isKana(ch) {
  return KANA_RE.test(ch) && !isHalfwidth(ch);
}

export function isKanji(ch) {
  return KANJI_RE.test(ch) && !isHalfwidth(ch);
}

export function isAllowed(ch) {
  return ALLOWED_RE.test(ch) && !isHalfwidth(ch);
}

export function filterAllowed(text) {
  return [...text].filter(isAllowed).join("");
}

export function filterKana(text) {
  return [...text].filter(isKana).join("");
}

export function foldKana(text) {
  let out = "";
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0);
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function foldSearch(text) {
  return foldKana(text).toLocaleLowerCase();
}
