"use client";

import {
  COUNTRIES,
  VISIT_MIN_YEAR,
  type Country,
  type Visit,
} from "@traveller/shared";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { useMapStore } from "../../lib/stores/map-store";
import { useMapVisits } from "../map/useMapVisits";

/**
 * Floating detail card for the selected country: mark/unmark plus a year
 * picker and note input that save through the same PUT upsert.
 */
export function CountryDetailSheet() {
  const selected = useMapStore((state) => state.selected);
  const setSelected = useMapStore((state) => state.setSelected);
  const { ready, isLoggedIn, visitOf, save, unmark } = useMapVisits();

  const country = useMemo(
    () => COUNTRIES.find((candidate) => candidate.code === selected),
    [selected],
  );
  if (!country || !ready) return null;

  const visit = visitOf(country.code);
  return (
    <SheetContent
      // Remount on country/visit-state change so the form re-seeds.
      key={`${country.code}:${visit ? "visited" : "unvisited"}`}
      country={country}
      visit={visit}
      isLoggedIn={isLoggedIn}
      onSave={save}
      onUnmark={unmark}
      onClose={() => setSelected(null)}
    />
  );
}

function SheetContent({
  country,
  visit,
  isLoggedIn,
  onSave,
  onUnmark,
  onClose,
}: {
  country: Country;
  visit: Visit | undefined;
  isLoggedIn: boolean;
  onSave: (iso: string, input: { visitedYear?: number; note?: string }) => void;
  onUnmark: (iso: string) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(visit?.visitedYear?.toString() ?? "");
  const [note, setNote] = useState(visit?.note ?? "");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - VISIT_MIN_YEAR + 1 }, (_, index) =>
      String(current - index),
    );
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(country.code, {
      ...(year ? { visitedYear: Number(year) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <aside
      data-testid="country-detail-sheet"
      className="absolute bottom-4 left-1/2 z-30 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            <span aria-hidden className="mr-2">
              {country.emoji}
            </span>
            {country.name}
          </h2>
          <p className="text-xs text-muted">
            {country.continent}
            {visit ? " · visited" : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-muted hover:bg-white/10 hover:text-foreground"
        >
          ×
        </button>
      </div>

      {!isLoggedIn ? (
        <p className="mt-3 text-sm text-muted">
          <Link href="/login" className="underline underline-offset-4">
            Log in
          </Link>{" "}
          to mark it as visited.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="flex gap-2">
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              aria-label="Year visited"
              data-testid="visit-year"
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none [&>option]:bg-background"
            >
              <option value="">Year</option>
              {years.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={280}
              placeholder="Add a note…"
              aria-label="Note"
              data-testid="visit-note"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none placeholder:text-muted"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="submit"
              data-testid="visit-save"
              className="rounded-lg bg-[#0f9d84] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16bda0]"
            >
              {visit ? "Save" : "Mark as visited"}
            </button>
            {visit ? (
              <button
                type="button"
                data-testid="visit-unmark"
                onClick={() => onUnmark(country.code)}
                className="text-sm text-muted underline-offset-4 hover:underline"
              >
                Remove from visited
              </button>
            ) : null}
          </div>
        </form>
      )}
    </aside>
  );
}
