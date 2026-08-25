const JAPANESE_RE = /[\u3005\u3007\u303B\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;
const JAPANESE_GLOBAL_RE = /[\u3005\u3007\u303B\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;
const KANJI_RE = /[\u3005\u3007\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;
const KANA_GLOBAL_RE = /[\u3040-\u309F\u30A0-\u30FF]/gu;

export function isJapaneseChar(ch) {
  return JAPANESE_RE.test(ch);
}

export function isKanji(ch) {
  return KANJI_RE.test(ch);
}

export function filterJapanese(text) {
  return (text.match(JAPANESE_GLOBAL_RE) || []).join("");
}

export function filterKana(text) {
  return (text.match(KANA_GLOBAL_RE) || []).join("");
}
