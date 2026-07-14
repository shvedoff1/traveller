# Task 09 — Production email: SMTP auth + anti-abuse for magic links

Read `CLAUDE.md` first. Prereqs: v1 merged. Goal: the mail-sending path must be safe to expose on the public internet and work with a real SMTP provider (Resend/Brevo).

## 1. Real SMTP support

- Extend mail config (zod env): `SMTP_HOST`, `SMTP_PORT` (existing), plus `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (`true`→ TLS 465, otherwise STARTTLS when supported), `MAIL_FROM` (e.g. `Traveller <login@traveller.shvedov.tech>`). All optional in dev (Mailpit defaults keep working with no env), required-together validation: if `SMTP_USER` is set, `SMTP_PASS` must be too.
- Nodemailer transport built from these; `MAIL_FROM` used as the From header (falls back to current dev default).
- Fail fast at boot on invalid combos; do NOT log credentials.
- Tests: unit-test the transport-options builder (pure function env → nodemailer options) covering Mailpit default, Resend-style (587 STARTTLS + auth), 465 secure.

## 2. Anti-abuse on POST /auth/magic-link

Layered Redis limits (extend the existing RateLimitService; all limits configurable via env with these defaults):

| Layer | Default | On exceed |
|---|---|---|
| per-email | 3 / 15 min (exists) | 429 |
| per-IP | 5 / 15 min | 429 |
| per-email daily | 10 / 24 h | 429 |
| per-IP daily | 20 / 24 h | 429 |
| global daily (protects provider quota) | 200 / 24 h | 200-but-silently-skip send + structured warn log |

- IP resolution must respect the existing `TRUST_PROXY` setting (behind Caddy).
- **Honeypot**: the login form gains a visually-hidden input (`website` field, autocomplete off, aria-hidden, tabindex=-1). If it arrives non-empty → return the same generic 200 (never reveal detection) and skip the send + increment a metric-ish counter in Redis. Schema: the shared magic-link request schema gains the optional field so validation doesn't strip it before the check.
- Responses stay non-enumerating: same 200 body whether sent, skipped, or honeypotted; 429s are generic.
- Keep Mailpit e2e flows working (limits high enough in test config or reset between tests — follow the existing createTestContext override pattern).
- Tests (e2e): per-IP 429 on 6th, daily caps (fake by pre-seeding Redis counters), honeypot → 200 + no mail recorded, global cap → 200 + no send, legit flow still works.

## 3. Docs

- `.env.example`: new vars with comments (incl. Resend/Brevo hint: host `smtp.resend.com`, user `resend`, pass = API key).
- README: short "Production email" subsection.

## Acceptance criteria

- [ ] Dev flow unchanged (Mailpit, no new env needed); e2e suite green
- [ ] Transport builder unit tests cover the 3 provider shapes
- [ ] All five limit layers + honeypot e2e-tested; responses non-enumerating
- [ ] `pnpm turbo lint typecheck test build` green; committed on the current branch
