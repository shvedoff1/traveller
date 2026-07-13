import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { type ZodTypeAny, type z } from "zod";

/**
 * Validates a body/query payload against a zod schema from
 * `@traveller/shared` and returns the parsed (transformed) value.
 * Invalid payloads become 400 with per-field issues.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny>
  implements PipeTransform<unknown, z.infer<T>>
{
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
