import { describe, expect, it } from "vitest";

import { ApiError, NETWORK_ERROR_MESSAGE } from "../lib/api-client";
import { describeMutationError } from "../lib/errors";

describe("describeMutationError", () => {
  it("maps network failures to the offline message", () => {
    const error = new ApiError(0, NETWORK_ERROR_MESSAGE);
    expect(error.isNetworkError).toBe(true);
    expect(describeMutationError(error, "fallback")).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it("maps 429 to rate-limit copy and 401 to session copy", () => {
    expect(describeMutationError(new ApiError(429), "fallback")).toMatch(
      /slow down/i,
    );
    expect(describeMutationError(new ApiError(401), "fallback")).toMatch(
      /session expired/i,
    );
  });

  it("uses the fallback for everything else", () => {
    expect(describeMutationError(new ApiError(500), "fallback")).toBe(
      "fallback",
    );
    expect(describeMutationError(new Error("boom"), "fallback")).toBe(
      "fallback",
    );
  });
});
