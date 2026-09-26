import { describe, expect, it } from "vitest";

import { ApiError, NETWORK_ERROR_MESSAGE } from "../lib/api-client";
import {
  MAGIC_LINK_FAILED_MESSAGE,
  MAGIC_LINK_RATE_LIMITED_MESSAGE,
  describeMagicLinkError,
  describeMutationError,
} from "../lib/errors";

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

describe("describeMagicLinkError", () => {
  it("tells a rate limit apart from a failed send", () => {
    expect(describeMagicLinkError(new ApiError(429))).toBe(
      MAGIC_LINK_RATE_LIMITED_MESSAGE,
    );
    expect(describeMagicLinkError(new ApiError(503))).toBe(
      MAGIC_LINK_FAILED_MESSAGE,
    );
    expect(describeMagicLinkError(new ApiError(500))).toBe(
      MAGIC_LINK_FAILED_MESSAGE,
    );
  });

  it("maps network failures to the offline message", () => {
    expect(describeMagicLinkError(new ApiError(0, NETWORK_ERROR_MESSAGE))).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it("falls back for non-API errors", () => {
    expect(describeMagicLinkError(new Error("boom"))).toBe(
      MAGIC_LINK_FAILED_MESSAGE,
    );
  });
});
