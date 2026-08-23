import { useRef, useState } from "react";
import CharColumn from "./CharColumn.jsx";
import MainInput from "./MainInput.jsx";

let nextId = 0;

export default function FuriganaEditor() {
  const [characters, setCharacters] = useState([]);
  const mainInputRef = useRef(null);

  function addCharacters(chars) {
    setCharacters((prev) => [
      ...prev,
      ...chars.map((char) => ({ id: nextId++, char, furigana: "" })),
    ]);
  }

  function updateFurigana(id, furigana) {
    setCharacters((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, furigana } : entry))
    );
  }

  function removeLast() {
    setCharacters((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }

  function focusMainInput() {
    mainInputRef.current?.focus();
  }

  return (
    <div className="editor-inner">
      <div className="characters-row" onClick={focusMainInput}>
        {characters.map((entry) => (
          <CharColumn
            key={entry.id}
            char={entry.char}
            furigana={entry.furigana}
            onFuriganaChange={(furigana) => updateFurigana(entry.id, furigana)}
          />
        ))}
        <MainInput
          ref={mainInputRef}
          onAddCharacters={addCharacters}
          onRemoveLast={removeLast}
        />
      </div>
    </div>
  );
}
