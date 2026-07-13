import { COUNTRIES } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import { filterCountries, normalize } from "../lib/country-filter";

describe("normalize", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Côte d'Ivoire")).toBe("cote d'ivoire");
    expect(normalize("Åland Islands")).toBe("aland islands");
    expect(normalize("São Tomé and Príncipe")).toBe("sao tome and principe");
  });
});

describe("filterCountries", () => {
  it("returns everything for an empty or blank query", () => {
    expect(filterCountries(COUNTRIES, "")).toHaveLength(COUNTRIES.length);
    expect(filterCountries(COUNTRIES, "   ")).toHaveLength(COUNTRIES.length);
  });

  it("matches by name, case-insensitively", () => {
    const results = filterCountries(COUNTRIES, "france");
    expect(results.map((country) => country.code)).toContain("FR");
  });

  it("matches diacritics-insensitively in both directions", () => {
    expect(
      filterCountries(COUNTRIES, "cote").map((country) => country.code),
    ).toContain("CI");
    expect(
      filterCountries(COUNTRIES, "Côte").map((country) => country.code),
    ).toContain("CI");
  });

  it("matches by ISO code", () => {
    const results = filterCountries(COUNTRIES, "jp");
    expect(results.map((country) => country.code)).toContain("JP");
  });

  it("matches substrings anywhere in the name", () => {
    const results = filterCountries(COUNTRIES, "zeal");
    expect(results.map((country) => country.code)).toEqual(["NZ"]);
  });

  it("returns nothing for garbage", () => {
    expect(filterCountries(COUNTRIES, "xyzzy")).toEqual([]);
  });
});
