import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { filterJapanese, isJapaneseChar } from "./japanese.js";

const MainInput = forwardRef(function MainInput(
  { onAddCharacters, onRemoveLast },
  ref
) {
  const inputRef = useRef(null);
  const isComposingRef = useRef(false);
  const lastCompositionCommitRef = useRef(null);
  const [draft, setDraft] = useState("");

  useImperativeHandle(ref, () => inputRef.current);

  function commitInput(value) {
    const chars = [...value].filter(isJapaneseChar);
    if (chars.length === 0) {
      setDraft("");
      return false;
    }

    onAddCharacters(chars);
    setDraft("");
    return true;
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = filterJapanese(event.clipboardData.getData("text"));
    if (!pasted) return;

    onAddCharacters([...pasted]);
    setDraft("");
  }

  const visibleLength = Math.max(1, [...draft].length);

  return (
    <div className="character-unit composer-unit">
      <div className="reading-area" aria-hidden="true" />
      <div className="composer-shell">
        <input
          ref={inputRef}
          type="text"
          className="main-input"
          value={draft}
          size={visibleLength}
          placeholder="入力"
          aria-label="Japanese text input"
          autoComplete="off"
          autoCapitalize="off"
          autoFocus
          spellCheck={false}
          inputMode="text"
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            const value = event.currentTarget.value;
            const committed = commitInput(value);
            lastCompositionCommitRef.current = committed ? value : null;
          }}
          onChange={(event) => {
            const value = event.currentTarget.value;

            // Some browsers emit one final change after compositionend. Ignore only
            // that exact duplicate, never the user's next real input.
            if (lastCompositionCommitRef.current === value) {
              lastCompositionCommitRef.current = null;
              return;
            }
            lastCompositionCommitRef.current = null;
            setDraft(value);

            // Direct Japanese keyboard input does not always produce a composition event.
            if (!isComposingRef.current && [...value].some(isJapaneseChar)) {
              commitInput(value);
            }
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Backspace" &&
              draft === "" &&
              !isComposingRef.current
            ) {
              event.preventDefault();
              onRemoveLast();
            }
          }}
          onPaste={handlePaste}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
});

export default MainInput;
