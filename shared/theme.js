const STORAGE_KEY = "japanese-learning-theme";
const THEMES = ["washi", "seiro", "susudake"];

function currentTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.includes(stored) ? stored : "washi";
}

function applyTheme(theme) {
  const next = THEMES.includes(theme) ? theme : "washi";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(STORAGE_KEY, next);
  for (const swatch of document.querySelectorAll(".theme-swatch")) {
    swatch.setAttribute("aria-checked", String(swatch.dataset.theme === next));
  }
}

function renderSwatches() {
  if (document.querySelector(".theme-swatches")) return;
  const group = document.createElement("div");
  group.className = "theme-swatches";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Paper theme");
  const active = currentTheme();
  for (const theme of THEMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-swatch";
    button.dataset.theme = theme;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", theme);
    button.setAttribute("aria-checked", String(theme === active));
    button.addEventListener("click", () => applyTheme(theme));
    group.append(button);
  }
  document.body.append(group);
}

export function initTheme() {
  applyTheme(currentTheme());
  renderSwatches();
}
