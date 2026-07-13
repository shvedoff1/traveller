import { describe, expect, it } from "vitest";

import {
  CONTINENTS,
  COUNTRIES,
  COUNTRY_CODES,
  flagEmoji,
  isCountryCode,
} from "./countries";

describe("COUNTRIES", () => {
  it("contains all 249 officially assigned ISO-3166-1 codes", () => {
    expect(COUNTRIES.length).toBe(249);
  });

  it("is sorted by code", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(codes).toEqual([...codes].sort());
  });

  it("has unique codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses uppercase two-letter ISO-3166-1 alpha-2 codes", () => {
    for (const { code } of COUNTRIES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("has a name and a known continent for every entry", () => {
    for (const country of COUNTRIES) {
      expect(country.name.length).toBeGreaterThan(0);
      expect(CONTINENTS).toContain(country.continent);
    }
  });

  it("derives every flag emoji from regional indicator symbols", () => {
    for (const { code, emoji } of COUNTRIES) {
      const expected = String.fromCodePoint(
        0x1f1e6 + (code.charCodeAt(0) - 0x41),
        0x1f1e6 + (code.charCodeAt(1) - 0x41),
      );
      expect(emoji).toBe(expected);
    }
  });

  it("spot-checks well-known entries", () => {
    const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
    expect(byCode.get("FR")).toEqual({
      code: "FR",
      name: "France",
      continent: "Europe",
      emoji: "🇫🇷",
    });
    expect(byCode.get("JP")?.emoji).toBe("🇯🇵");
    expect(byCode.get("BR")?.continent).toBe("South America");
    expect(byCode.get("AQ")?.continent).toBe("Antarctica");
  });
});

describe("flagEmoji", () => {
  it("maps letters to regional indicator symbols", () => {
    expect(flagEmoji("US")).toBe("🇺🇸");
    expect(flagEmoji("AA")).toBe("\u{1F1E6}\u{1F1E6}");
  });

  it("rejects malformed input", () => {
    expect(() => flagEmoji("fr")).toThrow();
    expect(() => flagEmoji("FRA")).toThrow();
    expect(() => flagEmoji("")).toThrow();
  });
});

describe("COUNTRY_CODES", () => {
  it("mirrors COUNTRIES exactly", () => {
    expect(COUNTRY_CODES.size).toBe(COUNTRIES.length);
    for (const { code } of COUNTRIES) {
      expect(COUNTRY_CODES.has(code)).toBe(true);
    }
  });
});

describe("isCountryCode", () => {
  it("accepts known codes", () => {
    expect(isCountryCode("FR")).toBe(true);
    expect(isCountryCode("JP")).toBe(true);
  });

  it("rejects unknown codes, lowercase and non-strings", () => {
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("fr")).toBe(false);
    expect(isCountryCode("")).toBe(false);
    expect(isCountryCode(42)).toBe(false);
    expect(isCountryCode(null)).toBe(false);
    expect(isCountryCode(undefined)).toBe(false);
  });
});
