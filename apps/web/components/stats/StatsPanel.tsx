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
      className={`w-56 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl ${className}`}
    >
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-semibold tabular-nums"
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

      <ul className="mt-3 space-y-1.5">
        {stats.continents.map(({ continent, visited: done, total }) => (
          <li key={continent} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 truncate text-muted">{continent}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-[#0f9d84]"
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
