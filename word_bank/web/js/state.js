export const SEARCH_STYLE_KEY = "jp-search-popup-style";
export const SEARCH_STYLES = ["dropdown", "cards", "rail", "overlay", "filmstrip"];

function loadSearchStyle() {
  const stored = localStorage.getItem(SEARCH_STYLE_KEY);
  return SEARCH_STYLES.includes(stored) ? stored : "dropdown";
}

export const app = document.getElementById("app");

export const state = {
  meta: null,
  selectedType: null,
  query: "",
  results: [],
  searching: false,
  searchTimer: null,
  hasMoreResults: false,
  searchExpanded: false,
  loadingAll: false,
  searchStyle: loadSearchStyle(),
  spellingEditor: null,
  readingsEditor: null,
  editor: null,
};
