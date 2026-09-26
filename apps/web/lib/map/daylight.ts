/**
 * Day/night shading for the globe — pure and unit-testable.
 *
 * From a moment in time we find the subsolar point (where the Sun is
 * straight overhead) with the usual low-precision solar formulas (good to
 * a fraction of a degree), then build the night side as a polygon: for
 * every meridian the terminator latitude, closed around the pole that is
 * in darkness. A few copies of that polygon shifted a little east/west,
 * drawn at low opacity on top of each other, give a soft twilight edge
 * instead of a hard line.
 */

/** Minimal GeoJSON shapes (what MapLibre's `setData` accepts). */
export interface Polygon {
  type: "Polygon";
  coordinates: [number, number][][];
}
interface Feature<G> {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: G;
}
export interface FeatureCollection<G> {
  type: "FeatureCollection";
  features: Feature<G>[];
}

const RAD = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
/** Julian date of the Unix epoch, and of J2000.0. */
const JD_UNIX_EPOCH = 2_440_587.5;
const JD_J2000 = 2_451_545.0;

/** Terminator sampling step along longitude, degrees. */
const LNG_STEP = 2;
/**
 * Longitude shifts (degrees) of the stacked night polygons — the twilight.
 * Many small steps, so the gradient reads as smooth rather than stripy.
 */
export const TWILIGHT_SHIFTS: readonly number[] = Array.from(
  { length: 13 },
  (_, i) => -9 + i * 1.5,
);
/** How often the shading is recomputed while a map is open. */
export const DAYLIGHT_REFRESH_MS = 60_000;

export interface SubsolarPoint {
  lat: number;
  lng: number;
}

/** Normalize an angle in degrees to [-180, 180). */
function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Where the Sun is directly overhead at `date` (degrees). */
export function subsolarPoint(date: Date): SubsolarPoint {
  const days = date.getTime() / MS_PER_DAY + JD_UNIX_EPOCH - JD_J2000;
  const meanAnomaly = (357.529 + 0.98560028 * days) * RAD;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const eclipticLongitude =
    (meanLongitude +
      1.915 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly)) *
    RAD;
  const obliquity = (23.439 - 0.00000036 * days) * RAD;

  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  );
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  // Equation of time: apparent minus mean solar time, in degrees.
  const equationOfTime = wrap180(meanLongitude - rightAscension / RAD);

  const utcHours = (((date.getTime() / 3_600_000) % 24) + 24) % 24;
  return {
    lat: declination / RAD,
    lng: wrap180(-15 * (utcHours - 12) - equationOfTime),
  };
}

/**
 * The night hemisphere for a subsolar point as a lng/lat polygon: the
 * terminator from -180° to 180°, closed around the dark pole. `shift`
 * moves it east (+) or west (−) in degrees.
 */
export function nightPolygon(sun: SubsolarPoint, shift = 0): Polygon {
  // At the equinox tan(δ) → 0; nudge it so the maths stays finite.
  const declination =
    Math.abs(sun.lat) < 0.01 ? (sun.lat < 0 ? -0.01 : 0.01) : sun.lat;
  const tanDec = Math.tan(declination * RAD);
  const darkPole = declination > 0 ? -90 : 90;

  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += LNG_STEP) {
    const hourAngle = (lng - sun.lng - shift) * RAD;
    const lat = Math.atan(-Math.cos(hourAngle) / tanDec) / RAD;
    ring.push([lng, lat]);
  }
  ring.push([180, darkPole], [-180, darkPole], ring[0]!);
  return { type: "Polygon", coordinates: [ring] };
}

/** The stacked night polygons for `date`, ready for a GeoJSON source. */
export function buildDaylightData(date: Date): FeatureCollection<Polygon> {
  const sun = subsolarPoint(date);
  return {
    type: "FeatureCollection",
    features: TWILIGHT_SHIFTS.map(
      (shift): Feature<Polygon> => ({
        type: "Feature",
        properties: { shift },
        geometry: nightPolygon(sun, shift),
      }),
    ),
  };
}

/** An empty collection — the style's placeholder until the map loads. */
export const EMPTY_DAYLIGHT: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Is the point on the night side? (Sun below the horizon, ignoring
 * refraction.) Used by tests to cross-check the polygon.
 */
export function isNight(sun: SubsolarPoint, lat: number, lng: number): boolean {
  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(sun.lat * RAD) +
    Math.cos(lat * RAD) *
      Math.cos(sun.lat * RAD) *
      Math.cos((lng - sun.lng) * RAD);
  return cosZenith < 0;
}
