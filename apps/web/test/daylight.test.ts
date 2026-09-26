import { describe, expect, it } from "vitest";

import {
  TWILIGHT_SHIFTS,
  buildDaylightData,
  isNight,
  nightPolygon,
  subsolarPoint,
} from "../lib/map/daylight";

/** Is (lng, lat) inside a simple ring? Ray casting in lng/lat space. */
function inside(ring: [number, number][], lng: number, lat: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

describe("subsolarPoint", () => {
  it("sits on the Tropic of Cancer at the June solstice, near Greenwich at noon UTC", () => {
    const sun = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0)));
    expect(sun.lat).toBeCloseTo(23.44, 0);
    expect(Math.abs(sun.lng)).toBeLessThan(1); // equation of time ≈ −1.5 min
  });

  it("sits on the Tropic of Capricorn at the December solstice", () => {
    const sun = subsolarPoint(new Date(Date.UTC(2026, 11, 21, 12, 0)));
    expect(sun.lat).toBeCloseTo(-23.44, 0);
  });

  it("crosses the equator at the March equinox", () => {
    const sun = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 14, 46)));
    expect(Math.abs(sun.lat)).toBeLessThan(0.1);
  });

  it("moves west 15° an hour as the Earth turns east", () => {
    const noon = subsolarPoint(new Date(Date.UTC(2026, 8, 26, 12, 0)));
    const later = subsolarPoint(new Date(Date.UTC(2026, 8, 26, 13, 0)));
    expect(noon.lng - later.lng).toBeCloseTo(15, 0);
    // Late September sundials run ~9 min fast: solar noon at Greenwich is
    // ~11:51 UTC, so at 12:00 UTC the Sun is already ~2° west.
    expect(noon.lng).toBeLessThan(-1.5);
    expect(noon.lng).toBeGreaterThan(-3);
  });
});

describe("nightPolygon", () => {
  it("covers exactly the places where the Sun is down", () => {
    for (const date of [
      new Date(Date.UTC(2026, 5, 21, 6, 30)),
      new Date(Date.UTC(2026, 8, 26, 12, 0)),
      new Date(Date.UTC(2026, 11, 21, 20, 15)),
    ]) {
      const sun = subsolarPoint(date);
      const ring = nightPolygon(sun).coordinates[0]!;
      for (let lat = -80; lat <= 80; lat += 10) {
        for (let lng = -175; lng <= 175; lng += 10) {
          // Skip points right on the terminator (sampling tolerance).
          const nearEdge =
            isNight(sun, lat, lng + 3) !== isNight(sun, lat, lng - 3) ||
            isNight(sun, lat + 3, lng) !== isNight(sun, lat - 3, lng);
          if (nearEdge) continue;
          expect(inside(ring, lng, lat)).toBe(isNight(sun, lat, lng));
        }
      }
    }
  });

  it("puts the dark pole on the winter side", () => {
    const june = nightPolygon({ lat: 23, lng: 0 }).coordinates[0]!;
    expect(june.at(-2)).toEqual([-180, -90]);
    const december = nightPolygon({ lat: -23, lng: 0 }).coordinates[0]!;
    expect(december.at(-2)).toEqual([-180, 90]);
  });

  it("stays finite at the equinox and is a closed ring", () => {
    const ring = nightPolygon({ lat: 0, lng: 10 }).coordinates[0]!;
    for (const [lng, lat] of ring) {
      expect(Number.isFinite(lng) && Number.isFinite(lat)).toBe(true);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    }
    expect(ring[0]).toEqual(ring.at(-1));
  });

  it("shifts east for a positive shift", () => {
    const sun = { lat: 10, lng: 0 };
    const base = nightPolygon(sun).coordinates[0]!;
    const east = nightPolygon(sun, 6).coordinates[0]!;
    // The shifted terminator is the same curve moved 6° east.
    const latAt = (ring: [number, number][], lng: number) =>
      ring.find(([x]) => x === lng)![1];
    for (const lng of [-120, -60, 0, 60, 90, 120]) {
      expect(latAt(east, lng + 6)).toBeCloseTo(latAt(base, lng), 6);
    }
  });
});

describe("buildDaylightData", () => {
  it("stacks one polygon per twilight shift", () => {
    const data = buildDaylightData(new Date(Date.UTC(2026, 8, 26, 12, 0)));
    expect(data.type).toBe("FeatureCollection");
    expect(data.features.map((f) => f.properties.shift)).toEqual([
      ...TWILIGHT_SHIFTS,
    ]);
  });
});
