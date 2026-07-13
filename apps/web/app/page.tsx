import { COUNTRIES } from "@traveller/shared";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <h1 className="text-5xl font-semibold tracking-tight">Traveller</h1>
      <p className="text-sm text-muted">
        Mark the countries you&apos;ve visited &mdash; {COUNTRIES.length}{" "}
        countries and counting.
      </p>
    </main>
  );
}
