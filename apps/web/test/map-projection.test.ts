import { afterEach, describe, expect, it } from "vitest";

import {
  nextProjection,
  persistProjection,
  PROJECTION_STORAGE_KEY,
  readProjection,
} from "../lib/map/projection";

describe("nextProjection", () => {
  it("toggles globe ↔ mercator", () => {
    expect(nextProjection("globe")).toBe("mercator");
    expect(nextProjection("mercator")).toBe("globe");
  });
});

describe("readProjection / persistProjection", () => {
  afterEach(() => sessionStorage.clear());

  it("defaults to globe when nothing is stored", () => {
    expect(readProjection(sessionStorage)).toBe("globe");
  });

  it("defaults to globe for unrecognised values", () => {
    sessionStorage.setItem(PROJECTION_STORAGE_KEY, "banana");
    expect(readProjection(sessionStorage)).toBe("globe");
  });

  it("reads a persisted mercator choice", () => {
    persistProjection(sessionStorage, "mercator");
    expect(sessionStorage.getItem(PROJECTION_STORAGE_KEY)).toBe("mercator");
    expect(readProjection(sessionStorage)).toBe("mercator");
  });

  it("round-trips globe", () => {
    persistProjection(sessionStorage, "mercator");
    persistProjection(sessionStorage, "globe");
    expect(readProjection(sessionStorage)).toBe("globe");
  });

  it("is safe when storage is unavailable", () => {
    expect(readProjection(null)).toBe("globe");
    expect(() => persistProjection(null, "mercator")).not.toThrow();
  });
});
