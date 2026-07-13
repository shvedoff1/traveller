import { USERNAME_REGEX } from "@traveller/shared";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { MapCanvas } from "../../components/map/MapCanvas";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { StatsPanel } from "../../components/stats/StatsPanel";
import {
  getPublicProfile,
  getPublicStats,
} from "../../lib/profile/api.server";
import {
  profileDescription,
  profileTitle,
  statsToWorldStats,
} from "../../lib/profile/format";
import { computeStats } from "../../lib/stats";

/** Public profile — server-rendered, revalidated every 60s. */
export const revalidate = 60;

type Params = Promise<{ username: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const username = (await params).username.toLowerCase();
  if (!USERNAME_REGEX.test(username)) return {};

  const profile = await getPublicProfile(username);
  if (!profile) return {};

  const stats = await getPublicStats(username);
  const percent =
    stats?.worldPercent ?? computeStats(profile.countryCodes).percent;
  const title = profileTitle(profile.displayName, profile.counts.countries);
  const description = profileDescription(
    profile.displayName,
    profile.counts.countries,
    percent,
  );
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const raw = (await params).username;
  const username = raw.toLowerCase();
  // Canonical casing: /John → /john, permanently (middleware 301s this
  // first; this guard covers anything that slips past it).
  if (raw !== username) permanentRedirect(`/${username}`);
  if (!USERNAME_REGEX.test(username)) notFound();

  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const stats = await getPublicStats(username);
  const worldStats = stats
    ? statsToWorldStats(stats)
    : computeStats(profile.countryCodes);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas visited={profile.countryCodes} selected={null} readonly />
      </div>
      <ProfileHeader
        username={profile.username}
        displayName={profile.displayName}
        avatarUrl={profile.avatarUrl}
        countryCount={profile.counts.countries}
      />
      <StatsPanel
        stats={worldStats}
        className="absolute bottom-4 left-4 z-20"
      />
    </main>
  );
}
