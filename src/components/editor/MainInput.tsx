"use client";

import {
  forwardRef,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { filterJapanese, isJapaneseChar } from "@/lib/japanese";

type MainInputProps = {
  onAddCharacters: (chars: string[]) => void;
  onRemoveLast: () => void;
  onMoveToLastFurigana: () => void;
  disabled: boolean;
};

const MainInput = forwardRef<HTMLInputElement, MainInputProps>(function MainInput(
  { onAddCharacters, onRemoveLast, onMoveToLastFurigana, disabled },
  ref
) {
  const isComposingRef = useRef(false);
  const lastCompositionCommitRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");

  function commitInput(value: string): boolean {
    const chars = [...value].filter(isJapaneseChar);
    if (chars.length === 0) {
      setDraft("");
      return false;
    }

    onAddCharacters(chars);
    setDraft("");
    return true;
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    if (disabled) return;

    const pasted = filterJapanese(event.clipboardData.getData("text"));
    if (!pasted) return;

    onAddCharacters([...pasted]);
    setDraft("");
  }

  const visibleLength = Math.max(1, [...draft].length);

  return (
    <div
      className={`character-unit composer-unit${disabled ? " is-full" : ""}`}
    >
      <div className="reading-area" aria-hidden="true" />
      <div className="composer-shell">
        <input
          ref={ref}
          type="text"
          className="main-input"
          value={draft}
          size={visibleLength}
          placeholder={disabled ? "満" : "入力"}
          aria-label="Japanese text input"
          aria-disabled={disabled}
          readOnly={disabled}
          autoComplete="off"
          autoCapitalize="off"
          autoFocus
          spellCheck={false}
          inputMode="text"
          onCompositionStart={() => {
            if (!disabled) isComposingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            if (disabled) {
              setDraft("");
              return;
            }
            const value = event.currentTarget.value;
            const committed = commitInput(value);
            lastCompositionCommitRef.current = committed ? value : null;
          }}
          onChange={(event) => {
            if (disabled) {
              setDraft("");
              return;
            }

            const value = event.currentTarget.value;
            if (lastCompositionCommitRef.current === value) {
              lastCompositionCommitRef.current = null;
              return;
            }
            lastCompositionCommitRef.current = null;
            setDraft(value);

            if (!isComposingRef.current && [...value].some(isJapaneseChar)) {
              commitInput(value);
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (
              event.key === "Backspace" &&
              draft === "" &&
              !isComposingRef.current
            ) {
              event.preventDefault();
              onRemoveLast();
            }

            if (
              event.key === "ArrowLeft" &&
              draft === "" &&
              !isComposingRef.current
            ) {
              event.preventDefault();
              onMoveToLastFurigana();
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
