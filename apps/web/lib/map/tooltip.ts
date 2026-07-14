/**
 * Pure helpers for the hover country tooltip — the label lookup and the
 * viewport-clamped positioning, extracted so they are unit-testable without
 * WebGL or a real DOM.
 */

import { COUNTRIES, flagEmoji } from "@traveller/shared";

export interface CountryLabel {
  /** Flag emoji for the code (empty when the code isn't a valid alpha-2). */
  flag: string;
  /** Human-readable country name. */
  name: string;
}

const NAME_BY_CODE: ReadonlyMap<string, string> = new Map(
  COUNTRIES.map((country) => [country.code, country.name]),
);

/**
 * Resolve the display label for a hovered country: canonical name from the
 * shared `COUNTRIES` list, falling back to the geojson feature's `name`
 * property for codes outside the list (e.g. Kosovo / XK). Returns null when
 * no name can be resolved. The flag is derived from the ISO code.
 */
export function countryLabel(
  iso: string,
  featureName?: string,
): CountryLabel | null {
  const name = NAME_BY_CODE.get(iso) ?? featureName;
  if (!name) return null;
  const flag = /^[A-Z]{2}$/.test(iso) ? flagEmoji(iso) : "";
  return { flag, name };
}

export interface TooltipPositionInput {
  /** Cursor x/y relative to the map container. */
  x: number;
  y: number;
  /** Measured tooltip size. */
  width: number;
  height: number;
  /** Container (clamp) size. */
  viewportWidth: number;
  viewportHeight: number;
  /** Gap between the cursor and the chip. */
  offset?: number;
}

/** Default gap so the cursor never covers the chip. */
export const TOOLTIP_OFFSET = 16;

/**
 * Place the tooltip down-right of the cursor, flipping to the opposite side
 * when it would overflow, then clamping fully inside the container so it's
 * never clipped.
 */
export function positionTooltip({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  offset = TOOLTIP_OFFSET,
}: TooltipPositionInput): { left: number; top: number } {
  let left = x + offset;
  let top = y + offset;
  // Flip to the other side of the cursor if it would spill off the edge.
  if (left + width > viewportWidth) left = x - offset - width;
  if (top + height > viewportHeight) top = y - offset - height;
  // Final clamp: keep the whole chip on screen (never negative).
  left = Math.max(0, Math.min(left, Math.max(0, viewportWidth - width)));
  top = Math.max(0, Math.min(top, Math.max(0, viewportHeight - height)));
  return { left, top };
}
