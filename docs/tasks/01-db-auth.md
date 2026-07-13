# Task 01 — Database schema + authentication

Read `CLAUDE.md` first. Prereq: task 00 (scaffold) is done. Postgres/Redis/Mailpit run via `docker compose up -d`.

## Database (Prisma in apps/api)

Add Prisma; `prisma/schema.prisma` with `citext` extension enabled and models:

- `User` — `id` uuid pk default, `username` citext unique nullable (claimed on first login; regex `^[a-z0-9_]{3,30}$` enforced in zod), `displayName`, `email` citext unique, `avatarUrl?`, `isPublic` bool default true, timestamps.
- `OauthAccount` — id, userId FK cascade, `provider`, `providerAccountId`, unique(provider, providerAccountId), index(userId).
- `LoginToken` — id, `email` citext, `tokenHash` unique, `expiresAt`, `consumedAt?`, index(email, createdAt).
- `RefreshToken` — id, userId FK cascade, `tokenHash` unique, `familyId` uuid, `expiresAt`, `revokedAt?`, `userAgent?`, index(userId), index(familyId).
- `VisitedCountry` — `userId` FK cascade + `countryCode` `@db.Char(2)` composite pk, `visitedYear?` smallint, `note?` varchar(280), createdAt, index(countryCode). (Model now; endpoints in task 03.)
- `Follow` — `followerId` + `followeeId` composite pk, both FK cascade, createdAt, index(followeeId). (Model now; endpoints in task 05.)

Create the initial migration. Seed (`prisma/seed.ts`): users `john`, `maria`, `kenji`, `amara` with distinct visited-country sets (use real ISO codes) and a follow graph among them.

## API modules (apps/api/src)

- `prisma/` — PrismaModule + PrismaService (global).
- `redis/` — RedisModule providing ioredis client (global).
- `common/` — `ZodValidationPipe` (validates body/query with zod schemas from `@traveller/shared`), `@CurrentUser()` decorator, `JwtAuthGuard`, `OptionalAuthGuard`, custom-header CSRF guard for mutations (reject state-changing requests without `X-Requested-With: fetch`).
- `modules/auth/`:
  - `POST /auth/magic-link` `{ email }` → always 200; create 32-byte token, store sha256, send email via SMTP (Mailpit in dev) with link `API_URL/auth/magic-link/verify?token=...`. Throttle 3/15min per email (Redis).
  - `GET /auth/magic-link/verify?token` → single-use, 15-min TTL; upsert user by email; set cookies; 302 to `WEB_ORIGIN/welcome` if username is null else `WEB_ORIGIN/`.
  - `GET /auth/google` + `GET /auth/google/callback` — passport google strategy, `state` in signed short-lived cookie. **Register the strategy/routes only when `GOOGLE_CLIENT_ID` is set** (dev/CI have none). Upsert user + OauthAccount by provider id, fallback-link by verified email.
  - `POST /auth/refresh` — rotate refresh token within its `familyId`; reuse of an already-rotated token revokes the whole family. New access JWT.
  - `POST /auth/logout` — revoke family, clear cookies.
  - `GET /auth/me` → current user or 401.
  - `token.service.ts` — JWT (15 min, secret `JWT_SECRET`, payload `{ sub, username }`) + refresh issue/rotate/revoke. Cookies: `access_token` (httpOnly, SameSite=Lax, Path=/), `refresh_token` (httpOnly, SameSite=Lax, Path=/auth/refresh), `Secure` in prod, `Domain=COOKIE_DOMAIN` when set.
- `modules/users/` — `PATCH /me` `{ username?, displayName? }` (username claim: zod regex, 409 on taken), `GET /users/:username` returning public profile `{ username, displayName, avatarUrl, countryCodes[], counts }` (no cache yet — task 04 adds it).

Shared package: `auth.schema.ts`, `user.schema.ts` (zod) + inferred types, used by both API and web.

## Web (apps/web)

- `lib/api-client.ts` — fetch wrapper: `credentials: 'include'`, sets `X-Requested-With: fetch` on mutations, on 401 calls `/auth/refresh` once then retries; typed helpers using shared schemas. Unit-test the refresh-retry logic (vitest, mocked fetch).
- `app/login/page.tsx` — minimalist card: Google button (hidden if API reports google unavailable — add `GET /auth/providers`), email input → magic-link form → "check your inbox" state.
- `app/welcome/page.tsx` — username claim form (live validation against shared regex; submit PATCH /me; redirect to `/`).
- Header/user chip in layout: shows avatar/name via `['me']` query when logged in, Login link otherwise; logout action.

## Tests (Jest + supertest e2e, real PG/Redis from compose; separate test DB or truncate between suites)

- magic link: happy path (request → extract token from mail via Mailpit API or intercept mail service → verify → cookies set → /auth/me works), expired token 401/410, reused token rejected, throttle 429 on 4th request.
- refresh: rotation works; reusing a rotated token revokes family (subsequent refresh with newest token also fails).
- logout clears session.
- PATCH /me: claims username; duplicate → 409; invalid format → 400.
- CSRF guard: mutation without header → 403.

## Acceptance criteria

- [ ] Full login loop works locally via Mailpit: request link → click → cookies → `/auth/me` → claim username on /welcome → logout
- [ ] Google strategy is skipped cleanly without env creds (API boots, /auth/providers reports google:false)
- [ ] All e2e tests above pass; `pnpm turbo lint typecheck test build` green
- [ ] Migration + seed run cleanly on a fresh DB
- [ ] Committed on the current branch
