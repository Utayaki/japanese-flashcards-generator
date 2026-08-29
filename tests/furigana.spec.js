import { test, expect } from "@playwright/test";
import {
  furiganaInputs,
  gotoEditor,
  mainInput,
  typeJapanese,
} from "./helpers.js";

test.describe("furigana", () => {
  test("accepts kana and strips non-kana", async ({ page }) => {
    await gotoEditor(page);
    await typeJapanese(page, "漢");

    const reading = furiganaInputs(page).first();
    await reading.click();
    await reading.pressSequentially("かんa字");
    await expect(reading).toHaveValue("かん");
  });

  test("limits furigana to 5 characters", async ({ page }) => {
    await gotoEditor(page);
    await typeJapanese(page, "漢");

    const reading = furiganaInputs(page).first();
    await expect(reading).toHaveAttribute("maxLength", "5");
    await reading.click();
    await reading.pressSequentially("あいうえおか");
    await expect(reading).toHaveValue("あいうえお");
  });

  test("ArrowLeft from empty main input focuses the last furigana", async ({
    page,
  }) => {
    await gotoEditor(page);
    await typeJapanese(page, "漢字");
    await expect(mainInput(page)).toBeFocused();
    await expect(mainInput(page)).toHaveValue("");

    await mainInput(page).press("ArrowLeft");
    await expect(furiganaInputs(page).nth(1)).toBeFocused();
  });

  test("arrows move between readings and then back to the main input", async ({
    page,
  }) => {
    await gotoEditor(page);
    await typeJapanese(page, "漢字");

    await mainInput(page).press("ArrowLeft");
    await expect(furiganaInputs(page).nth(1)).toBeFocused();

    await furiganaInputs(page).nth(1).press("ArrowLeft");
    await expect(furiganaInputs(page).nth(0)).toBeFocused();

    await furiganaInputs(page).nth(0).press("ArrowRight");
    await expect(furiganaInputs(page).nth(1)).toBeFocused();

    await furiganaInputs(page).nth(1).press("ArrowRight");
    await expect(mainInput(page)).toBeFocused();
  });
});
