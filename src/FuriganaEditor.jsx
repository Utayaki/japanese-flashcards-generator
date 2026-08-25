import { useRef, useState } from "react";
import CharColumn from "./CharColumn.jsx";
import MainInput from "./MainInput.jsx";

let nextId = 0;

export default function FuriganaEditor() {
  const [characters, setCharacters] = useState([]);
  const mainInputRef = useRef(null);

  function addCharacters(chars) {
    setCharacters((previous) => [
      ...previous,
      ...chars.map((char) => ({ id: nextId++, char, furigana: "" })),
    ]);
  }

  function updateFurigana(id, furigana) {
    setCharacters((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, furigana } : entry
      )
    );
  }

  function removeLast() {
    setCharacters((previous) =>
      previous.length > 0 ? previous.slice(0, -1) : previous
    );
  }

  function clearAll() {
    setCharacters([]);
    requestAnimationFrame(() => mainInputRef.current?.focus());
  }

  function focusMainInput() {
    mainInputRef.current?.focus();
  }

  return (
    <main className="page-shell">
      <section className="editor-card" aria-labelledby="editor-title">
        <header className="editor-header">
          <div>
            <p className="eyebrow">Japanese writing</p>
            <h1 id="editor-title">Kanji + furigana</h1>
          </div>
          {characters.length > 0 && (
            <button className="clear-button" type="button" onClick={clearAll}>
              Clear
            </button>
          )}
        </header>

        <p className="editor-help">
          Type Japanese on the line. Add a reading directly above each kanji.
        </p>

        <div className="writing-viewport" role="group" aria-label="Japanese writing line">
          <div className="writing-line" onClick={focusMainInput}>
            {characters.map((entry) => (
              <CharColumn
                key={entry.id}
                char={entry.char}
                furigana={entry.furigana}
                onFuriganaChange={(furigana) =>
                  updateFurigana(entry.id, furigana)
                }
              />
            ))}

            <MainInput
              ref={mainInputRef}
              onAddCharacters={addCharacters}
              onRemoveLast={removeLast}
            />
          </div>
        </div>

        <div className="keyboard-hint" aria-hidden="true">
          <span>Backspace removes the last character</span>
          <span className="keyboard-dot">•</span>
          <span>Tab moves through readings</span>
        </div>
      </section>
    </main>
  );
}
