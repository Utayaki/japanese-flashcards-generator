import { foldKana, foldSearch } from "/shared/japanese.js";

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function highlightMatch(text, query) {
  const raw = String(text || "");
  const needle = String(query || "").trim();
  if (!needle) return esc(raw);
  const foldedText = foldSearch(raw);
  const foldedNeedle = foldSearch(needle);
  const index = foldedText.indexOf(foldedNeedle);
  if (index < 0) return esc(raw);
  const chars = [...raw];
  const length = [...foldKana(needle)].length;
  const before = chars.slice(0, index).join("");
  const mid = chars.slice(index, index + length).join("");
  const after = chars.slice(index + length).join("");
  return `${esc(before)}<b>${esc(mid)}</b>${esc(after)}`;
}

export function highlightFurigana(line, query) {
  const needle = String(query || "").trim();
  if (!needle || !line) return;
  for (const el of line.querySelectorAll(".furigana-text, .full-reading")) {
    const raw = el.textContent || "";
    if (!raw) continue;
    const foldedText = foldSearch(raw);
    const foldedNeedle = foldSearch(needle);
    const index = foldedText.indexOf(foldedNeedle);
    if (index < 0) continue;
    const chars = [...raw];
    const length = [...foldKana(needle)].length;
    const before = chars.slice(0, index).join("");
    const mid = chars.slice(index, index + length).join("");
    const after = chars.slice(index + length).join("");
    el.innerHTML = `${esc(before)}<b>${esc(mid)}</b>${esc(after)}`;
  }
}
