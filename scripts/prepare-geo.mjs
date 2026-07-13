#!/usr/bin/env node
/**
 * One-time country-geometry pipeline (outputs are committed):
 *
 *   1. Download Natural Earth 50m admin-0 countries GeoJSON.
 *   2. Resolve ISO-3166-1 alpha-2 per feature (ISO_A2, falling back to
 *      ISO_A2_EH for the -99 quirk on France/Norway…); drop features
 *      without a usable code.
 *   3. Simplify with mapshaper (~10% retention) so the file stays ≲ 2 MB.
 *   4. Write apps/web/public/geo/countries.geojson —
 *      features shaped { id: iso2, properties: { iso, name } }.
 *   5. Generate packages/shared/src/world-paths.ts — equirectangular SVG
 *      path per country (viewBox 0 0 1000 500) for OG images.
 *   6. Fail loudly if the GeoJSON and COUNTRIES diverge beyond the
 *      explicit allowlists below.
 *
 * Usage: node scripts/prepare-geo.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEOJSON_OUT = path.join(ROOT, "apps/web/public/geo/countries.geojson");
const PATHS_OUT = path.join(ROOT, "packages/shared/src/world-paths.ts");
const COUNTRIES_TS = path.join(ROOT, "packages/shared/src/countries.ts");

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

/**
 * Codes present in the GeoJSON but intentionally absent from COUNTRIES:
 * rendered on the map, but not part of the canonical ISO-3166-1 list.
 * Keep in sync with packages/shared/src/geo.test.ts.
 */
const ALLOWED_EXTRA_IN_GEOJSON = new Set([
  "XK", // Kosovo — user-assigned code, no official ISO-3166-1 entry
]);

/**
 * ISO codes with no own geometry in Natural Earth 50m admin-0 "countries"
 * (mostly territories merged into their sovereign's multipolygon, e.g. the
 * French overseas departments inside FR, Svalbard inside NO, plus specks
 * below the 50m resolution). Keep in sync with packages/shared/src/geo.test.ts.
 */
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

function fail(message) {
  console.error(`\nprepare-geo: FAILED\n${message}\n`);
  process.exit(1);
}

/** Extract the canonical code list from countries.ts without compiling TS. */
function readCountryCodes() {
  const source = readFileSync(COUNTRIES_TS, "utf8");
  const codes = [...source.matchAll(/^\s*\["([A-Z]{2})",/gm)].map((m) => m[1]);
  if (codes.length < 200) {
    fail(`Only found ${codes.length} codes in countries.ts — parsing broke?`);
  }
  return new Set(codes);
}

function resolveIso(properties) {
  for (const key of ["ISO_A2", "ISO_A2_EH"]) {
    const value = properties[key];
    if (typeof value === "string" && /^[A-Z]{2}$/.test(value)) return value;
  }
  return null;
}

async function download(url) {
  console.log(`Downloading ${url} …`);
  const response = await fetch(url);
  if (!response.ok) {
    fail(`Download failed: HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

function simplify(rawPath, outPath, retention) {
  execFileSync(
    "npx",
    [
      "--yes",
      "mapshaper@0.6.107",
      rawPath,
      "-simplify",
      retention,
      "keep-shapes",
      "-clean",
      "-o",
      `precision=0.001`,
      outPath,
    ],
    { stdio: "inherit" },
  );
}

// --- Equirectangular SVG paths (viewBox 0 0 1000 500) ---------------------

const SVG_W = 1000;
const SVG_H = 500;

function project([lon, lat]) {
  const x = ((lon + 180) / 360) * SVG_W;
  const y = ((90 - lat) / 180) * SVG_H;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function ringToPath(ring) {
  const points = [];
  let previous = null;
  for (const coordinate of ring) {
    const point = project(coordinate);
    if (previous && point[0] === previous[0] && point[1] === previous[1]) {
      continue;
    }
    points.push(point);
    previous = point;
  }
  // Drop the closing coordinate (Z closes the ring).
  if (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop();
  }
  if (points.length < 3) return "";
  return `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
}

function geometryToPath(geometry) {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons
    .flat()
    .map(ringToPath)
    .filter(Boolean)
    .join("");
}

// --- Pipeline ---------------------------------------------------------------

async function main() {
  const countryCodes = readCountryCodes();
  const workDir = mkdtempSync(path.join(tmpdir(), "prepare-geo-"));

  try {
    const raw = await download(SOURCE_URL);
    console.log(`Downloaded ${raw.features.length} features.`);

    // Resolve ISO codes and strip properties down to { iso, name } BEFORE
    // simplification so mapshaper output needs no further property surgery.
    const kept = [];
    const dropped = [];
    for (const feature of raw.features) {
      const iso = resolveIso(feature.properties);
      if (!iso) {
        dropped.push(feature.properties.NAME ?? "<unnamed>");
        continue;
      }
      kept.push({
        type: "Feature",
        properties: { iso, name: feature.properties.NAME_LONG ?? feature.properties.NAME ?? iso },
        geometry: feature.geometry,
      });
    }
    console.log(
      `Kept ${kept.length} features; dropped ${dropped.length} without ISO codes: ${dropped.join(", ")}`,
    );

    // Merge features sharing a code (e.g. "Ashmore and Cartier Islands"
    // carries AU alongside Australia) into one MultiPolygon per code.
    const byIso = new Map();
    for (const feature of kept) {
      const iso = feature.properties.iso;
      const existing = byIso.get(iso);
      if (!existing) {
        byIso.set(iso, feature);
        continue;
      }
      console.log(`Merging duplicate ${iso} feature "${feature.properties.name}" into "${existing.properties.name}"`);
      const polygons = (geometry) =>
        geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      existing.geometry = {
        type: "MultiPolygon",
        coordinates: [...polygons(existing.geometry), ...polygons(feature.geometry)],
      };
      // Keep the name of the larger geometry (first occurrence wins unless
      // the newcomer clearly dominates).
      if (
        JSON.stringify(feature.geometry).length >
        JSON.stringify(existing.geometry).length * 2
      ) {
        existing.properties.name = feature.properties.name;
      }
    }
    const merged = [...byIso.values()];

    const rawPath = path.join(workDir, "raw.geojson");
    writeFileSync(rawPath, JSON.stringify({ type: "FeatureCollection", features: merged }));

    // ~10% retention keeps the committed file ≲ 2 MB.
    const simplifiedPath = path.join(workDir, "simplified.geojson");
    console.log("Simplifying for the map (10% retention) …");
    simplify(rawPath, simplifiedPath, "10%");

    // A coarser pass for the OG-image SVG paths.
    const coarsePath = path.join(workDir, "coarse.geojson");
    console.log("Simplifying for SVG world paths (3% retention) …");
    simplify(rawPath, coarsePath, "3%");

    const simplified = JSON.parse(readFileSync(simplifiedPath, "utf8"));
    for (const feature of simplified.features) {
      feature.id = feature.properties.iso;
    }

    // Reconcile with COUNTRIES.
    const geoCodes = new Set(simplified.features.map((f) => f.id));
    const extra = [...geoCodes].filter(
      (code) => !countryCodes.has(code) && !ALLOWED_EXTRA_IN_GEOJSON.has(code),
    );
    const missing = [...countryCodes].filter(
      (code) => !geoCodes.has(code) && !ALLOWED_MISSING_FROM_GEOJSON.has(code),
    );
    if (extra.length > 0 || missing.length > 0) {
      fail(
        `GeoJSON and COUNTRIES diverge beyond the allowlists.\n` +
          `  In GeoJSON but not COUNTRIES: ${extra.join(", ") || "—"}\n` +
          `  In COUNTRIES but not GeoJSON: ${missing.join(", ") || "—"}`,
      );
    }
    const unusedAllowlist = [...ALLOWED_MISSING_FROM_GEOJSON].filter((code) =>
      geoCodes.has(code),
    );
    if (unusedAllowlist.length > 0) {
      fail(`Allowlisted-as-missing codes actually present: ${unusedAllowlist.join(", ")}`);
    }

    mkdirSync(path.dirname(GEOJSON_OUT), { recursive: true });
    writeFileSync(GEOJSON_OUT, JSON.stringify(simplified));
    const megabytes = (Buffer.byteLength(readFileSync(GEOJSON_OUT)) / 1024 / 1024).toFixed(2);
    console.log(`Wrote ${GEOJSON_OUT} (${simplified.features.length} features, ${megabytes} MB)`);
    if (Number(megabytes) > 2) {
      fail(`countries.geojson is ${megabytes} MB — above the 2 MB budget.`);
    }

    // SVG world paths — only for codes in COUNTRIES (OG images join on them).
    const coarse = JSON.parse(readFileSync(coarsePath, "utf8"));
    const paths = {};
    for (const feature of coarse.features) {
      const iso = feature.properties.iso;
      if (!countryCodes.has(iso)) continue;
      const d = geometryToPath(feature.geometry);
      if (d) paths[iso] = d;
    }
    const sortedEntries = Object.entries(paths).sort(([a], [b]) => a.localeCompare(b));
    const ts = [
      "/**",
      " * Generated by scripts/prepare-geo.mjs — do not edit by hand.",
      " *",
      " * Equirectangular-projected simplified SVG path per country,",
      ` * viewBox 0 0 ${SVG_W} ${SVG_H}. Used for OG images.`,
      " */",
      "",
      `export const WORLD_PATHS_VIEWBOX = "0 0 ${SVG_W} ${SVG_H}";`,
      "",
      "export const WORLD_PATHS: Record<string, string> = {",
      ...sortedEntries.map(([iso, d]) => `  ${iso}: ${JSON.stringify(d)},`),
      "};",
      "",
    ].join("\n");
    writeFileSync(PATHS_OUT, ts);
    const pathsKb = (Buffer.byteLength(ts) / 1024).toFixed(0);
    console.log(`Wrote ${PATHS_OUT} (${sortedEntries.length} countries, ${pathsKb} KB)`);

    console.log("\nprepare-geo: OK");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

await main();
