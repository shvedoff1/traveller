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
 *   6. Generate packages/shared/src/country-centroids.ts — [lng, lat, zoom]
 *      per country (for map flyTo), derived from the committed GeoJSON with
 *      hand-picked fallbacks for territories that have no own geometry.
 *   7. Fail loudly if the GeoJSON and COUNTRIES diverge beyond the
 *      explicit allowlists below.
 *
 * Usage: node scripts/prepare-geo.mjs
 *        node scripts/prepare-geo.mjs --centroids-only   # regenerate step 6
 *                                                        # from the committed
 *                                                        # GeoJSON, no download
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEOJSON_OUT = path.join(ROOT, "apps/web/public/geo/countries.geojson");
const PATHS_OUT = path.join(ROOT, "packages/shared/src/world-paths.ts");
const CENTROIDS_OUT = path.join(ROOT, "packages/shared/src/country-centroids.ts");
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

// --- Country centroids (for map flyTo) ---------------------------------------

/**
 * COUNTRIES codes without own geometry in the GeoJSON (see
 * ALLOWED_MISSING_FROM_GEOJSON): hand-picked [lng, lat, zoom].
 */
const FALLBACK_CENTROIDS = {
  BQ: [-68.3, 12.2, 7],
  BV: [3.4, -54.4, 6],
  CC: [96.87, -12.17, 7],
  CX: [105.68, -10.45, 7],
  GF: [-53.1, 3.9, 5.5],
  GI: [-5.35, 36.14, 7],
  GP: [-61.55, 16.25, 7],
  MQ: [-61.02, 14.64, 7],
  RE: [55.54, -21.13, 7],
  SJ: [17.0, 78.6, 4],
  TK: [-171.85, -9.2, 7],
  UM: [166.64, 19.28, 6],
  YT: [45.16, -12.83, 7],
};

/** All rings (outer + holes flattened away — outer rings only). */
function outerRings(geometry) {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons.map((rings) => rings[0]).filter(Boolean);
}

/**
 * Unwrap a ring's longitudes so consecutive points never jump more than
 * 180° — makes shoelace math work across the antimeridian (RU, FJ, US…).
 */
function unwrapRing(ring) {
  const out = [];
  let previousLon = null;
  for (const [lon, lat] of ring) {
    let unwrapped = lon;
    if (previousLon !== null) {
      while (unwrapped - previousLon > 180) unwrapped -= 360;
      while (unwrapped - previousLon < -180) unwrapped += 360;
    }
    out.push([unwrapped, lat]);
    previousLon = unwrapped;
  }
  return out;
}

/** Shoelace area + centroid of an unwrapped ring. */
function ringAreaCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-9) {
    // Degenerate speck — fall back to the vertex mean.
    const meanX = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
    const meanY = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
    return { area: 0, cx: meanX, cy: meanY, ring };
  }
  return { area: Math.abs(area), cx: cx / (6 * area), cy: cy / (6 * area), ring };
}

/** Wrap a longitude back into [-180, 180]. */
function wrapLon(lon) {
  let wrapped = lon;
  while (wrapped > 180) wrapped -= 360;
  while (wrapped < -180) wrapped += 360;
  return wrapped;
}

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Centroid + suggested flyTo zoom for a feature: the area centroid of its
 * largest outer ring, zoom derived from that ring's extent.
 */
function featureCentroid(geometry) {
  const candidates = outerRings(geometry)
    .map(unwrapRing)
    .map(ringAreaCentroid);
  if (candidates.length === 0) return null;
  const largest = candidates.reduce((a, b) => (b.area > a.area ? b : a));

  const lons = largest.ring.map(([lon]) => lon);
  const lats = largest.ring.map(([, lat]) => lat);
  const span = Math.max(
    Math.max(...lons) - Math.min(...lons),
    Math.max(...lats) - Math.min(...lats),
    0.05,
  );
  const zoom = Math.min(7, Math.max(1, Math.log2(160 / span)));
  return [round2(wrapLon(largest.cx)), round2(largest.cy), round2(zoom)];
}

/** Regenerate country-centroids.ts from the committed countries.geojson. */
function writeCentroids(countryCodes) {
  const collection = JSON.parse(readFileSync(GEOJSON_OUT, "utf8"));
  const centroids = {};
  for (const feature of collection.features) {
    const iso = feature.properties.iso;
    if (!countryCodes.has(iso)) continue;
    const centroid = featureCentroid(feature.geometry);
    if (centroid) centroids[iso] = centroid;
  }
  for (const [iso, centroid] of Object.entries(FALLBACK_CENTROIDS)) {
    if (!centroids[iso] && countryCodes.has(iso)) centroids[iso] = centroid;
  }

  const missing = [...countryCodes].filter((code) => !centroids[code]);
  if (missing.length > 0) {
    fail(`No centroid for: ${missing.join(", ")} — extend FALLBACK_CENTROIDS.`);
  }

  const sortedEntries = Object.entries(centroids).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const ts = [
    "/**",
    " * Generated by scripts/prepare-geo.mjs — do not edit by hand.",
    " *",
    " * Per-country [lng, lat, zoom] for map flyTo: the area centroid of the",
    " * country's largest polygon, zoom fitted to its extent. Territories",
    " * without own geometry in the map GeoJSON use hand-picked fallbacks.",
    " */",
    "",
    "export type CountryCentroid = readonly [lng: number, lat: number, zoom: number];",
    "",
    "export const COUNTRY_CENTROIDS: Record<string, CountryCentroid> = {",
    ...sortedEntries.map(
      ([iso, [lng, lat, zoom]]) => `  ${iso}: [${lng}, ${lat}, ${zoom}],`,
    ),
    "};",
    "",
  ].join("\n");
  writeFileSync(CENTROIDS_OUT, ts);
  console.log(
    `Wrote ${CENTROIDS_OUT} (${sortedEntries.length} countries)`,
  );
}

// --- Pipeline ---------------------------------------------------------------

async function main() {
  if (process.argv.includes("--centroids-only")) {
    writeCentroids(readCountryCodes());
    console.log("\nprepare-geo: OK (centroids only)");
    return;
  }
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

    writeCentroids(countryCodes);

    console.log("\nprepare-geo: OK");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

await main();
