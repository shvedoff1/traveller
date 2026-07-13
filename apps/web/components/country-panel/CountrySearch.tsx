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
      className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm transition-colors duration-200 ease-out placeholder:text-muted focus:border-edge-strong focus:outline-none max-md:min-h-11"
    />
  );
}
