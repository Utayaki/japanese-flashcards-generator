import { useEffect, useMemo, useRef, useState } from "react";
import { filterJapanese, isKanji } from "./japanese.js";

const MIN_READING_WIDTH = 42;
function readingWidth(value) {
  const length = [...value].length;
  if (length === 0) return MIN_READING_WIDTH;
  return Math.max(MIN_READING_WIDTH, 18 + length * 12);
}

export default function CharColumn({ char, furigana, onFuriganaChange }) {
  const [localValue, setLocalValue] = useState(furigana);
  const isComposingRef = useRef(false);
  const canHaveReading = isKanji(char);

  useEffect(() => {
    if (!isComposingRef.current) setLocalValue(furigana);
  }, [furigana]);

  const width = useMemo(() => readingWidth(localValue), [localValue]);

  function commitValue(value) {
    const filtered = filterJapanese(value);
    setLocalValue(filtered);
    onFuriganaChange(filtered);
  }

  return (
    <div
      className={`character-unit${canHaveReading ? " has-reading" : " kana-unit"}`}
      style={{ "--reading-width": `${width}px` }}
    >
      <div className="reading-area">
        {canHaveReading ? (
          <input
            type="text"
            className="furigana-input"
            value={localValue}
            aria-label={`Furigana for ${char}`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            onClick={(event) => event.stopPropagation()}
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
      <span className="char-display">{char}</span>
    </div>
  );
}
