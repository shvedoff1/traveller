import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { isCountryCode } from "@traveller/shared";

/**
 * Validates a `:countryCode` route param against the canonical
 * ISO-3166-1 alpha-2 list from `@traveller/shared`, normalising to
 * uppercase. Unknown codes become 400.
 */
@Injectable()
export class CountryCodePipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const code = typeof value === "string" ? value.toUpperCase() : "";
    if (!isCountryCode(code)) {
      throw new BadRequestException(`Unknown country code "${String(value)}"`);
    }
    return code;
  }
}
