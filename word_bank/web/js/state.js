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
  spellingEditor: null,
  readingsEditor: null,
  editor: null,
};
