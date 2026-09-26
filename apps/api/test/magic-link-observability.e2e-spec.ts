import { Logger } from "@nestjs/common";
import request from "supertest";

import { MailService } from "../src/mail/mail.service";
import { emailFingerprint } from "../src/modules/auth/auth.service";
import { DEFAULT_RATE_LIMITS } from "../src/rate-limit/rate-limit.constants";
import {
  type TestContext,
  createTestContext,
  resetState,
} from "./utils";

function post(
  ctx: TestContext,
  email: string,
  forwardedFor?: string,
): request.Test {
  const req = request(ctx.server)
    .post("/api/auth/magic-link")
    .set("X-Requested-With", "fetch");
  if (forwardedFor) req.set("X-Forwarded-For", forwardedFor);
  return req.send({ email });
}

/** Everything the app logged at `level` since the spy was installed. */
function logged(spy: jest.SpyInstance): string {
  return spy.mock.calls.map((args: unknown[]) => String(args[0])).join("\n");
}

/**
 * Magic-link refusals must be visible in the API logs (which limit, which
 * IP) without leaking the address, and per-IP limits must key on the real
 * client IP forwarded by the reverse proxy.
 */
describe("magic-link observability (e2e)", () => {
  let ctx: TestContext;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeAll(async () => {
    ctx = await createTestContext({
      magicLinkIp: { ...DEFAULT_RATE_LIMITS.magicLinkIp, max: 2 },
    });
    // Production runs with TRUST_PROXY=true (main.ts): one trusted hop.
    ctx.app.getHttpAdapter().getInstance().set("trust proxy", 1);
  });
  beforeEach(async () => {
    await resetState(ctx);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    error = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => ctx.app.close());

  it("logs which limit refused, with the IP and an email fingerprint only", async () => {
    const email = "alice@example.com";
    await post(ctx, email, "203.0.113.7").expect(200);
    await post(ctx, email, "203.0.113.7").expect(200);
    await post(ctx, email, "203.0.113.7").expect(429);

    const out = logged(warn);
    expect(out).toContain("magic-link per-ip");
    expect(out).toContain("ip=203.0.113.7");
    expect(out).toContain(`email=${emailFingerprint(email)}`);
    expect(out).not.toContain(email);
  });

  it("logs a refusal once per window, not on every blocked request", async () => {
    for (let i = 0; i < 2; i += 1) {
      await post(ctx, `u${i}@example.com`, "203.0.113.8").expect(200);
    }
    await post(ctx, "u2@example.com", "203.0.113.8").expect(429);
    await post(ctx, "u3@example.com", "203.0.113.8").expect(429);

    expect(
      warn.mock.calls.filter((args: unknown[]) =>
        String(args[0]).includes("magic-link per-ip"),
      ),
    ).toHaveLength(1);
  });

  it("keys the per-IP limit on the forwarded client IP, not the proxy's", async () => {
    // Both requests arrive from the same socket (the proxy); only the
    // X-Forwarded-For differs. Each client gets its own budget.
    for (let i = 0; i < 2; i += 1) {
      await post(ctx, `a${i}@example.com`, "198.51.100.1").expect(200);
    }
    await post(ctx, "a2@example.com", "198.51.100.1").expect(429);
    await post(ctx, "b0@example.com", "198.51.100.2").expect(200);
  });

  it("answers 503 and logs the provider error when the send fails", async () => {
    const email = "bob@example.com";
    jest
      .spyOn(ctx.app.get(MailService), "sendMagicLink")
      .mockRejectedValueOnce(new Error("535 Authentication failed"));

    await post(ctx, email, "203.0.113.9").expect(503);

    const out = logged(error);
    expect(out).toContain("magic-link send failed");
    expect(out).toContain("535 Authentication failed");
    expect(out).toContain(`email=${emailFingerprint(email)}`);
    expect(out).not.toContain(email);
  });
});
