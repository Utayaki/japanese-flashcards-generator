import { test, expect } from "@playwright/test";
import { characterUnits, gotoEditor, mainInput } from "./helpers.js";

test.describe("page load", () => {
  test("shows the editor with an empty writing line and focused input", async ({
    page,
  }) => {
    await gotoEditor(page);

    await expect(page).toHaveTitle("Furigana Editor");
    await expect(mainInput(page)).toBeVisible();
    await expect(mainInput(page)).toBeFocused();
    await expect(mainInput(page)).toHaveAttribute("placeholder", "入力");
    await expect(characterUnits(page)).toHaveCount(0);
  });
});
