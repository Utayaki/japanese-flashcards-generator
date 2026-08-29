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

  test("bulk kana commit is not treated as line-full", async ({ page }) => {
    await gotoEditor(page);
    await typeJapanese(page, "あいうえおかきくけこ");

    await expect(characterUnits(page)).toHaveCount(10);
    await expect(statusRow(page)).not.toContainText("Line full");
    await expect(mainInput(page)).toHaveAttribute("placeholder", "入力");
  });

  test("composing あいこと does not overflow the composer", async ({ page }) => {
    await gotoEditor(page);
    await mainInput(page).evaluate((el) => {
      el.focus();
      el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      el.value = "あいこと";
      el.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "あいこと",
          inputType: "insertCompositionText",
          isComposing: true,
        })
      );
    });

    await expect(characterUnits(page)).toHaveCount(0);
    await expect(mainInput(page)).toHaveValue("あいこと");
    await expect
      .poll(async () =>
        mainInput(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
      )
      .toBe(true);
  });
});
