import { test, expect } from "@playwright/test";
import {
  characterUnits,
  gotoEditor,
  mainInput,
  pasteIntoMain,
} from "./helpers.js";

test.describe("paste", () => {
  test("pasting Japanese adds characters", async ({ page }) => {
    await gotoEditor(page);
    await pasteIntoMain(page, "こんにちは");

    await expect(characterUnits(page)).toHaveCount(5);
    await expect(characterUnits(page).nth(0).locator(".char-display")).toHaveText(
      "こ"
    );
    await expect(characterUnits(page).nth(4).locator(".char-display")).toHaveText(
      "は"
    );
    await expect(mainInput(page)).toHaveValue("");
  });

  test("mixed paste keeps only Japanese", async ({ page }) => {
    await gotoEditor(page);
    await pasteIntoMain(page, "ab日c本d語ef");

    await expect(characterUnits(page)).toHaveCount(3);
    await expect(characterUnits(page).nth(0).locator(".char-display")).toHaveText(
      "日"
    );
    await expect(characterUnits(page).nth(1).locator(".char-display")).toHaveText(
      "本"
    );
    await expect(characterUnits(page).nth(2).locator(".char-display")).toHaveText(
      "語"
    );
  });
});
