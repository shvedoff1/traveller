"use client";

import { COUNTRIES } from "@traveller/shared";
import { useCallback, useMemo, useState } from "react";

import { filterCountries } from "../../lib/country-filter";
import { useMapStore } from "../../lib/stores/map-store";
import { useMapVisits } from "../map/useMapVisits";
import { CountryRow } from "./CountryRow";
import { CountrySearch } from "./CountrySearch";

/**
 * Floating glassmorphism panel on the right: search, the "Visited (N)"
 * section, then all countries. Rows toggle the visited state, hover
 * highlights the country on the map, click also flies to it.
 *
 * Collapsible; below the `md` breakpoint it collapses to a floating
 * search pill by default (polish planned in task 06).
 */
export function CountryPanel() {
  const [query, setQuery] = useState("");
  // null = untouched: CSS decides (open on md+, pill on mobile).
  const [open, setOpen] = useState<boolean | null>(null);

  const { visited, toggle, ready, isLoggedIn } = useMapVisits();
  const setSelected = useMapStore((state) => state.setSelected);
  const setHighlighted = useMapStore((state) => state.setHighlighted);
  const flyToCountry = useMapStore((state) => state.flyToCountry);
  const showLoginPrompt = useMapStore((state) => state.showLoginPrompt);

  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const filtered = useMemo(() => filterCountries(COUNTRIES, query), [query]);
  const visitedCountries = useMemo(
    () => filtered.filter((country) => visitedSet.has(country.code)),
    [filtered, visitedSet],
  );

  // Row click: select + fly, and mark unvisited countries. Visited rows
  // open the detail sheet instead of destructively clearing year/note —
  // unmark lives in the sheet (or a map click, which toggles both ways).
  const handleRowClick = useCallback(
    (iso: string) => {
      setSelected(iso);
      flyToCountry(iso);
      if (!ready) return;
      if (!isLoggedIn) {
        showLoginPrompt();
        return;
      }
      if (!visitedSet.has(iso)) toggle(iso);
    },
    [
      setSelected,
      flyToCountry,
      ready,
      isLoggedIn,
      visitedSet,
      toggle,
      showLoginPrompt,
    ],
  );

  const panelClass =
    open === null ? "hidden md:flex" : open ? "flex" : "hidden";
  const pillClass = open === null ? "md:hidden" : open ? "hidden" : "";

  return (
    <>
      <button
        type="button"
        data-testid="country-panel-pill"
        onClick={() => setOpen(true)}
        className={`${pillClass} absolute right-4 top-16 z-20 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm shadow-2xl backdrop-blur-xl hover:bg-white/10`}
      >
        <span aria-hidden>🔍</span> Countries
      </button>

      <section
        aria-label="Countries"
        data-testid="country-panel"
        className={`${panelClass} absolute bottom-4 right-4 top-16 z-20 w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-2xl backdrop-blur-xl`}
      >
        <div className="flex items-center gap-2">
          <CountrySearch value={query} onChange={setQuery} />
          <button
            type="button"
            aria-label="Collapse panel"
            data-testid="country-panel-collapse"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1.5 text-muted hover:bg-white/10 hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div>
            <h2
              className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted"
              data-testid="visited-heading"
            >
              Visited ({visited.length})
            </h2>
            {visitedCountries.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted">
                {visited.length === 0
                  ? "Nothing yet — click a country to mark it."
                  : "No visited countries match."}
              </p>
            ) : (
              visitedCountries.map((country) => (
                <CountryRow
                  key={country.code}
                  country={country}
                  visited
                  testIdPrefix="visited-row"
                  onClick={handleRowClick}
                  onHoverChange={setHighlighted}
                />
              ))
            )}
          </div>

          <div>
            <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              All countries
            </h2>
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted">No matches.</p>
            ) : (
              filtered.map((country) => (
                <CountryRow
                  key={country.code}
                  country={country}
                  visited={visitedSet.has(country.code)}
                  onClick={handleRowClick}
                  onHoverChange={setHighlighted}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
