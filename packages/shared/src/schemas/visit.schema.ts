import { z } from "zod";

import { COUNTRY_CODES } from "../countries";

export const VISIT_MIN_YEAR = 1900;
export const VISIT_NOTE_MAX_LENGTH = 280;

/** An ISO-3166-1 alpha-2 code from the canonical COUNTRIES list. */
export const countryCodeSchema = z
  .string()
  .refine((code) => COUNTRY_CODES.has(code), {
    message: "Unknown country code",
  });

/**
 * Year of a visit: 1900 up to the current year. The upper bound is
 * evaluated at parse time so long-running processes stay correct.
 */
export const visitYearSchema = z
  .number()
  .int()
  .refine(
    (year) => year >= VISIT_MIN_YEAR && year <= new Date().getFullYear(),
    { message: `Year must be between ${VISIT_MIN_YEAR} and the current year` },
  );

/**
 * PUT /me/visits/:countryCode request body. PUT semantics: the payload
 * replaces the stored year/note — omitted fields clear them.
 */
export const upsertVisitSchema = z
  .object({
    visitedYear: visitYearSchema.optional(),
    note: z.string().trim().max(VISIT_NOTE_MAX_LENGTH).optional(),
  })
  .strict();
export type UpsertVisitInput = z.infer<typeof upsertVisitSchema>;

/** One visited country as returned by the API. */
export const visitSchema = z.object({
  countryCode: countryCodeSchema,
  visitedYear: z.number().int().nullable(),
  note: z.string().nullable(),
  /** ISO datetime of when the country was first marked. */
  createdAt: z.string().datetime(),
});
export type Visit = z.infer<typeof visitSchema>;

/** GET /me/visits response — sorted by countryCode. */
export const visitListSchema = z.array(visitSchema);
