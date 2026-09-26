# Task 14 — Day/night shading on the globe

User ask: "what about the Earth's lighting relative to the time, and the rotation?"

- `apps/web/lib/map/daylight.ts` (pure): subsolar point from the current time
  (declination + equation of time, low-precision solar formulas), the night
  hemisphere as a lng/lat polygon closed around the dark pole, and 13 copies
  shifted ±9° in longitude, stacked at low opacity, for a smooth twilight edge.
- `map-style.ts`: a `daylight` GeoJSON source (empty in the style, so it stays
  time-free) and a `night` fill layer over the country fills, under the
  borders/selection. Per-theme tint and depth.
- `MapCanvas`: sets the data on load, every minute, and after a theme swap.
  The globe keeps its idle west → east spin; the night stays put relative to
  the Sun, like the real thing.

Tests: subsolar point at solstices/equinox and hourly drift; the polygon
matches "Sun below the horizon" on a lat/lng grid; dark pole by season;
finite at the equinox; layer order and source; MapCanvas refresh cadence.
