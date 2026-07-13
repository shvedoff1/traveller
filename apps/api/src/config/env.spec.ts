import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("applies dev defaults for PORT and WEB_ORIGIN", () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
  });

  it("coerces numeric strings", () => {
    const env = parseEnv({ PORT: "4100", SMTP_PORT: "1025" });
    expect(env.PORT).toBe(4100);
    expect(env.SMTP_PORT).toBe(1025);
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ GOOGLE_CLIENT_ID: "", SMTP_PORT: "", PORT: "" });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.SMTP_PORT).toBeUndefined();
    expect(env.PORT).toBe(4000);
  });

  it("fails fast on an invalid PORT", () => {
    expect(() => parseEnv({ PORT: "not-a-port" })).toThrow(/PORT/);
    expect(() => parseEnv({ PORT: "70000" })).toThrow(/PORT/);
  });

  it("fails fast on an invalid WEB_ORIGIN", () => {
    expect(() => parseEnv({ WEB_ORIGIN: "not a url" })).toThrow(/WEB_ORIGIN/);
  });

  it("keeps future vars optional at this stage", () => {
    const env = parseEnv({});
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.JWT_SECRET).toBeUndefined();
  });
});
