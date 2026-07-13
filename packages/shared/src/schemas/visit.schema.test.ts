import { describe, expect, it } from "vitest";

import {
  VISIT_NOTE_MAX_LENGTH,
  countryCodeSchema,
  upsertVisitSchema,
  visitListSchema,
  visitSchema,
} from "./visit.schema";

const CURRENT_YEAR = new Date().getFullYear();

describe("countryCodeSchema", () => {
  it("accepts canonical ISO alpha-2 codes", () => {
    for (const code of ["FR", "JP", "US", "AQ"]) {
      expect(countryCodeSchema.safeParse(code).success, code).toBe(true);
    }
  });

  it("rejects unknown, lowercase and alpha-3 codes", () => {
    for (const code of ["ZZ", "fr", "FRA", "", "F", "XK"]) {
      expect(countryCodeSchema.safeParse(code).success, code).toBe(false);
    }
  });
});

describe("upsertVisitSchema", () => {
  it("accepts an empty body (mark without details)", () => {
    expect(upsertVisitSchema.parse({})).toEqual({});
  });

  it("accepts year and note together", () => {
    expect(
      upsertVisitSchema.parse({ visitedYear: 2019, note: "Great trip" }),
    ).toEqual({ visitedYear: 2019, note: "Great trip" });
  });

  it("accepts the year bounds 1900 and the current year", () => {
    expect(upsertVisitSchema.safeParse({ visitedYear: 1900 }).success).toBe(
      true,
    );
    expect(
      upsertVisitSchema.safeParse({ visitedYear: CURRENT_YEAR }).success,
    ).toBe(true);
  });

  it("rejects out-of-range and non-integer years", () => {
    for (const visitedYear of [1899, CURRENT_YEAR + 1, 2000.5, "2000"]) {
      expect(
        upsertVisitSchema.safeParse({ visitedYear }).success,
        String(visitedYear),
      ).toBe(false);
    }
  });

  it("trims the note and enforces the length cap", () => {
    expect(upsertVisitSchema.parse({ note: "  hi  " })).toEqual({
      note: "hi",
    });
    expect(
      upsertVisitSchema.safeParse({
        note: "x".repeat(VISIT_NOTE_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      upsertVisitSchema.safeParse({
        note: "x".repeat(VISIT_NOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      upsertVisitSchema.safeParse({ countryCode: "FR" }).success,
    ).toBe(false);
  });
});

describe("visitSchema", () => {
  const visit = {
    countryCode: "JP",
    visitedYear: 2020,
    note: null,
    createdAt: "2026-07-13T00:00:00.000Z",
  };

  it("accepts a well-formed visit", () => {
    expect(visitSchema.parse(visit)).toEqual(visit);
  });

  it("accepts null year/note", () => {
    expect(
      visitSchema.safeParse({ ...visit, visitedYear: null }).success,
    ).toBe(true);
  });

  it("rejects malformed createdAt", () => {
    expect(
      visitSchema.safeParse({ ...visit, createdAt: "yesterday" }).success,
    ).toBe(false);
  });

  it("parses lists", () => {
    expect(visitListSchema.parse([visit])).toEqual([visit]);
    expect(visitListSchema.safeParse([{ countryCode: "ZZ" }]).success).toBe(
      false,
    );
  });
});
