"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { filterKana, isKanji } from "@/lib/japanese";

const MIN_READING_WIDTH = 54;
const MAX_READING_WIDTH = 82;

function readingWidth(value: string): number {
  const length = [...value].length;
  if (length === 0) return MIN_READING_WIDTH;
  return Math.min(MAX_READING_WIDTH, Math.max(MIN_READING_WIDTH, 18 + length * 13));
}

type CharColumnProps = {
  id: number;
  char: string;
  furigana: string;
  onFuriganaChange: (furigana: string) => void;
  onRegisterFurigana: (id: number, node: HTMLInputElement | null) => void;
  onFuriganaArrow: (id: number, direction: -1 | 1) => void;
};

export default function CharColumn({
  id,
  char,
  furigana,
  onFuriganaChange,
  onRegisterFurigana,
  onFuriganaArrow,
}: CharColumnProps) {
  const [localValue, setLocalValue] = useState(furigana);
  const isComposingRef = useRef(false);
  const canHaveReading = isKanji(char);

  useEffect(() => {
    if (!isComposingRef.current) setLocalValue(furigana);
  }, [furigana]);

  const width = useMemo(() => readingWidth(localValue), [localValue]);

  function commitValue(value: string) {
    const filtered = filterKana(value);
    setLocalValue(filtered);
    onFuriganaChange(filtered);
  }

  return (
    <div
      className={`character-unit${canHaveReading ? " has-reading" : " kana-unit"}`}
      style={
        canHaveReading
          ? ({ "--reading-width": `${width}px` } as CSSProperties)
          : undefined
      }
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
      <span
        className={`char-display ${canHaveReading ? "kanji-display" : "kana-display"}`}
      >
        {char}
      </span>
    </div>
  );
}
