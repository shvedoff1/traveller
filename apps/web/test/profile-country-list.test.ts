import { describe, expect, it } from "vitest";

import { buildProfileCountryList } from "../lib/profile/country-list";

const theirs = ["JP", "FR", "BR", "IT", "XX"];

const codes = (list: ReturnType<typeof buildProfileCountryList>) =>
  list.groups.flatMap((group) => group.countries.map((c) => c.code));

describe("buildProfileCountryList", () => {
  it("groups their countries by continent, by name within each", () => {
    const list = buildProfileCountryList(theirs, null, "all");
    expect(list.groups.map((group) => group.continent)).toEqual([
      "Asia",
      "Europe",
      "South America",
    ]);
    // Europe: France before Italy; unknown codes dropped.
    expect(codes(list)).toEqual(["JP", "FR", "IT", "BR"]);
    expect(list.counts).toEqual({ all: 4, shared: 0, new: 0 });
  });

  it("splits into countries in common and ones you haven't been to", () => {
    const mine = ["FR", "DE", "BR"];
    const shared = buildProfileCountryList(theirs, mine, "shared");
    expect(codes(shared)).toEqual(["FR", "BR"]);
    const fresh = buildProfileCountryList(theirs, mine, "new");
    expect(codes(fresh)).toEqual(["JP", "IT"]);
    expect(shared.counts).toEqual({ all: 4, shared: 2, new: 2 });
  });

  it("handles an empty map", () => {
    const list = buildProfileCountryList([], ["FR"], "all");
    expect(list.groups).toEqual([]);
    expect(list.counts).toEqual({ all: 0, shared: 0, new: 0 });
  });
});
