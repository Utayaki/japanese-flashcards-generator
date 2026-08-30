import { api } from "./api.js";
import { state } from "./state.js";
import { esc, highlightFurigana, highlightMatch } from "./utils.js";
import { renderWritingLine } from "/shared/render.js";
import { foldSearch } from "/shared/japanese.js";

let openWord = null;
let showHomeError = null;

export function configureSearch(handlers) {
  openWord = handlers.openWord;
  showHomeError = handlers.showHomeError;
}

export function resetSearchExpansion() {
  state.hasMoreResults = false;
  state.searchExpanded = false;
  state.loadingAll = false;
}

function searchUrl(type, query, { all = false } = {}) {
  const params = new URLSearchParams({
    lexical_item_type: type,
    q: query,
  });
  if (all) params.set("all", "1");
  return `/api/search?${params.toString()}`;
}

export function debounceSearch() {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => runSearch(), 140);
}

export function findExactMatch() {
  const query = foldSearch(state.query.trim());
  if (!query) return null;
  return (
    state.results.find((result) => foldSearch(String(result.spelling || "").trim()) === query) ||
    null
  );
}

export async function runSearch({ all = false } = {}) {
  const type = state.selectedType;
  const query = state.query.trim();
  if (!type || !query) return;
  if (all) {
    state.loadingAll = true;
  } else {
    state.searching = true;
    state.searchExpanded = false;
  }
  renderSearchResults();
  try {
    const data = await api(searchUrl(type, query, { all }));
    if (state.selectedType === type && state.query.trim() === query) {
      state.results = data.results;
      state.hasMoreResults = Boolean(data.has_more);
      if (all) {
        state.searchExpanded = true;
        state.hasMoreResults = false;
        state.loadingAll = false;
      } else {
        state.searching = false;
      }
      renderSearchResults();
      document.dispatchEvent(new Event("search-updated"));
    }
  } catch (error) {
    state.searching = false;
    state.loadingAll = false;
    const results = document.getElementById("search-results");
    if (results) results.innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
    showPopup();
  }
}

async function loadAllResults() {
  if (!state.hasMoreResults || state.searchExpanded || state.loadingAll) return;
  await runSearch({ all: true });
}

function showPopup() {
  const popup = document.getElementById("search-popup");
  if (!popup) return;
  popup.hidden = !state.query.trim();
}

export function renderSearchResults() {
  const box = document.getElementById("search-results");
  if (!box) return;
  showPopup();
  if (!state.query.trim()) {
    box.innerHTML = "";
    return;
  }
  if (state.searching) {
    box.innerHTML = '<p class="muted">Searching…</p>';
    return;
  }
  if (state.loadingAll) {
    box.innerHTML = '<p class="muted">Loading…</p>';
    return;
  }
  if (!state.results.length) {
    box.innerHTML = '<p class="muted">None</p>';
    return;
  }
  const loadAllButton =
    state.hasMoreResults && !state.searchExpanded
      ? '<button type="button" id="load-all-button" class="ghost load-all-button">Load all</button>'
      : "";

  box.replaceChildren();
  for (const result of state.results) {
    const row = document.createElement("div");
    row.className = "search-result";
    row.dataset.wordId = String(result.id);

    const main = document.createElement("div");
    main.className = "search-result-main";
    main.tabIndex = 0;
    main.setAttribute("role", "button");
    const line = renderWritingLine(result);
    highlightFurigana(line, state.query);
    const caption = document.createElement("p");
    caption.className = "search-explanation";
    caption.innerHTML = result.explanation
      ? highlightMatch(result.explanation, state.query)
      : "";
    main.append(line, caption);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.dataset.deleteId = String(result.id);
    del.textContent = "Delete";

    row.append(main, del);
    box.append(row);
  }
  if (loadAllButton) {
    const wrap = document.createElement("div");
    wrap.innerHTML = loadAllButton;
    box.append(...wrap.children);
  }

  box.querySelectorAll(".search-result-main").forEach((row) => {
    const id = row.closest(".search-result").dataset.wordId;
    row.addEventListener("click", () => openWord(id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openWord(id);
      }
    });
  });
  box.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteWord(button.dataset.deleteId);
    });
  });
  document.getElementById("load-all-button")?.addEventListener("click", loadAllResults);
}

async function deleteWord(id) {
  const item = state.results.find((result) => String(result.id) === String(id));
  const label = item?.spelling || "this word";
  if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
  try {
    await api(`/api/words/${id}`, { method: "DELETE" });
    state.results = state.results.filter((result) => String(result.id) !== String(id));
    renderSearchResults();
    document.dispatchEvent(new Event("search-updated"));
    if (state.query.trim()) {
      if (state.searchExpanded) {
        runSearch({ all: true });
      } else {
        runSearch();
      }
    }
  } catch (error) {
    showHomeError?.(error.message);
  }
}
