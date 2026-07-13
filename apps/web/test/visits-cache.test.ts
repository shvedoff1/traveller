import { type Visit } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import {
  applyDelete,
  applyUpsert,
  findVisit,
  visitedCodes,
} from "../lib/visits/visits-cache";

const NOW = "2026-07-13T12:00:00.000Z";

const visit = (countryCode: string, extra: Partial<Visit> = {}): Visit => ({
  countryCode,
  visitedYear: null,
  note: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

describe("applyUpsert", () => {
  it("adds a new visit to an empty/undefined cache", () => {
    expect(applyUpsert(undefined, "FR", {}, NOW)).toEqual([
      { countryCode: "FR", visitedYear: null, note: null, createdAt: NOW },
    ]);
  });

  it("keeps the list sorted by country code", () => {
    const list = applyUpsert([visit("JP"), visit("AR")], "FR", {}, NOW);
    expect(list.map((entry) => entry.countryCode)).toEqual([
      "AR",
      "FR",
      "JP",
    ]);
  });

  it("replaces year/note on an existing visit but keeps createdAt", () => {
    const existing = visit("FR", { visitedYear: 2019, note: "old" });
    const [updated] = applyUpsert([existing], "FR", { note: "new" }, NOW);
    expect(updated).toEqual({
      countryCode: "FR",
      visitedYear: null, // PUT semantics: omitted year clears
      note: "new",
      createdAt: existing.createdAt,
    });
  });

  it("does not duplicate an already-visited country", () => {
    const list = applyUpsert([visit("FR")], "FR", { visitedYear: 2020 }, NOW);
    expect(list).toHaveLength(1);
    expect(list[0]?.visitedYear).toBe(2020);
  });

  it("treats an empty note as cleared", () => {
    const [updated] = applyUpsert([], "FR", { note: "" }, NOW);
    expect(updated?.note).toBeNull();
  });
});

describe("applyDelete", () => {
  it("removes the visit and leaves others alone", () => {
    const list = applyDelete([visit("FR"), visit("JP")], "FR");
    expect(list.map((entry) => entry.countryCode)).toEqual(["JP"]);
  });

  it("is a no-op when absent or cache is empty", () => {
    expect(applyDelete([visit("JP")], "FR")).toEqual([visit("JP")]);
    expect(applyDelete(undefined, "FR")).toEqual([]);
  });
});

describe("findVisit / visitedCodes", () => {
  it("finds a visit by code", () => {
    const visits = [visit("FR"), visit("JP")];
    expect(findVisit(visits, "JP")?.countryCode).toBe("JP");
    expect(findVisit(visits, "BR")).toBeUndefined();
    expect(findVisit(undefined, "FR")).toBeUndefined();
  });

  it("projects the codes for the map join", () => {
    expect(visitedCodes([visit("AR"), visit("FR")])).toEqual(["AR", "FR"]);
    expect(visitedCodes(undefined)).toEqual([]);
  });
});
