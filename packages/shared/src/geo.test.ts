/**
 * Integrity tests reconciling the committed map GeoJSON
 * (apps/web/public/geo/countries.geojson) and the generated WORLD_PATHS
 * against the canonical COUNTRIES list. Regenerate both with
 * `node scripts/prepare-geo.mjs` if these fail after a data change.
 */

import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { COUNTRY_CODES } from "./countries";
import { WORLD_PATHS, WORLD_PATHS_VIEWBOX } from "./world-paths";

const GEOJSON_PATH = path.resolve(
  __dirname,
  "../../../apps/web/public/geo/countries.geojson",
);

/** Keep in sync with scripts/prepare-geo.mjs. */
const ALLOWED_EXTRA_IN_GEOJSON = new Set([
  "XK", // Kosovo — user-assigned code, no official ISO-3166-1 entry
]);

/** Keep in sync with scripts/prepare-geo.mjs. */
const ALLOWED_MISSING_FROM_GEOJSON = new Set([
  "BQ", // Caribbean Netherlands — part of NL in NE admin-0
  "BV", // Bouvet Island — below 50m resolution
  "CC", // Cocos (Keeling) Islands — part of AU
  "CX", // Christmas Island — part of AU
  "GF", // French Guiana — part of FR
  "GI", // Gibraltar — below 50m resolution
  "GP", // Guadeloupe — part of FR
  "MQ", // Martinique — part of FR
  "RE", // Réunion — part of FR
  "SJ", // Svalbard and Jan Mayen — part of NO
  "TK", // Tokelau — below 50m resolution
  "UM", // US Minor Outlying Islands — part of US
  "YT", // Mayotte — part of FR
]);

interface GeoFeature {
  type: string;
  id: string;
  properties: { iso: string; name: string };
  geometry: { type: string };
}

const collection = JSON.parse(readFileSync(GEOJSON_PATH, "utf8")) as {
  type: string;
  features: GeoFeature[];
};

describe("countries.geojson", () => {
  it("is a FeatureCollection with a sensible number of countries", () => {
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features.length).toBeGreaterThan(200);
  });

  it("stays within the 2 MB budget", () => {
    expect(statSync(GEOJSON_PATH).size).toBeLessThan(2 * 1024 * 1024);
  });

  it("gives every feature an ISO alpha-2 id mirrored in properties.iso", () => {
    for (const feature of collection.features) {
      expect(feature.id).toMatch(/^[A-Z]{2}$/);
      expect(feature.properties.iso).toBe(feature.id);
      expect(feature.properties.name.length).toBeGreaterThan(0);
      expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
    }
  });

  it("has unique feature ids", () => {
    const ids = collection.features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only contains codes from COUNTRIES plus the explicit allowlist", () => {
    const extra = collection.features
      .map((f) => f.id)
      .filter((id) => !COUNTRY_CODES.has(id) && !ALLOWED_EXTRA_IN_GEOJSON.has(id));
    expect(extra).toEqual([]);
  });

  it("covers every COUNTRIES code except the explicit allowlist", () => {
    const geoCodes = new Set(collection.features.map((f) => f.id));
    const missing = [...COUNTRY_CODES].filter(
      (code) => !geoCodes.has(code) && !ALLOWED_MISSING_FROM_GEOJSON.has(code),
    );
    expect(missing).toEqual([]);
    // The allowlist must not go stale: everything on it really is missing.
    const stale = [...ALLOWED_MISSING_FROM_GEOJSON].filter((code) =>
      geoCodes.has(code),
    );
    expect(stale).toEqual([]);
  });
});

describe("WORLD_PATHS", () => {
  it("declares the OG-image viewBox", () => {
    expect(WORLD_PATHS_VIEWBOX).toBe("0 0 1000 500");
  });

  it("only has keys from the COUNTRIES list", () => {
    const unknown = Object.keys(WORLD_PATHS).filter(
      (code) => !COUNTRY_CODES.has(code),
    );
    expect(unknown).toEqual([]);
    expect(Object.keys(WORLD_PATHS).length).toBeGreaterThan(200);
  });

  it("contains closed SVG paths with in-bounds coordinates", () => {
    for (const [code, d] of Object.entries(WORLD_PATHS)) {
      expect(d, code).toMatch(/^M[\d .LMZ-]+Z$/);
      const coordinates = d.match(/-?[\d.]+/g) ?? [];
      expect(coordinates.length, code).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < coordinates.length; i += 2) {
        const x = Number(coordinates[i]);
        const y = Number(coordinates[i + 1]);
        expect(x, code).toBeGreaterThanOrEqual(0);
        expect(x, code).toBeLessThanOrEqual(1000);
        expect(y, code).toBeGreaterThanOrEqual(0);
        expect(y, code).toBeLessThanOrEqual(500);
      }
    }
  });
});
