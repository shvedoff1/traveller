import { type WorldStats } from "../../lib/stats";

/**
 * Presentational stats card: big visited count, world percentage and
 * per-continent mini progress bars. Server-safe — used both by the
 * floating StatsBar (own map) and public profile pages.
 */
export function StatsPanel({
  stats,
  className = "",
}: {
  stats: WorldStats;
  className?: string;
}) {
  return (
    <section
      aria-label="Travel stats"
      data-testid="stats-bar"
      className={`rounded-2xl border border-edge bg-surface shadow-2xl backdrop-blur-xl max-md:p-3 md:w-56 md:p-4 ${className}`}
    >
      <div className="flex items-baseline gap-2">
        <span
          className="font-semibold tabular-nums max-md:text-xl md:text-3xl"
          data-testid="stats-count"
        >
          {stats.visited}
        </span>
        <span className="text-sm text-muted">
          {stats.visited === 1 ? "country" : "countries"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted" data-testid="stats-percent">
        {stats.percent}% of the world
      </p>

      {/* Continent breakdown — hidden on mobile to keep the bar compact. */}
      <ul className="mt-3 space-y-1.5 max-md:hidden">
        {stats.continents.map(({ continent, visited: done, total }) => (
          <li key={continent} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 truncate text-muted">{continent}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-strong">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
              />
            </span>
            <span className="w-10 text-right tabular-nums text-muted">
              {done}/{total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
