"use client";

/** Controlled search input for the country panel. */
export function CountrySearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search countries…"
      aria-label="Search countries"
      data-testid="country-search"
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-white/25"
    />
  );
}
