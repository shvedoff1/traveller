/**
 * Integrity tests for the generated COUNTRY_CENTROIDS (map flyTo targets).
 * Regenerate with `node scripts/prepare-geo.mjs --centroids-only`.
 */

import { describe, expect, it } from "vitest";

import { COUNTRIES, COUNTRY_CODES } from "./countries";
import { COUNTRY_CENTROIDS } from "./country-centroids";

describe("COUNTRY_CENTROIDS", () => {
  it("covers every canonical country and nothing else", () => {
    const keys = Object.keys(COUNTRY_CENTROIDS);
    expect(keys.length).toBe(COUNTRIES.length);
    expect(keys.filter((code) => !COUNTRY_CODES.has(code))).toEqual([]);
  });

  it("keeps coordinates and zoom within valid ranges", () => {
    for (const [code, [lng, lat, zoom]] of Object.entries(COUNTRY_CENTROIDS)) {
      expect(lng, code).toBeGreaterThanOrEqual(-180);
      expect(lng, code).toBeLessThanOrEqual(180);
      expect(lat, code).toBeGreaterThanOrEqual(-90);
      expect(lat, code).toBeLessThanOrEqual(90);
      expect(zoom, code).toBeGreaterThanOrEqual(1);
      expect(zoom, code).toBeLessThanOrEqual(7);
    }
  });

  it("places well-known countries where they belong", () => {
    const near = (code: string, lng: number, lat: number, tolerance = 6) => {
      const [actualLng, actualLat] = COUNTRY_CENTROIDS[code]!;
      expect(Math.abs(actualLng - lng), code).toBeLessThan(tolerance);
      expect(Math.abs(actualLat - lat), code).toBeLessThan(tolerance);
    };
    near("FR", 2.5, 46.6); // metropolitan France, not skewed by DOM-TOM
    near("JP", 138, 36.5);
    near("BR", -53, -11);
    near("AU", 134, -25.5);
    // Antimeridian countries must not end up on the wrong side of the globe.
    near("RU", 99, 61, 15);
    near("FJ", 178, -17.8);
    near("NZ", 170.5, -44);
  });
});
