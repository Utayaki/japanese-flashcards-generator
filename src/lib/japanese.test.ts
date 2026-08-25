import { describe, expect, it } from "vitest";
import {
  filterJapanese,
  filterKana,
  isJapaneseChar,
  isKanji,
} from "./japanese";

describe("japanese helpers", () => {
  it("detects Japanese characters", () => {
    expect(isJapaneseChar("あ")).toBe(true);
    expect(isJapaneseChar("漢")).toBe(true);
    expect(isJapaneseChar("ア")).toBe(true);
    expect(isJapaneseChar("a")).toBe(false);
  });

  it("detects kanji", () => {
    expect(isKanji("漢")).toBe(true);
    expect(isKanji("々")).toBe(true);
    expect(isKanji("あ")).toBe(false);
    expect(isKanji("ア")).toBe(false);
  });

  it("filters Japanese from mixed text", () => {
    expect(filterJapanese("hello漢字worldかな")).toBe("漢字かな");
  });

  it("filters kana only", () => {
    expect(filterKana("漢字かなカナ")).toBe("かなカナ");
  });
});
