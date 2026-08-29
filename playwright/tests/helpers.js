/** @param {import('@playwright/test').Page} page */
export async function gotoEditor(page) {
  await page.goto("/");
  await page.locator(".main-input").waitFor();
}

/** @param {import('@playwright/test').Page} page */
export function mainInput(page) {
  return page.locator(".main-input");
}

/** @param {import('@playwright/test').Page} page */
export function characterUnits(page) {
  return page.locator(".writing-line .character-unit:not(.composer-unit)");
}

/** @param {import('@playwright/test').Page} page */
export function mirrorUnits(page) {
  return page.locator(".mirror-line .mirror-unit");
}

/** @param {import('@playwright/test').Page} page */
export function furiganaInputs(page) {
  return page.locator(".furigana-input");
}

/** @param {import('@playwright/test').Page} page */
export function statusRow(page) {
  return page.locator(".status-row");
}

/**
 * Commit text through the composer input handler without IME composition.
 * A single input event is dispatched with the full value so long strings are
 * not truncated the way keyboard.insertText() is in Chromium.
 * fill() cannot be used: the editor clears the input after commit, and fill()
 * asserts the typed value is still present.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
export async function typeJapanese(page, text) {
  await mainInput(page).evaluate((el, value) => {
    el.focus();
    el.value = value;
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: value,
        inputType: "insertText",
      })
    );
  }, text);
}

/**
 * Dispatch a paste event with clipboardData, matching editor.js's paste handler.
 * Object.defineProperty is used so Firefox/WebKit also expose clipboardData.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
export async function pasteIntoMain(page, text) {
  await mainInput(page).focus();
  await page.evaluate((pasted) => {
    const input = document.querySelector(".main-input");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      configurable: true,
      value: { getData: () => pasted },
    });
    input.dispatchEvent(event);
  }, text);
}
