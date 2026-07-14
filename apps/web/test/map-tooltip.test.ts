import { flagEmoji } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import {
  countryLabel,
  positionTooltip,
  TOOLTIP_OFFSET,
} from "../lib/map/tooltip";

describe("countryLabel", () => {
  it("resolves canonical name + flag from the shared list", () => {
    expect(countryLabel("FR")).toEqual({ flag: flagEmoji("FR"), name: "France" });
    expect(countryLabel("JP")).toEqual({ flag: flagEmoji("JP"), name: "Japan" });
  });

  it("prefers the canonical name over the feature name", () => {
    expect(countryLabel("FR", "République française")).toEqual({
      flag: flagEmoji("FR"),
      name: "France",
    });
  });

  it("falls back to the feature name for codes outside the list (XK)", () => {
    expect(countryLabel("XK", "Kosovo")).toEqual({
      flag: flagEmoji("XK"),
      name: "Kosovo",
    });
  });

  it("returns null when no name can be resolved", () => {
    expect(countryLabel("XK")).toBeNull();
    expect(countryLabel("ZZ")).toBeNull();
  });
});

describe("positionTooltip", () => {
  const base = {
    width: 100,
    height: 40,
    viewportWidth: 1000,
    viewportHeight: 800,
  };

  it("offsets down-right of the cursor by default", () => {
    expect(positionTooltip({ x: 200, y: 300, ...base })).toEqual({
      left: 200 + TOOLTIP_OFFSET,
      top: 300 + TOOLTIP_OFFSET,
    });
  });

  it("flips to the left when it would overflow the right edge", () => {
    const { left } = positionTooltip({ x: 980, y: 300, ...base });
    expect(left).toBe(980 - TOOLTIP_OFFSET - base.width);
  });

  it("flips upward when it would overflow the bottom edge", () => {
    const { top } = positionTooltip({ x: 200, y: 790, ...base });
    expect(top).toBe(790 - TOOLTIP_OFFSET - base.height);
  });

  it("clamps fully on screen, never negative", () => {
    const pos = positionTooltip({ x: 2, y: 2, ...base });
    expect(pos.left).toBeGreaterThanOrEqual(0);
    expect(pos.top).toBeGreaterThanOrEqual(0);
    // Near the top-left the flip would go negative; clamp pins it to 0.
    const flipped = positionTooltip({
      x: 5,
      y: 5,
      width: 100,
      height: 40,
      viewportWidth: 90,
      viewportHeight: 30,
    });
    expect(flipped.left).toBe(0);
    expect(flipped.top).toBe(0);
  });

  it("respects a custom offset", () => {
    expect(positionTooltip({ x: 10, y: 10, ...base, offset: 4 })).toEqual({
      left: 14,
      top: 14,
    });
  });
});
