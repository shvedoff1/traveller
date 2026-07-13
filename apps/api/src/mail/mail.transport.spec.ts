import { type Env } from "../config/env";
import {
  DEFAULT_MAIL_FROM,
  buildTransportOptions,
  mailFrom,
} from "./mail.transport";

/** Minimal Env stub — only the fields the transport builder reads. */
function env(overrides: Partial<Env>): Env {
  return {
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    ...overrides,
  } as Env;
}

describe("buildTransportOptions", () => {
  it("Mailpit default: no auth, not secure", () => {
    expect(buildTransportOptions(env({}))).toEqual({
      host: "localhost",
      port: 1025,
      secure: false,
    });
  });

  it("Resend-style 587 STARTTLS: auth attached, not secure", () => {
    expect(
      buildTransportOptions(
        env({
          SMTP_HOST: "smtp.resend.com",
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: "resend",
          SMTP_PASS: "re_secret",
        }),
      ),
    ).toEqual({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: { user: "resend", pass: "re_secret" },
    });
  });

  it("465 implicit TLS: secure true, auth attached", () => {
    expect(
      buildTransportOptions(
        env({
          SMTP_HOST: "smtp.example.com",
          SMTP_PORT: 465,
          SMTP_SECURE: true,
          SMTP_USER: "postmaster",
          SMTP_PASS: "pw",
        }),
      ),
    ).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "postmaster", pass: "pw" },
    });
  });

  it("omits auth when only one credential is present", () => {
    expect(
      buildTransportOptions(env({ SMTP_USER: "resend" })).auth,
    ).toBeUndefined();
  });
});

describe("mailFrom", () => {
  it("uses MAIL_FROM when set", () => {
    expect(mailFrom(env({ MAIL_FROM: "Traveller <login@t.tech>" }))).toBe(
      "Traveller <login@t.tech>",
    );
  });

  it("falls back to the dev default", () => {
    expect(mailFrom(env({}))).toBe(DEFAULT_MAIL_FROM);
  });
});
