"use client";

import { COUNTRIES, type Continent } from "@traveller/shared";
import { useCallback, useMemo, useState } from "react";

import { filterCountries, groupByContinent } from "../../lib/country-filter";
import { useMapStore } from "../../lib/stores/map-store";
import { useMapVisits } from "../map/useMapVisits";
import { CountryRow } from "./CountryRow";
import { CountrySearch } from "./CountrySearch";

/**
 * Floating glassmorphism panel on the right: search, the "Visited (N)"
 * section, then all countries grouped by continent (each section shows
 * its visited/total and folds away on a heading click). Rows toggle the
 * visited state, hover highlights the country on the map, click also
 * flies to it.
 *
 * Collapsible; below the `md` breakpoint it collapses to a floating
 * search pill by default (polish planned in task 06).
 */
/** Countries per continent — the denominator in a region heading. */
const CONTINENT_TOTALS: ReadonlyMap<Continent, number> = COUNTRIES.reduce(
  (totals, country) =>
    totals.set(country.continent, (totals.get(country.continent) ?? 0) + 1),
  new Map<Continent, number>(),
);

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
  const regions = useMemo(() => groupByContinent(filtered), [filtered]);
  // Visited-per-continent over the whole list (not the filtered one), so
  // a section heading reads "Europe 3/44" whatever the search says.
  const visitedByContinent = useMemo(() => {
    const counts = new Map<Continent, number>();
    for (const country of COUNTRIES) {
      if (visitedSet.has(country.code)) {
        counts.set(country.continent, (counts.get(country.continent) ?? 0) + 1);
      }
    }
    return counts;
  }, [visitedSet]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<Continent>>(
    () => new Set(),
  );
  const toggleRegion = useCallback((continent: Continent) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(continent)) next.delete(continent);
      else next.add(continent);
      return next;
    });
  }, []);
  // A search always shows its matches, even inside a folded region.
  const searching = query.trim().length > 0;

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
  const pillClass = open === null ? "flex md:hidden" : open ? "hidden" : "flex";

  return (
    <>
      {/* Collapsed state: a floating search pill. On mobile it sits above
          the bottom edge and expands into the bottom sheet below. */}
      <button
        type="button"
        data-testid="country-panel-pill"
        aria-expanded={open === true}
        onClick={() => setOpen(true)}
        className={`${pillClass} absolute z-20 min-h-11 items-center gap-2 rounded-full border border-edge bg-surface px-5 text-sm shadow-2xl backdrop-blur-xl transition-colors duration-200 ease-out hover:bg-surface-strong max-md:bottom-4 max-md:right-4 md:right-4 md:top-16`}
      >
        <span aria-hidden>🔍</span> Countries
      </button>

      {/* Open state: side panel on md+, bottom sheet on mobile. */}
      <section
        aria-label="Countries"
        data-testid="country-panel"
        className={`${panelClass} animate-rise absolute z-20 flex-col gap-3 border border-edge bg-surface p-3 shadow-2xl backdrop-blur-xl max-md:inset-x-0 max-md:bottom-0 max-md:h-[62dvh] max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 md:bottom-4 md:right-4 md:top-16 md:w-[min(20rem,calc(100vw-2rem))] md:rounded-2xl`}
      >
        <span
          aria-hidden
          className="mx-auto -mb-1 h-1 w-10 shrink-0 rounded-full bg-edge-strong md:hidden"
        />
        <div className="flex items-center gap-2">
          <CountrySearch value={query} onChange={setQuery} />
          <button
            type="button"
            aria-label="Collapse panel"
            data-testid="country-panel-collapse"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1.5 text-muted transition-colors duration-200 ease-out hover:bg-surface-strong hover:text-foreground max-md:min-h-11 max-md:min-w-11"
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
                  ? "Nothing yet — tap a country to begin."
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

          {regions.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted">No matches.</p>
          ) : (
            regions.map((region) => {
              const isOpen = searching || !collapsed.has(region.continent);
              const slug = region.continent.toLowerCase().replace(/\s+/g, "-");
              return (
                <div key={region.continent} data-testid={`region-${slug}`}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    data-testid={`region-heading-${slug}`}
                    onClick={() => toggleRegion(region.continent)}
                    className="flex w-full items-center justify-between rounded-lg px-2 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11"
                  >
                    <span>{region.continent}</span>
                    <span className="flex items-center gap-2 font-normal normal-case tracking-normal">
                      {visitedByContinent.get(region.continent) ?? 0}/
                      {CONTINENT_TOTALS.get(region.continent) ?? 0}
                      <span
                        aria-hidden
                        className={`inline-block transition-transform duration-200 ease-out ${isOpen ? "rotate-90" : ""}`}
                      >
                        ›
                      </span>
                    </span>
                  </button>
                  {isOpen
                    ? region.countries.map((country) => (
                        <CountryRow
                          key={country.code}
                          country={country}
                          visited={visitedSet.has(country.code)}
                          onClick={handleRowClick}
                          onHoverChange={setHighlighted}
                        />
                      ))
                    : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
