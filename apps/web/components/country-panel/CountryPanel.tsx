"use client";

import { COUNTRIES, type Continent } from "@traveller/shared";
import { useCallback, useMemo, useState } from "react";

import {
  type StatusFilter,
  filterByStatus,
  filterCountries,
  groupByContinent,
} from "../../lib/country-filter";
import { useMapStore } from "../../lib/stores/map-store";
import { pushSuccessToast } from "../../lib/stores/toast-store";
import { useMapVisits } from "../map/useMapVisits";
import { CountryRow } from "./CountryRow";
import { CountrySearch } from "./CountrySearch";

/** Countries per continent — the denominator in a region heading. */
const CONTINENT_TOTALS: ReadonlyMap<Continent, number> = COUNTRIES.reduce(
  (totals, country) =>
    totals.set(country.continent, (totals.get(country.continent) ?? 0) + 1),
  new Map<Continent, number>(),
);

const FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "visited", label: "Visited" },
  { id: "unvisited", label: "Not yet" },
];

/**
 * Floating glassmorphism panel on the right: search, an All / Visited /
 * Not yet filter, then countries grouped by continent under sticky
 * headings (visited/total + a progress bar; a heading click folds the
 * section).
 *
 * Each row has two targets: the name opens the country (select + fly,
 * the detail card shows up) and the round checkbox marks/unmarks it.
 * Unmarking offers an Undo that restores the year and note.
 *
 * Collapsible; below the `md` breakpoint it collapses to a floating
 * search pill that expands into a bottom sheet.
 */
export function CountryPanel() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  // null = untouched: CSS decides (open on md+, pill on mobile).
  const [open, setOpen] = useState<boolean | null>(null);

  const { visited, visitOf, toggle, save, ready, isLoggedIn } = useMapVisits();
  const selected = useMapStore((state) => state.selected);
  const setSelected = useMapStore((state) => state.setSelected);
  const setHighlighted = useMapStore((state) => state.setHighlighted);
  const flyToCountry = useMapStore((state) => state.flyToCountry);
  const showLoginPrompt = useMapStore((state) => state.showLoginPrompt);

  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const filtered = useMemo(
    () => filterByStatus(filterCountries(COUNTRIES, query), visitedSet, status),
    [query, visitedSet, status],
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
  const allFolded =
    regions.length > 0 &&
    regions.every((region) => collapsed.has(region.continent));

  const handleOpen = useCallback(
    (iso: string) => {
      setSelected(iso);
      flyToCountry(iso);
    },
    [setSelected, flyToCountry],
  );

  const handleToggle = useCallback(
    (iso: string) => {
      if (!ready) return;
      if (!isLoggedIn) {
        showLoginPrompt();
        return;
      }
      const previous = visitOf(iso);
      toggle(iso);
      if (previous) {
        const name =
          COUNTRIES.find((country) => country.code === iso)?.name ?? iso;
        pushSuccessToast(`Removed ${name}`, {
          label: "Undo",
          onClick: () =>
            save(iso, {
              ...(previous.visitedYear
                ? { visitedYear: previous.visitedYear }
                : {}),
              ...(previous.note ? { note: previous.note } : {}),
            }),
        });
      }
    },
    [ready, isLoggedIn, showLoginPrompt, visitOf, toggle, save],
  );

  const counts: Record<StatusFilter, number> = {
    all: COUNTRIES.length,
    visited: visited.length,
    unvisited: COUNTRIES.length - visited.length,
  };

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

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Show countries"
            className="flex flex-1 gap-1 rounded-full border border-edge p-0.5"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={status === filter.id}
                data-testid={`list-filter-${filter.id}`}
                onClick={() => setStatus(filter.id)}
                className={`min-h-7 flex-1 whitespace-nowrap rounded-full px-2 text-xs transition-colors duration-200 ease-out max-md:min-h-10 ${
                  status === filter.id
                    ? "bg-surface-strong font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {filter.label}{" "}
                <span className="tabular-nums opacity-70">
                  {counts[filter.id]}
                </span>
              </button>
            ))}
          </div>
          {!searching && regions.length > 1 ? (
            <button
              type="button"
              data-testid="fold-all"
              title={allFolded ? "Expand all" : "Collapse all"}
              aria-label={allFolded ? "Expand all" : "Collapse all"}
              onClick={() =>
                setCollapsed(
                  allFolded
                    ? new Set()
                    : new Set(regions.map((region) => region.continent)),
                )
              }
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-200 ease-out hover:bg-surface-strong hover:text-foreground max-md:size-10"
            >
              <span aria-hidden className="text-xs">
                {allFolded ? "▾" : "▴"}
              </span>
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {regions.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted" data-testid="list-empty">
              {emptyMessage(status, searching, visited.length)}
            </p>
          ) : (
            regions.map((region) => {
              const isOpen = searching || !collapsed.has(region.continent);
              const slug = region.continent.toLowerCase().replace(/\s+/g, "-");
              const done = visitedByContinent.get(region.continent) ?? 0;
              const total = CONTINENT_TOTALS.get(region.continent) ?? 0;
              return (
                <div
                  key={region.continent}
                  data-testid={`region-${slug}`}
                  className="pb-2"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    data-testid={`region-heading-${slug}`}
                    onClick={() => toggleRegion(region.continent)}
                    className="sticky top-0 z-10 flex w-full flex-col gap-1 rounded-lg bg-background/80 px-2 py-1.5 text-left backdrop-blur transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11"
                  >
                    <span className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                      <span>{region.continent}</span>
                      <span className="flex items-center gap-2 font-normal normal-case tracking-normal tabular-nums">
                        {done}/{total}
                        <span
                          aria-hidden
                          className={`inline-block transition-transform duration-200 ease-out ${isOpen ? "rotate-90" : ""}`}
                        >
                          ›
                        </span>
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="block h-0.5 w-full overflow-hidden rounded-full bg-edge"
                    >
                      <span
                        className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                        style={{
                          width: `${total ? (done / total) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  </button>
                  {isOpen
                    ? region.countries.map((country) => (
                        <CountryRow
                          key={country.code}
                          country={country}
                          visited={visitedSet.has(country.code)}
                          visitedYear={visitOf(country.code)?.visitedYear}
                          selected={selected === country.code}
                          onOpen={handleOpen}
                          onToggle={handleToggle}
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

function emptyMessage(
  status: StatusFilter,
  searching: boolean,
  visitedCount: number,
): string {
  if (searching) return "No matches.";
  if (status === "visited" && visitedCount === 0) {
    return "Nothing yet — tick a country to begin.";
  }
  if (status === "unvisited") return "You’ve been everywhere. Wow.";
  return "No matches.";
}
