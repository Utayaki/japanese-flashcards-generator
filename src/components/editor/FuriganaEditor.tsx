"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import CharColumn from "@/components/editor/CharColumn";
import MainInput from "@/components/editor/MainInput";
import { isKanji } from "@/lib/japanese";

const MAX_CHARACTERS = 12;
let nextId = 0;

type CharacterEntry = {
  id: number;
  char: string;
  furigana: string;
};

type FontMode = "standard" | "mincho";

type LineMetrics = {
  available: number;
  used: number;
  kanjiWidth: number;
  kanaWidth: number;
};

export default function FuriganaEditor() {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [fontMode, setFontMode] = useState<FontMode>("standard");
  const [limitNotice, setLimitNotice] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const mainInputRef = useRef<HTMLInputElement | null>(null);
  const writingLineRef = useRef<HTMLDivElement | null>(null);
  const furiganaRefs = useRef(new Map<number, HTMLInputElement>());
  const limitTimerRef = useRef<number | null>(null);

  const furiganaIds = useMemo(
    () => characters.filter((entry) => isKanji(entry.char)).map((entry) => entry.id),
    [characters]
  );

  function getLineMetrics(): LineMetrics | null {
    const line = writingLineRef.current;
    if (!line) return null;

    const composer = line.querySelector(".composer-unit");
    if (!composer) return null;

    const lineStyle = window.getComputedStyle(line);
    const composerWidth = composer.getBoundingClientRect().width;
    const readingReserve =
      Number.parseFloat(lineStyle.getPropertyValue("--reading-max")) ||
      composerWidth;
    const padding =
      Number.parseFloat(lineStyle.paddingLeft) +
      Number.parseFloat(lineStyle.paddingRight);

    const usedCharacterWidth = [...line.children]
      .filter(
        (child) =>
          child.classList.contains("character-unit") &&
          !child.classList.contains("composer-unit")
      )
      .reduce(
        (total, child) => total + child.getBoundingClientRect().width,
        0
      );

    return {
      available: line.clientWidth - padding,
      used: usedCharacterWidth + composerWidth,
      kanjiWidth: Math.max(composerWidth, readingReserve),
      kanaWidth: composerWidth * 0.72,
    };
  }

  function recalculateFull() {
    if (characters.length >= MAX_CHARACTERS) {
      setIsFull(true);
      return;
    }

    const metrics = getLineMetrics();
    if (!metrics) {
      setIsFull(false);
      return;
    }

    setIsFull(metrics.used + metrics.kanjiWidth > metrics.available + 0.5);
  }

  useLayoutEffect(() => {
    // Sync line-full state from DOM width after characters/font layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- layout measurement
    recalculateFull();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculateFull closes over latest characters
  }, [characters, fontMode]);

  useLayoutEffect(() => {
    const line = writingLineRef.current;
    if (!line || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(() => {
      recalculateFull();
    });
    observer.observe(line);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculateFull closes over latest characters
  }, [characters]);

  function showLimitNotice() {
    setLimitNotice(true);
    if (limitTimerRef.current !== null) {
      window.clearTimeout(limitTimerRef.current);
    }
    limitTimerRef.current = window.setTimeout(() => setLimitNotice(false), 1700);
  }

  function addCharacters(chars: string[]) {
    const metrics = getLineMetrics();
    let remainingWidth = metrics
      ? metrics.available - metrics.used
      : Number.POSITIVE_INFINITY;
    let remainingCount = MAX_CHARACTERS - characters.length;
    const accepted: string[] = [];

    for (const char of chars) {
      if (remainingCount <= 0) break;

      const predictedWidth = metrics
        ? isKanji(char)
          ? metrics.kanjiWidth
          : metrics.kanaWidth
        : 0;

      if (metrics && predictedWidth > remainingWidth + 0.5) break;

      accepted.push(char);
      remainingWidth -= predictedWidth;
      remainingCount -= 1;
    }

    if (accepted.length < chars.length) showLimitNotice();
    if (accepted.length === 0) return;

    setCharacters((previous) => [
      ...previous,
      ...accepted.map((char) => ({ id: nextId++, char, furigana: "" })),
    ]);
  }

  function updateFurigana(id: number, furigana: string) {
    setCharacters((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, furigana } : entry
      )
    );
  }

  function removeLast() {
    setLimitNotice(false);
    setCharacters((previous) =>
      previous.length > 0 ? previous.slice(0, -1) : previous
    );
  }

  function clearAll() {
    setCharacters([]);
    setLimitNotice(false);
    requestAnimationFrame(() => mainInputRef.current?.focus());
  }

  function focusMainInput() {
    mainInputRef.current?.focus();
  }

  function registerFurigana(id: number, node: HTMLInputElement | null) {
    if (node) furiganaRefs.current.set(id, node);
    else furiganaRefs.current.delete(id);
  }

  function focusFuriganaAt(index: number) {
    if (index < 0 || index >= furiganaIds.length) return;
    const input = furiganaRefs.current.get(furiganaIds[index]);
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  function handleFuriganaArrow(id: number, direction: -1 | 1) {
    const index = furiganaIds.indexOf(id);
    if (index === -1) return;

    const nextIndex = index + direction;
    if (nextIndex >= furiganaIds.length) {
      mainInputRef.current?.focus();
      return;
    }
    focusFuriganaAt(nextIndex);
  }

  function moveToLastFurigana() {
    focusFuriganaAt(furiganaIds.length - 1);
  }

  return (
    <main className={`page-shell font-${fontMode}`}>
      <header className="topbar">
        <div className="identity">
          <span className="identity-jp">振り仮名</span>
          <span className="identity-en">Japanese writing</span>
        </div>

        <div className="topbar-actions" aria-label="Editor controls">
          <div className="font-switch" aria-label="Japanese typeface">
            <button
              type="button"
              className={fontMode === "standard" ? "is-active" : ""}
              aria-pressed={fontMode === "standard"}
              onClick={() => setFontMode("standard")}
            >
              Standard
            </button>
            <button
              type="button"
              className={fontMode === "mincho" ? "is-active" : ""}
              aria-pressed={fontMode === "mincho"}
              onClick={() => setFontMode("mincho")}
            >
              Mincho
            </button>
          </div>

          {characters.length > 0 && (
            <button className="clear-button" type="button" onClick={clearAll}>
              Clear
            </button>
          )}
        </div>
      </header>

      <section className="writing-workspace" aria-label="Japanese writing editor">
        <div className="instruction-row">
          <p>Type Japanese. Add kana readings above each kanji.</p>
          <p className="arrow-hint">
            <kbd>←</kbd>
            <kbd>→</kbd> move between readings
          </p>
        </div>

        <div className="writing-stage">
          <div
            ref={writingLineRef}
            className="writing-line"
            onClick={focusMainInput}
          >
            {characters.map((entry) => (
              <CharColumn
                key={entry.id}
                id={entry.id}
                char={entry.char}
                furigana={entry.furigana}
                onFuriganaChange={(furigana) =>
                  updateFurigana(entry.id, furigana)
                }
                onRegisterFurigana={registerFurigana}
                onFuriganaArrow={handleFuriganaArrow}
              />
            ))}

            <MainInput
              ref={mainInputRef}
              onAddCharacters={addCharacters}
              onRemoveLast={removeLast}
              onMoveToLastFurigana={moveToLastFurigana}
              disabled={isFull}
            />
          </div>
        </div>

        <div className="status-row" aria-live="polite">
          {limitNotice || isFull ? (
            <span className="limit-message">Line full · Backspace to continue</span>
          ) : (
            <span className="status-spacer" aria-hidden="true" />
          )}
        </div>
      </section>
    </main>
  );
}
