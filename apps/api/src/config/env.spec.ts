import { parseEnv } from "./env";

/** Minimal valid env — the vars that have no defaults. */
const REQUIRED = {
  DATABASE_URL: "postgresql://traveller:traveller@localhost:5432/traveller",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "unit-test-secret",
};

describe("parseEnv", () => {
  it("applies dev defaults for PORT, API_URL, WEB_ORIGIN and SMTP", () => {
    const env = parseEnv(REQUIRED);
    expect(env.PORT).toBe(4000);
    expect(env.API_URL).toBe("http://localhost:4000/api");
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.SMTP_HOST).toBe("localhost");
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.NODE_ENV).toBe("development");
  });

  it("coerces numeric strings", () => {
    const env = parseEnv({ ...REQUIRED, PORT: "4100", SMTP_PORT: "2525" });
    expect(env.PORT).toBe(4100);
    expect(env.SMTP_PORT).toBe(2525);
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({
      ...REQUIRED,
      GOOGLE_CLIENT_ID: "",
      COOKIE_DOMAIN: "",
      PORT: "",
    });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
    expect(env.PORT).toBe(4000);
  });

  it("fails fast when required vars are missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({})).toThrow(/REDIS_URL/);
    expect(() => parseEnv({})).toThrow(/JWT_SECRET/);
  });

  it("fails fast on an invalid PORT", () => {
    expect(() => parseEnv({ ...REQUIRED, PORT: "not-a-port" })).toThrow(/PORT/);
    expect(() => parseEnv({ ...REQUIRED, PORT: "70000" })).toThrow(/PORT/);
  });

  it("fails fast on an invalid WEB_ORIGIN", () => {
    expect(() => parseEnv({ ...REQUIRED, WEB_ORIGIN: "not a url" })).toThrow(
      /WEB_ORIGIN/,
    );
  });

  it("keeps Google OAuth optional", () => {
    const env = parseEnv(REQUIRED);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it("keeps SMTP auth optional (Mailpit dev default)", () => {
    const env = parseEnv(REQUIRED);
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.SMTP_PASS).toBeUndefined();
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.MAIL_FROM).toBeUndefined();
  });

  it("parses a full SMTP config (Resend-style)", () => {
    const env = parseEnv({
      ...REQUIRED,
      SMTP_HOST: "smtp.resend.com",
      SMTP_PORT: "587",
      SMTP_USER: "resend",
      SMTP_PASS: "re_key",
      SMTP_SECURE: "false",
      MAIL_FROM: "Traveller <login@traveller.tech>",
    });
    expect(env.SMTP_USER).toBe("resend");
    expect(env.SMTP_PASS).toBe("re_key");
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.MAIL_FROM).toBe("Traveller <login@traveller.tech>");
  });

  it("requires SMTP_USER and SMTP_PASS together", () => {
    expect(() => parseEnv({ ...REQUIRED, SMTP_USER: "resend" })).toThrow(
      /SMTP_PASS/,
    );
    expect(() => parseEnv({ ...REQUIRED, SMTP_PASS: "secret" })).toThrow(
      /SMTP_USER/,
    );
  });

  it("applies defaults for the magic-link anti-abuse caps", () => {
    const env = parseEnv(REQUIRED);
    expect(env.MAGIC_LINK_IP_MAX).toBe(5);
    expect(env.MAGIC_LINK_EMAIL_DAILY_MAX).toBe(10);
    expect(env.MAGIC_LINK_IP_DAILY_MAX).toBe(20);
    expect(env.MAGIC_LINK_GLOBAL_DAILY_MAX).toBe(200);
  });

  it("parses TRUST_PROXY as a boolean, defaulting to false", () => {
    expect(parseEnv(REQUIRED).TRUST_PROXY).toBe(false);
    expect(parseEnv({ ...REQUIRED, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(
      true,
    );
    expect(parseEnv({ ...REQUIRED, TRUST_PROXY: "false" }).TRUST_PROXY).toBe(
      false,
    );
    expect(() => parseEnv({ ...REQUIRED, TRUST_PROXY: "yes" })).toThrow(
      /TRUST_PROXY/,
    );
  });
});
