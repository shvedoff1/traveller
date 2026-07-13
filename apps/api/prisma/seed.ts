/**
 * Demo seed: four users with distinct visited-country sets and a small
 * follow graph. Idempotent — upserts by email, rebuilds visits/follows.
 *
 * Run with: pnpm --filter api exec prisma db seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  countries: { code: string; year?: number; note?: string }[];
}

const USERS: SeedUser[] = [
  {
    username: "john",
    displayName: "John Carter",
    email: "john@example.com",
    countries: [
      { code: "US" },
      { code: "CA", year: 2019 },
      { code: "MX", year: 2021, note: "Oaxaca road trip" },
      { code: "FR", year: 2023 },
      { code: "IT" },
    ],
  },
  {
    username: "maria",
    displayName: "Maria Silva",
    email: "maria@example.com",
    countries: [
      { code: "BR" },
      { code: "AR", year: 2018 },
      { code: "CL" },
      { code: "PT", year: 2022, note: "Lisbon → Porto" },
      { code: "ES" },
      { code: "US" },
    ],
  },
  {
    username: "kenji",
    displayName: "Kenji Watanabe",
    email: "kenji@example.com",
    countries: [
      { code: "JP" },
      { code: "KR", year: 2017 },
      { code: "TH" },
      { code: "VN", year: 2024 },
    ],
  },
  {
    username: "amara",
    displayName: "Amara Okafor",
    email: "amara@example.com",
    countries: [
      { code: "NG" },
      { code: "GH", year: 2020 },
      { code: "KE" },
      { code: "ZA", year: 2023, note: "Cape Town" },
      { code: "EG" },
      { code: "GB" },
      { code: "FR" },
    ],
  },
];

/** follower → followees */
const FOLLOWS: Record<string, string[]> = {
  john: ["maria", "kenji"],
  maria: ["john", "amara"],
  kenji: ["john", "maria", "amara"],
  amara: ["maria"],
};

async function main(): Promise<void> {
  const idsByUsername = new Map<string, string>();

  for (const seed of USERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { username: seed.username, displayName: seed.displayName },
      create: {
        username: seed.username,
        displayName: seed.displayName,
        email: seed.email,
      },
    });
    idsByUsername.set(seed.username, user.id);

    await prisma.visitedCountry.deleteMany({ where: { userId: user.id } });
    await prisma.visitedCountry.createMany({
      data: seed.countries.map((c) => ({
        userId: user.id,
        countryCode: c.code,
        visitedYear: c.year ?? null,
        note: c.note ?? null,
      })),
    });
  }

  await prisma.follow.deleteMany({
    where: { followerId: { in: [...idsByUsername.values()] } },
  });
  for (const [follower, followees] of Object.entries(FOLLOWS)) {
    for (const followee of followees) {
      await prisma.follow.create({
        data: {
          followerId: idsByUsername.get(follower)!,
          followeeId: idsByUsername.get(followee)!,
        },
      });
    }
  }

  console.log(
    `Seeded ${USERS.length} users, ${USERS.reduce((n, u) => n + u.countries.length, 0)} visits, ` +
      `${Object.values(FOLLOWS).flat().length} follows.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
