import { test, expect } from "@playwright/test";
import {
  characterUnits,
  gotoEditor,
  mainInput,
  mirrorUnits,
  statusRow,
  typeJapanese,
} from "./helpers.js";

test.describe("editing", () => {
  test("Backspace removes the last character and updates the mirror", async ({
    page,
  }) => {
    await gotoEditor(page);
    await typeJapanese(page, "あい");
    await expect(characterUnits(page)).toHaveCount(2);
    await expect(mirrorUnits(page)).toHaveCount(2);

    await mainInput(page).press("Backspace");
    await expect(characterUnits(page)).toHaveCount(1);
    await expect(characterUnits(page).first().locator(".char-display")).toHaveText(
      "あ"
    );
    await expect(mirrorUnits(page)).toHaveCount(1);
    await expect(mirrorUnits(page).first().locator(".mirror-char")).toHaveText(
      "あ"
    );
  });

  test("12-character cap shows the line-full status and locks the input", async ({
    page,
  }) => {
    await gotoEditor(page);
    for (const char of "あいうえおかきくけこさし") {
      await typeJapanese(page, char);
    }

    await expect(characterUnits(page)).toHaveCount(12);
    await expect(statusRow(page)).toContainText(
      "Line full · Backspace to continue"
    );
    await expect(mainInput(page)).toHaveAttribute("placeholder", "満");
    await expect(mainInput(page)).toHaveAttribute("readonly", "");
    await expect(mainInput(page)).toHaveAttribute("aria-disabled", "true");

    await mainInput(page).focus();
    await page.keyboard.insertText("す");
    await expect(characterUnits(page)).toHaveCount(12);
  });
});
