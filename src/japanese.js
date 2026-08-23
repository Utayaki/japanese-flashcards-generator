const JAPANESE_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/;
const JAPANESE_GLOBAL_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/g;

export function isJapaneseChar(ch) {
  return JAPANESE_RE.test(ch);
}

export function filterJapanese(text) {
  return (text.match(JAPANESE_GLOBAL_RE) || []).join("");
}
