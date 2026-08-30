import { createWritingEditor } from "/typing/editor.js";
import { api } from "./api.js";
import { app, state } from "./state.js";
import { esc } from "./utils.js";

let goHome = null;

export function configureEditor(goHomeCallback) {
  goHome = goHomeCallback;
}

export function startEditor(word, isNew) {
  destroyReadingsEditor();
  state.spellingEditor?.destroy();
  state.spellingEditor = null;

  const editor = {
    word,
    isNew,
    dirty: false,
    writing: null,
    error: "",
  };
  state.editor = editor;
  renderEditor();
}

function destroyReadingsEditor() {
  state.readingsEditor?.destroy();
  state.readingsEditor = null;
}

function renderEditor() {
  const editor = state.editor;
  if (!editor) return;
  const typeMeta = state.meta.lexical_item_types[editor.word.lexicalItemType || state.selectedType];
  const title = typeMeta?.button || "Word";
  app.innerHTML = `
    <section class="home-panel editor-panel">
      <div class="header-row">
        <h1>${esc(title)}${editor.dirty ? " *" : ""}</h1>
        <button id="back-button" type="button" class="ghost">Go back</button>
      </div>
      <div id="editor-message">${editor.error ? `<div class="error-box">${esc(editor.error)}</div>` : ""}</div>
      <div id="readings-mount"></div>
      <input
        type="text"
        class="explanation-input"
        id="explanation-input"
        placeholder="explanation"
        aria-label="Explanation"
        autocomplete="off"
        spellcheck="true"
        value="${esc(editor.word.explanation || "")}"
      />
      <div class="status-row">
        <span id="dirty-status" class="${editor.dirty ? "unsaved" : "muted"}">${
          editor.dirty ? "Unsaved changes" : editor.isNew ? "New lexical item" : "Saved"
        }</span>
        <div class="action-row">
          <button type="button" id="save-button" class="accept-button" disabled>Save &amp; go back</button>
        </div>
      </div>
    </section>`;

  document.getElementById("back-button").addEventListener("click", leaveEditor);

  const explanationInput = document.getElementById("explanation-input");
  explanationInput.addEventListener("input", () => {
    markDirty();
    updateSaveState();
  });

  const mount = document.getElementById("readings-mount");
  state.readingsEditor = createWritingEditor(mount, {
    mode: "readings",
    word: editor.word,
    onChange() {
      markDirty();
      updateSaveState();
    },
  });
  editor.writing = state.readingsEditor;
  document.getElementById("save-button").addEventListener("click", saveEditor);
  updateSaveState();
}

function markDirty() {
  if (!state.editor) return;
  state.editor.dirty = true;
  const title = document.querySelector(".editor-panel h1");
  const typeMeta = state.meta.lexical_item_types[state.editor.word.lexicalItemType || state.selectedType];
  if (title && !title.textContent.endsWith(" *")) {
    title.textContent = `${typeMeta?.button || "Word"} *`;
  }
  const dirty = document.getElementById("dirty-status");
  if (dirty) {
    dirty.className = "unsaved";
    dirty.textContent = "Unsaved changes";
  }
}

function canSave() {
  const editor = state.editor;
  if (!editor?.writing) return false;
  const explanation = document.getElementById("explanation-input")?.value.trim() || "";
  return explanation.length > 0 && editor.writing.readingsComplete();
}

function updateSaveState() {
  const button = document.getElementById("save-button");
  if (!button) return;
  button.disabled = !canSave();
}

async function saveEditor() {
  if (!canSave()) return;
  const editor = state.editor;
  const explanation = document.getElementById("explanation-input").value.trim();
  const payload = {
    spelling: editor.writing.getSpelling(),
    explanation,
    readingMappings: editor.writing.getReadingMappings(),
    lexicalItemType: editor.word.lexicalItemType || state.selectedType,
  };
  try {
    editor.error = "";
    const path = editor.isNew ? "/api/words" : `/api/words/${editor.word.id}`;
    const method = editor.isNew ? "POST" : "PUT";
    const data = await api(path, { method, body: JSON.stringify(payload) });
    state.selectedType = data.word.lexicalItemType;
    state.query = "";
    state.results = [];
    state.searching = false;
    clearTimeout(state.searchTimer);
    destroyReadingsEditor();
    state.editor = null;
    goHome();
  } catch (error) {
    editor.error = error.message;
    const message = document.getElementById("editor-message");
    if (message) message.innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
    updateSaveState();
  }
}

function leaveEditor() {
  if (state.editor?.dirty && !confirm("Go back without saving these changes?")) return;
  destroyReadingsEditor();
  state.editor = null;
  goHome();
}
