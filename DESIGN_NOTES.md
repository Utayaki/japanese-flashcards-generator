# Kanji + Furigana editor — design notes

## Product direction

Keep the first version deliberately narrow: one writing line, one furigana field per kanji, and predictable keyboard behavior. The editor should feel more like writing on paper than filling a form.

## UI / UX principles

1. **Kanji is the visual anchor.** Every character keeps a consistent baseline and rhythm. Furigana is secondary: smaller, quieter, and directly above the kanji it annotates.
2. **Content determines width.** A reading field starts compact but grows when its text grows. The live IME input does the same. Text is never intentionally hidden inside a one-character box.
3. **No arbitrary whitespace.** Kana uses the same baseline rhythm but does not reserve a visible furigana input. Extra horizontal space appears only when a real reading needs it.
4. **Overflow is local.** Long writing lines scroll horizontally inside the writing viewport. The document itself is not globally clipped with `overflow: hidden`.
5. **IME is a first-class input path.** Composition text remains intact until `compositionend`; only committed Japanese characters become editor units.
6. **Progressive disclosure.** Reading controls are visually light by default and become clearer on hover/focus. The interface avoids toolbars until they are actually useful.
7. **Keyboard first.** The main input keeps focus while writing; Backspace removes the previous character when the composer is empty; native Tab order moves through furigana fields.
8. **Accessible focus states.** Inputs have programmatic labels, visible keyboard focus, and motion respects `prefers-reduced-motion`.

## Technical guidelines

- Use a fixed baseline width for normal character rhythm (`--unit-width`), but allow a kanji unit to become wider when its furigana requires it.
- Calculate furigana width from the actual character count. Do not solve clipping with a globally oversized column.
- Use `field-sizing: content` as progressive enhancement for the live composer, plus the HTML `size` attribute as a fallback.
- Use `100dvh` with a `100vh` fallback rather than locking the root with a fixed height and `overflow: hidden`.
- Put `overflow-x: auto` on `.writing-viewport`, never on the entire page.
- Keep inputs `min-width: 0` where they live inside constrained layouts, and set explicit line-height/padding so glyphs are not vertically clipped.
- Keep Japanese font stacks on Japanese text even if the surrounding UI uses a Latin system font.
- Separate Japanese-character detection from kanji detection so kana can render without unnecessary reading fields.
- Do not process intermediate IME values as committed text. Use composition events and guard against duplicate post-composition change events.

## What changed from the original

- Removed the single fixed `--col-width` constraint that was shared by kanji, furigana, and the IME composer.
- Removed global `overflow: hidden` behavior.
- Added content-aware furigana sizing.
- Added a content-sized IME composer so the conversion string stays visible.
- Furigana inputs appear only for kanji; kana remains visually clean.
- Added a local horizontal writing viewport for genuinely long lines.
- Tightened spacing and responsive behavior.
- Added subtle focus/hover states, reduced-motion support, a clear action, and keyboard hints.
