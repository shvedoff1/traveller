import { Injectable } from "@nestjs/common";
import { type VisitedCountry } from "@prisma/client";
import { type UpsertVisitInput, type Visit } from "@traveller/shared";

import { PrismaService } from "../../prisma/prisma.service";

function toVisit(row: VisitedCountry): Visit {
  return {
    countryCode: row.countryCode,
    visitedYear: row.visitedYear,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All visited countries of a user, sorted by country code. */
  async list(userId: string): Promise<Visit[]> {
    const rows = await this.prisma.visitedCountry.findMany({
      where: { userId },
      orderBy: { countryCode: "asc" },
    });
    return rows.map(toVisit);
  }

  /**
   * Idempotent PUT upsert: the payload replaces the stored year/note
   * (omitted fields clear them); `createdAt` sticks to the first mark.
   */
  async upsert(
    userId: string,
    countryCode: string,
    input: UpsertVisitInput,
  ): Promise<Visit> {
    const data = {
      visitedYear: input.visitedYear ?? null,
      note: input.note ? input.note : null,
    };
    const row = await this.prisma.visitedCountry.upsert({
      where: { userId_countryCode: { userId, countryCode } },
      create: { userId, countryCode, ...data },
      update: data,
    });
    return toVisit(row);
  }

  /** Idempotent delete — succeeds whether or not the visit exists. */
  async remove(userId: string, countryCode: string): Promise<void> {
    await this.prisma.visitedCountry.deleteMany({
      where: { userId, countryCode },
    });
  }
}
