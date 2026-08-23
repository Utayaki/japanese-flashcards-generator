import { forwardRef, useImperativeHandle, useRef } from "react";
import { filterJapanese, isJapaneseChar } from "./japanese.js";

const MainInput = forwardRef(function MainInput(
  { onAddCharacters, onRemoveLast },
  ref
) {
  const inputRef = useRef(null);
  const isComposingRef = useRef(false);
  const skipNextChangeRef = useRef(false);

  useImperativeHandle(ref, () => inputRef.current);

  function commitInput(value) {
    const chars = [...value].filter(isJapaneseChar);
    if (chars.length === 0) return false;

    onAddCharacters(chars);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    return true;
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = filterJapanese(e.clipboardData.getData("text"));
    if (pasted.length === 0) return;

    onAddCharacters([...pasted]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="char-column main-input-column">
      <div className="furigana-spacer" aria-hidden="true" />
      <div className="main-input-slot">
        <input
          ref={inputRef}
          type="text"
          className="main-input"
          placeholder="入力"
          aria-label="Japanese text input"
          autoComplete="off"
          autoFocus
          spellCheck={false}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            const committed = commitInput(e.currentTarget.value);
            if (committed) {
              skipNextChangeRef.current = true;
            }
          }}
          onChange={(e) => {
            if (isComposingRef.current) return;
            if (skipNextChangeRef.current) {
              skipNextChangeRef.current = false;
              return;
            }
            commitInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Backspace" &&
              inputRef.current?.value === "" &&
              !isComposingRef.current
            ) {
              e.preventDefault();
              onRemoveLast();
            }
          }}
          onPaste={handlePaste}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
});

export default MainInput;
