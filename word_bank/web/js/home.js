import { createWritingEditor } from "/typing/editor.js";
import { api } from "./api.js";
import { app, state } from "./state.js";
import { esc } from "./utils.js";
import {
  configureSearch,
  debounceSearch,
  findExactMatch,
  renderSearchResults,
  resetSearchExpansion,
} from "./search.js";

let startEditor = null;

export function configureHome(startEditorCallback) {
  startEditor = startEditorCallback;
  configureSearch({
    openWord,
    showHomeError,
  });
  document.addEventListener("search-updated", updateCreateButton);
}

export function renderHome() {
  state.spellingEditor?.destroy();
  state.spellingEditor = null;
  state.readingsEditor?.destroy();
  state.readingsEditor = null;
  state.editor = null;

  const lexicalItemTypes = Object.keys(state.meta.lexical_item_types);
  const selectedMeta = state.selectedType ? state.meta.lexical_item_types[state.selectedType] : null;

  app.innerHTML = `
    <section class="home-panel">
      <div class="header-row">
        <h1>Japanese Word Bank</h1>
      </div>
      <div class="lexical-item-type-grid" role="group" aria-label="Lexical item class">
        ${lexicalItemTypes
          .map(
            (type) =>
              `<button type="button" data-type="${esc(type)}" class="${
                state.selectedType === type ? "active" : ""
              }">${esc(state.meta.lexical_item_types[type].button)}</button>`
          )
          .join("")}
      </div>
      <div id="entry-panel" class="${state.selectedType ? "" : "hidden"}">
        <div class="entry-heading">
          <h2>${selectedMeta ? esc(selectedMeta.button) : ""}</h2>
        </div>
        <div class="entry-layout">
          <div id="spelling-mount"></div>
          <div id="search-popup" class="search-popup" hidden>
            <div class="results-title">${
              selectedMeta ? `Already added ${esc(selectedMeta.plural)}` : ""
            }</div>
            <div id="search-results" class="search-results"></div>
          </div>
          <div class="status-row">
            <span class="status-message" id="home-status"></span>
            <button id="create-button" class="accept-button" type="button" disabled>Create</button>
          </div>
        </div>
      </div>
    </section>`;

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => selectType(button.dataset.type));
  });

  document.getElementById("create-button")?.addEventListener("click", createDraft);

  if (state.selectedType) {
    const mount = document.getElementById("spelling-mount");
    state.spellingEditor = createWritingEditor(mount, {
      mode: "spelling",
      word: state.query.trim()
        ? { spelling: state.query, readingMappings: [] }
        : undefined,
      onSpellingChange(spelling) {
        state.query = spelling;
        state.searching = Boolean(spelling.trim());
        state.results = [];
        resetSearchExpansion();
        renderSearchResults();
        updateCreateButton();
        if (spelling.trim()) debounceSearch();
      },
    });
    renderSearchResults();
    updateCreateButton();
    if (state.query.trim()) debounceSearch();
    queueMicrotask(() => state.spellingEditor?.focus());
  }
}

function selectType(type) {
  state.selectedType = type;
  state.query = "";
  state.results = [];
  state.searching = false;
  resetSearchExpansion();
  clearTimeout(state.searchTimer);
  renderHome();
}

function updateCreateButton() {
  const button = document.getElementById("create-button");
  if (!button || !state.selectedType) return;
  const query = state.query.trim();
  const label = state.meta.lexical_item_types[state.selectedType].singular;
  const exact = findExactMatch();
  button.disabled = !query;
  button.textContent = !query
    ? `Create new ${label}`
    : exact
      ? `Create duplicate ${label}: ${query}`
      : `Create new ${label}: ${query}`;
}

async function openWord(id) {
  try {
    const data = await api(`/api/words/${id}`);
    startEditor(data.word, false);
  } catch (error) {
    showHomeError(error.message);
  }
}

function createDraft() {
  const spelling = state.query.trim();
  if (!state.selectedType || !spelling) return;
  startEditor(
    {
      spelling,
      explanation: "",
      readingMappings: [],
      lexicalItemType: state.selectedType,
    },
    true
  );
}

function showHomeError(message) {
  const box = document.getElementById("search-results");
  if (box) {
    box.innerHTML = `<div class="error-box">${esc(message)}</div>`;
    const popup = document.getElementById("search-popup");
    if (popup) popup.hidden = false;
    return;
  }
  const status = document.getElementById("home-status");
  if (status) status.textContent = message;
}
