"use client";

import { useMemo, useState } from "react";

import { type WorldStats } from "../../lib/stats";
import {
  type ProfileListFilter,
  buildProfileCountryList,
} from "../../lib/profile/country-list";
import { useMe, useVisitsQuery } from "../../lib/visits/use-visits";
import { visitedCodes } from "../../lib/visits/visits-cache";
import { StatsPanel } from "../stats/StatsPanel";

const FILTER_LABELS: Record<ProfileListFilter, string> = {
  all: "All",
  shared: "Both of you",
  new: "Not yet yours",
};

/**
 * The profile's stats card, which doubles as the button that opens the
 * owner's list of countries, by continent. Logged-in visitors (on someone else's profile)
 * can narrow it to countries you share or ones you haven't been to.
 * Picking a country flies the map to it.
 */
export function ProfileCountries({
  username,
  countryCodes,
  stats,
  selected,
  onPick,
}: {
  username: string;
  stats: WorldStats;
  countryCodes: readonly string[];
  selected: string | null;
  onPick: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<ProfileListFilter>("all");

  const { data: me } = useMe();
  const comparing = Boolean(me?.username) && me?.username !== username;
  const { data: myVisits } = useVisitsQuery(comparing);
  const myCodes = useMemo(
    () => (comparing && myVisits ? visitedCodes(myVisits) : null),
    [comparing, myVisits],
  );

  const list = useMemo(
    () =>
      buildProfileCountryList(
        countryCodes,
        myCodes,
        myCodes ? filter : "all",
      ),
    [countryCodes, myCodes, filter],
  );

  return (
    <>
      {/* The stats card is the trigger: a full-card button laid over it
          (a <button> can't wrap the card's list markup itself). */}
      <div className="absolute bottom-4 left-4 z-20">
        {/* Right padding keeps the text clear of the list hint. */}
        <StatsPanel stats={stats} className="max-md:pr-9" />
        <button
          type="button"
          data-testid="profile-countries-button"
          aria-expanded={open}
          aria-label={open ? "Hide the country list" : "Show the country list"}
          onClick={() => setOpen((value) => !value)}
          className="group absolute inset-0 flex items-start justify-end rounded-2xl p-3 transition-colors duration-200 ease-out hover:bg-surface-strong/40"
        >
          <span
            aria-hidden
            className="flex items-center gap-1 text-xs text-muted transition-colors duration-200 ease-out group-hover:text-foreground"
          >
            <ListIcon />
            <span className={`transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}>
              ›
            </span>
          </span>
        </button>
      </div>

      {open ? (
        <section
          aria-label="Visited countries"
          data-testid="profile-countries"
          className="animate-rise absolute z-40 flex flex-col gap-3 border border-edge bg-surface p-3 max-md:bg-background shadow-2xl backdrop-blur-xl max-md:inset-x-0 max-md:bottom-0 max-md:h-[62dvh] max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 md:bottom-16 md:right-4 md:top-16 md:w-[min(20rem,calc(100vw-2rem))] md:rounded-2xl"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold">
              Countries{" "}
              <span className="font-normal tabular-nums text-muted">
                {list.counts.all}
              </span>
            </h2>
            <button
              type="button"
              aria-label="Close list"
              data-testid="profile-countries-close"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-muted transition-colors duration-200 ease-out hover:bg-surface-strong hover:text-foreground max-md:min-h-11 max-md:min-w-11"
            >
              ×
            </button>
          </div>

          {myCodes ? (
            <div
              role="tablist"
              aria-label="Show countries"
              className="flex gap-1 rounded-full border border-edge p-0.5"
            >
              {(Object.keys(FILTER_LABELS) as ProfileListFilter[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  data-testid={`profile-filter-${id}`}
                  onClick={() => setFilter(id)}
                  className={`min-h-7 flex-1 whitespace-nowrap rounded-full px-2 text-xs transition-colors duration-200 ease-out max-md:min-h-10 ${
                    filter === id
                      ? "bg-surface-strong font-medium text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {FILTER_LABELS[id]}{" "}
                  <span className="tabular-nums opacity-70">
                    {list.counts[id]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {list.groups.length === 0 ? (
              <p
                className="px-2 py-1 text-sm text-muted"
                data-testid="profile-countries-empty"
              >
                {list.counts.all === 0
                  ? "No countries marked yet."
                  : filter === "shared"
                    ? "No countries in common yet."
                    : "You’ve been everywhere they have."}
              </p>
            ) : (
              list.groups.map((group) => (
                <div key={group.continent} className="pb-2">
                  <h3 className="sticky top-0 z-10 flex justify-between rounded-lg bg-background px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span>{group.continent}</span>
                    <span className="font-normal tabular-nums">
                      {group.countries.length}
                    </span>
                  </h3>
                  <ul>
                    {group.countries.map((country) => (
                      <li key={country.code}>
                        <button
                          type="button"
                          data-testid={`profile-country-${country.code}`}
                          aria-current={
                            selected === country.code ? "true" : undefined
                          }
                          onClick={() => onPick(country.code)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-200 ease-out hover:bg-surface-strong max-md:min-h-11 ${
                            selected === country.code ? "bg-surface-strong" : ""
                          }`}
                        >
                          <span aria-hidden className="text-base leading-none">
                            {country.emoji}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {country.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ListIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="size-3.5"
    >
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
