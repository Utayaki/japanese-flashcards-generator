# UI / UX direction

This version is intentionally designed as a writing surface rather than a conventional dashboard or card-based web app.

## Product principles

1. **The Japanese text is the interface.** The writing line gets the visual priority; navigation and controls stay secondary.
2. **Kanji > kana > furigana.** Kanji is the dominant typographic layer. Kana is exactly 70% of the kanji font size. Furigana is the smallest layer.
3. **Furigana is always explicit.** Every kanji receives an empty reading input, but the app never guesses or inserts a reading automatically.
4. **Visible affordances.** Furigana fields remain visibly editable even when empty. No important interaction is hidden behind hover-only UI.
5. **Strong contrast.** Primary text and the writing rule use near-black ink. Secondary text is still intentionally readable. Focus uses a restrained Japanese vermilion accent.
6. **No horizontal writing overflow.** The editor measures the available writing width and rejects additional characters before they can overflow. There is also a 12-character safety cap for very wide screens.
7. **Keyboard first.** Japanese IME composition is preserved. Left/right arrow keys move directly between furigana inputs; left from the empty main input jumps back to the last reading.
8. **Restrained motion.** Only 120ms state transitions are used. Reduced-motion settings disable even those.
9. **Minimal chrome.** There is no floating card, giant hero heading, hidden menu, analytics, export controls, or feature toolbar.
10. **Typography as personality.** The editor supports a normal Japanese sans face and a Mincho serif face. The serif option gives a more literary/calligraphic character without depending on a web-font download.

## Technical sizing rules

- Kanji: `--kanji-size`
- Kana: `calc(--kanji-size * 0.7)`
- Furigana: small but never tiny; approximately 0.88–1.05rem on desktop.
- Furigana inputs grow with their contents, remain inside a reserved reading slot, and accept up to 5 kana.
- Character units use fixed rhythmic slots so the baseline stays stable.
- The main IME composer uses `field-sizing: content` with a width fallback and remains separate from committed characters.

## Input model

- Main line accepts Japanese characters only.
- Furigana accepts kana only.
- Furigana values always start empty.
- `compositionstart` / `compositionend` are respected so romaji-to-Japanese IME conversion is not prematurely committed.
- The editor uses both physical line width and `MAX_CHARACTERS = 12` in `src/FuriganaEditor.jsx`; whichever limit is reached first wins.
