import { useEffect, useRef, useState } from "react";
import { filterJapanese } from "./japanese.js";

export default function CharColumn({ char, furigana, onFuriganaChange }) {
  const [localValue, setLocalValue] = useState(furigana);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!isComposingRef.current) {
      setLocalValue(furigana);
    }
  }, [furigana]);

  function commitValue(value) {
    const filtered = filterJapanese(value);
    setLocalValue(filtered);
    onFuriganaChange(filtered);
  }

  return (
    <div className="char-column">
      <div className="furigana-slot">
        <input
          type="text"
          className="furigana-input"
          value={localValue}
          placeholder="ふりがな"
          aria-label={`Furigana for ${char}`}
          autoComplete="off"
          spellCheck={false}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            commitValue(e.currentTarget.value);
          }}
          onChange={(e) => {
            setLocalValue(e.target.value);
            if (!isComposingRef.current) {
              commitValue(e.target.value);
            }
          }}
        />
      </div>
      <span className="char-display">{char}</span>
    </div>
  );
}
