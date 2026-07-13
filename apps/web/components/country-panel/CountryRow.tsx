"use client";

import { type Country } from "@traveller/shared";
import { memo } from "react";

export interface CountryRowProps {
  country: Country;
  visited: boolean;
  /** Keeps testids unique when a country appears in several sections. */
  testIdPrefix?: string;
  /** Toggle + select + flyTo — the whole row is the button. */
  onClick: (iso: string) => void;
  /** Mirrors hover onto the map's highlight feature-state. */
  onHoverChange: (iso: string | null) => void;
}

/** One country in the panel list: flag, name, check state. */
export const CountryRow = memo(function CountryRow({
  country,
  visited,
  testIdPrefix = "country-row",
  onClick,
  onHoverChange,
}: CountryRowProps) {
  return (
    <button
      type="button"
      aria-pressed={visited}
      data-testid={`${testIdPrefix}-${country.code}`}
      onClick={() => onClick(country.code)}
      onMouseEnter={() => onHoverChange(country.code)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(country.code)}
      onBlur={() => onHoverChange(null)}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10"
    >
      <span aria-hidden className="text-base leading-none">
        {country.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate">{country.name}</span>
      <span
        aria-hidden
        className={
          visited
            ? "flex size-4 items-center justify-center rounded-full bg-[#0f9d84] text-[10px] font-bold text-white"
            : "size-4 rounded-full border border-white/20 group-hover:border-white/40"
        }
      >
        {visited ? "✓" : null}
      </span>
    </button>
  );
});
