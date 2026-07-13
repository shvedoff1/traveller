/**
 * Pure logic for the friend compare mode: partition my visited codes and a
 * friend's into "only mine / only theirs / both" and turn that into the
 * filters for the three fill layers. Extracted so it is unit-testable
 * without WebGL (like map-style.ts).
 */

import type { FilterSpecification } from "maplibre-gl";

import { buildVisitedFilter } from "./map-style";

export interface ComparePartition {
  /** Countries only I have visited — keep the regular visited accent. */
  mineOnly: string[];
  /** Countries only the friend has visited — secondary color. */
  theirsOnly: string[];
  /** Countries we have both visited — overlap color. */
  both: string[];
}

/** Split two visited-code lists into mine-only / theirs-only / both. */
export function partitionCompare(
  mine: readonly string[],
  theirs: readonly string[],
): ComparePartition {
  const mineSet = new Set(mine);
  const theirsSet = new Set(theirs);
  return {
    mineOnly: [...mineSet].filter((code) => !theirsSet.has(code)),
    theirsOnly: [...theirsSet].filter((code) => !mineSet.has(code)),
    both: [...mineSet].filter((code) => theirsSet.has(code)),
  };
}

export interface CompareLayerFilters {
  visited: FilterSpecification;
  friend: FilterSpecification;
  overlap: FilterSpecification;
}

/**
 * Filters for the visited / friend / overlap fill layers.
 *
 * Outside compare mode (`theirs === null`) the visited layer shows all my
 * countries and the two compare layers match nothing. In compare mode each
 * country lands in exactly one layer, so the three colors never stack.
 */
export function buildCompareLayerFilters(
  mine: readonly string[],
  theirs: readonly string[] | null,
): CompareLayerFilters {
  if (theirs === null) {
    return {
      visited: buildVisitedFilter(mine),
      friend: buildVisitedFilter([]),
      overlap: buildVisitedFilter([]),
    };
  }
  const { mineOnly, theirsOnly, both } = partitionCompare(mine, theirs);
  return {
    visited: buildVisitedFilter(mineOnly),
    friend: buildVisitedFilter(theirsOnly),
    overlap: buildVisitedFilter(both),
  };
}
