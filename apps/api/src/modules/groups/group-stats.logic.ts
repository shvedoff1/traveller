/** Pure group stats math for GET /groups/:id — unit-tested. */

import {
  COUNTRY_CODES,
  GROUP_POPULAR_LIMIT,
  type GroupMember,
  type GroupStats,
} from "@traveller/shared";

import { computeCountryStats } from "../stats/stats.logic";

export interface MemberInput {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOwner: boolean;
  /** Raw visited codes (duplicates/unknown codes tolerated). */
  countryCodes: readonly string[];
}

/**
 * Aggregate every member's map into group stats and per-member shares:
 * the union ("countries together"), the intersection ("everyone's been"),
 * countries visited by 2+ members (most members first, then by code) and
 * each member's count of countries nobody else in the group has.
 * Members come back sorted most-travelled first (ties: username).
 */
export function computeGroupStats(members: readonly MemberInput[]): {
  stats: GroupStats;
  members: GroupMember[];
} {
  const perMember = members.map((member) => ({
    member,
    codes: [...new Set(member.countryCodes)]
      .filter((code) => COUNTRY_CODES.has(code))
      .sort(),
  }));

  // How many members visited each code.
  const visitors = new Map<string, number>();
  for (const { codes } of perMember) {
    for (const code of codes) visitors.set(code, (visitors.get(code) ?? 0) + 1);
  }

  const union = [...visitors.keys()].sort();
  const sharedCodes =
    members.length >= 2
      ? union.filter((code) => visitors.get(code) === members.length)
      : [];
  const popular = [...visitors.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([codeA, countA], [codeB, countB]) =>
      countB !== countA ? countB - countA : codeA.localeCompare(codeB),
    )
    .slice(0, GROUP_POPULAR_LIMIT)
    .map(([code, count]) => ({ code, count }));

  const totalVisits = perMember.reduce((sum, { codes }) => sum + codes.length, 0);
  const { countryCount, worldPercent, continents } = computeCountryStats(union);

  const shaped: GroupMember[] = perMember
    .map(({ member, codes }) => ({
      username: member.username,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      isOwner: member.isOwner,
      countryCount: codes.length,
      uniqueCount: codes.filter((code) => visitors.get(code) === 1).length,
      countryCodes: codes,
    }))
    .sort((a, b) =>
      b.countryCount !== a.countryCount
        ? b.countryCount - a.countryCount
        : a.username.localeCompare(b.username),
    );

  return {
    stats: {
      countryCount,
      worldPercent,
      averageCount:
        members.length === 0
          ? 0
          : Math.round((totalVisits / members.length) * 10) / 10,
      continents,
      countryCodes: union,
      sharedCodes,
      popular,
    },
    members: shaped,
  };
}
