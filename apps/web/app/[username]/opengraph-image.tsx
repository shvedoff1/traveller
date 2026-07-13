import { USERNAME_REGEX, WORLD_PATHS } from "@traveller/shared";
import { ImageResponse } from "next/og";

import { getPublicProfile } from "../../lib/profile/api.server";
import { ogSubtitle } from "../../lib/profile/format";
import { computeStats } from "../../lib/stats";

/** Social unfurl card: mini world map with the visited countries lit up. */
export const revalidate = 60;
export const alt = "Traveller — visited countries world map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = {
  background: "#05070d",
  visited: "#0f9d84",
  unvisited: "#242b3a",
  title: "#f8fafc",
  subtitle: "#94a3b8",
};

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const username = (await params).username.toLowerCase();
  const profile = USERNAME_REGEX.test(username)
    ? await getPublicProfile(username)
    : null;

  const visited = new Set(profile?.countryCodes ?? []);
  const stats = computeStats(profile?.countryCodes ?? []);
  const title = profile?.displayName ?? "Traveller";
  const subtitle = profile
    ? ogSubtitle(stats.visited, stats.percent)
    : "Mark the countries you have visited";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: COLORS.background,
        }}
      >
        {/* Equirectangular mini world map, visited countries in accent. */}
        <svg
          width={1200}
          height={600}
          viewBox="0 0 1000 500"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {Object.entries(WORLD_PATHS).map(([code, d]) => (
            <path
              key={code}
              d={d}
              fill={visited.has(code) ? COLORS.visited : COLORS.unvisited}
            />
          ))}
        </svg>

        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 52,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: COLORS.title,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 34, color: COLORS.subtitle, marginTop: 6 }}>
            {subtitle}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
