import { describe, expect, it } from "vitest";

import {
  authProvidersSchema,
  emailSchema,
  magicLinkRequestSchema,
} from "./auth.schema";

describe("emailSchema", () => {
  it("normalises case and whitespace", () => {
    expect(emailSchema.parse("  John.Doe@Example.COM ")).toBe(
      "john.doe@example.com",
    );
  });

  it("rejects non-emails", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse("a@b").success).toBe(false);
  });

  it("rejects overlong addresses", () => {
    const local = "a".repeat(250);
    expect(emailSchema.safeParse(`${local}@example.com`).success).toBe(false);
  });
});

describe("magicLinkRequestSchema", () => {
  it("accepts a valid body", () => {
    expect(magicLinkRequestSchema.parse({ email: "a@example.com" })).toEqual({
      email: "a@example.com",
    });
  });

  it("rejects a missing email", () => {
    expect(magicLinkRequestSchema.safeParse({}).success).toBe(false);
  });

  it("preserves the honeypot field for server-side detection", () => {
    expect(
      magicLinkRequestSchema.parse({ email: "a@example.com", website: "spam" }),
    ).toEqual({ email: "a@example.com", website: "spam" });
  });
});

describe("authProvidersSchema", () => {
  it("parses provider availability", () => {
    expect(
      authProvidersSchema.parse({ google: false, magicLink: true }),
    ).toEqual({ google: false, magicLink: true });
  });

  it("rejects missing keys", () => {
    expect(authProvidersSchema.safeParse({ google: true }).success).toBe(false);
  });
});
