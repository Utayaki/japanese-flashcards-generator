import { test, expect } from "@playwright/test";
import {
  characterUnits,
  furiganaInputs,
  gotoEditor,
  mainInput,
  mirrorUnits,
  typeJapanese,
} from "./helpers.js";

test.describe("character input", () => {
  test("hiragana becomes a kana unit without a furigana field", async ({
    page,
  }) => {
    await gotoEditor(page);
    await typeJapanese(page, "あ");

    await expect(characterUnits(page)).toHaveCount(1);
    const unit = characterUnits(page).first();
    await expect(unit).toHaveClass(/kana-unit/);
    await expect(unit.locator(".char-display")).toHaveText("あ");
    await expect(unit.locator(".furigana-input")).toHaveCount(0);
    await expect(mainInput(page)).toHaveValue("");
  });

  test("katakana becomes a kana unit without a furigana field", async ({
    page,
  }) => {
    await gotoEditor(page);
    await typeJapanese(page, "ア");

    const unit = characterUnits(page).first();
    await expect(unit).toHaveClass(/kana-unit/);
    await expect(unit.locator(".char-display")).toHaveText("ア");
    await expect(furiganaInputs(page)).toHaveCount(0);
  });

  test("kanji becomes a reading unit with a furigana input", async ({
    page,
  }) => {
    await gotoEditor(page);
    await typeJapanese(page, "日");

    const unit = characterUnits(page).first();
    await expect(unit).toHaveClass(/has-reading/);
    await expect(unit.locator(".char-display")).toHaveText("日");
    await expect(unit.locator(".furigana-input")).toHaveCount(1);
    await expect(unit.locator(".furigana-input")).toHaveAttribute(
      "aria-label",
      "Furigana for 日"
    );
  });

  test("latin text is ignored and does not add characters", async ({ page }) => {
    await gotoEditor(page);
    await typeJapanese(page, "abc");

    await expect(characterUnits(page)).toHaveCount(0);
    await expect(mainInput(page)).toHaveValue("abc");
  });

  test("mirror line matches committed characters", async ({ page }) => {
    await gotoEditor(page);
    await typeJapanese(page, "日本語");

    await expect(characterUnits(page)).toHaveCount(3);
    await expect(mirrorUnits(page)).toHaveCount(3);
    await expect(characterUnits(page).nth(0).locator(".char-display")).toHaveText(
      "日"
    );
    await expect(characterUnits(page).nth(1).locator(".char-display")).toHaveText(
      "本"
    );
    await expect(characterUnits(page).nth(2).locator(".char-display")).toHaveText(
      "語"
    );
    await expect(mirrorUnits(page).nth(0).locator(".mirror-char")).toHaveText(
      "日"
    );
    await expect(mirrorUnits(page).nth(1).locator(".mirror-char")).toHaveText(
      "本"
    );
    await expect(mirrorUnits(page).nth(2).locator(".mirror-char")).toHaveText(
      "語"
    );
  });
});
