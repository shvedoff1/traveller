import { COUNTRIES } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import {
  filterCountries,
  groupByContinent,
  normalize,
} from "../lib/country-filter";

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

describe("groupByContinent", () => {
  it("splits the full list into every continent, in canonical order", () => {
    const groups = groupByContinent(COUNTRIES);
    expect(groups.map((group) => group.continent)).toEqual([
      "Africa",
      "Antarctica",
      "Asia",
      "Europe",
      "North America",
      "Oceania",
      "South America",
    ]);
    const total = groups.reduce((sum, group) => sum + group.countries.length, 0);
    expect(total).toBe(COUNTRIES.length);
    for (const group of groups) {
      for (const country of group.countries) {
        expect(country.continent).toBe(group.continent);
      }
    }
  });

  it("drops continents that have nothing left after filtering", () => {
    const groups = groupByContinent(filterCountries(COUNTRIES, "zeal"));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.continent).toBe("Oceania");
    expect(groups[0]?.countries.map((country) => country.code)).toEqual(["NZ"]);
  });

  it("keeps the input order inside a section", () => {
    const europe = groupByContinent(COUNTRIES).find(
      (group) => group.continent === "Europe",
    );
    // COUNTRIES is ordered by ISO code; the section must follow it as is.
    expect(europe?.countries.map((country) => country.code)).toEqual(
      COUNTRIES.filter((country) => country.continent === "Europe").map(
        (country) => country.code,
      ),
    );
    expect(europe?.countries[0]?.code).toBe("AD");
  });

  it("returns nothing for an empty list", () => {
    expect(groupByContinent([])).toEqual([]);
  });
});
