import { describe, expect, it } from "vitest";

import { COUNTRIES, COUNTRY_CODES, isCountryCode } from "./countries";

describe("COUNTRIES", () => {
  it("is non-empty", () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
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

  it("has a name, continent and flag emoji for every entry", () => {
    for (const country of COUNTRIES) {
      expect(country.name.length).toBeGreaterThan(0);
      expect(country.continent.length).toBeGreaterThan(0);
      expect(country.emoji.length).toBeGreaterThan(0);
    }
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
