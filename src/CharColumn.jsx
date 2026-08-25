import { useEffect, useMemo, useRef, useState } from "react";
import { filterKana, isKanji } from "./japanese.js";

const MIN_READING_WIDTH = 54;
const MAX_READING_WIDTH = 82;

function readingWidth(value) {
  const length = [...value].length;
  if (length === 0) return MIN_READING_WIDTH;
  return Math.min(MAX_READING_WIDTH, Math.max(MIN_READING_WIDTH, 18 + length * 13));
}

export default function CharColumn({
  id,
  char,
  furigana,
  onFuriganaChange,
  onRegisterFurigana,
  onFuriganaArrow,
}) {
  const [localValue, setLocalValue] = useState(furigana);
  const isComposingRef = useRef(false);
  const canHaveReading = isKanji(char);

  useEffect(() => {
    if (!isComposingRef.current) setLocalValue(furigana);
  }, [furigana]);

  const width = useMemo(() => readingWidth(localValue), [localValue]);

  function commitValue(value) {
    const filtered = filterKana(value);
    setLocalValue(filtered);
    onFuriganaChange(filtered);
  }

  return (
    <div
      className={`character-unit${canHaveReading ? " has-reading" : " kana-unit"}`}
      style={canHaveReading ? { "--reading-width": `${width}px` } : undefined}
    >
      <div className="reading-area">
        {canHaveReading ? (
          <input
            ref={(node) => onRegisterFurigana(id, node)}
            type="text"
            className="furigana-input"
            value={localValue}
            maxLength={5}
            aria-label={`Furigana for ${char}`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (
                !isComposingRef.current &&
                (event.key === "ArrowLeft" || event.key === "ArrowRight")
              ) {
                event.preventDefault();
                onFuriganaArrow(id, event.key === "ArrowLeft" ? -1 : 1);
              }
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false;
              commitValue(event.currentTarget.value);
            }}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setLocalValue(value);
              if (!isComposingRef.current) commitValue(value);
            }}
          />
        ) : (
          <span className="reading-placeholder" aria-hidden="true" />
        )}
      </div>
      <span className={`char-display ${canHaveReading ? "kanji-display" : "kana-display"}`}>
        {char}
      </span>
    </div>
  );
}
