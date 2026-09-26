"use client";

import { type Country } from "@traveller/shared";
import { memo } from "react";

export interface CountryRowProps {
  country: Country;
  visited: boolean;
  /** Year of the visit, shown muted next to the name. */
  visitedYear?: number | null;
  /** The country whose card is open. */
  selected?: boolean;
  /** Row body: select + fly to the country (never changes visited). */
  onOpen: (iso: string) => void;
  /** The round checkbox: toggle visited. */
  onToggle: (iso: string) => void;
  /** Mirrors hover onto the map's highlight feature-state. */
  onHoverChange: (iso: string | null) => void;
}

/**
 * One country in the panel list: flag + name (+ year) opens the country,
 * the checkbox on the right marks/unmarks it. Two separate targets, so
 * browsing the list never marks anything by accident.
 */
export const CountryRow = memo(function CountryRow({
  country,
  visited,
  visitedYear = null,
  selected = false,
  onOpen,
  onToggle,
  onHoverChange,
}: CountryRowProps) {
  return (
    <div
      data-testid={`country-item-${country.code}`}
      onMouseEnter={() => onHoverChange(country.code)}
      onMouseLeave={() => onHoverChange(null)}
      className={`group flex items-center rounded-lg transition-colors duration-200 ease-out hover:bg-surface-strong ${
        selected ? "bg-surface-strong" : ""
      }`}
    >
      <button
        type="button"
        data-testid={`country-row-${country.code}`}
        aria-current={selected ? "true" : undefined}
        onClick={() => onOpen(country.code)}
        onFocus={() => onHoverChange(country.code)}
        onBlur={() => onHoverChange(null)}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-left text-sm max-md:min-h-11"
      >
        <span aria-hidden className="text-base leading-none">
          {country.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate">{country.name}</span>
        {visitedYear ? (
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {visitedYear}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={visited}
        aria-label={
          visited
            ? `Unmark ${country.name} as visited`
            : `Mark ${country.name} as visited`
        }
        data-testid={`country-toggle-${country.code}`}
        onClick={() => onToggle(country.code)}
        className="flex shrink-0 items-center justify-center self-stretch px-2 max-md:min-w-11"
      >
        <span
          aria-hidden
          className={
            visited
              ? "flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent"
              : "size-5 rounded-full border border-edge-strong transition-colors duration-200 ease-out group-hover:border-muted"
          }
        >
          {visited ? "✓" : null}
        </span>
      </button>
    </div>
  );
});
