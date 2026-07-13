# Task 06 — Polish & hardening

Read `CLAUDE.md` first. Prereqs: tasks 00–05 all done. No new features — quality pass.

## UI polish

- Light theme + toggle (persisted in localStorage, `prefers-color-scheme` default). Map style swaps palettes too (keep the accent). Dark stays the default.
- Mobile: country panel → floating search pill that expands to a bottom sheet; stats bar compact; touch targets ≥44px; test at 375px width.
- States: skeletons for profile/friends loading; empty states (no visits yet → "Tap a country to begin", no friends → search CTA); error toasts on failed mutations (rollback already exists); 404 page; offline-ish guard (api-client surfaces network errors gracefully).
- Landing (logged out `/`): idle globe rotation + tagline + login CTA; make sure logged-out exploration still works (hover, zoom).
- Micro-motion: 200ms ease-out transitions on panel, rows, buttons; flyTo easing; no layout shift on font load.
- A11y quick pass: focus states, aria-labels on icon buttons, panel keyboard navigable, contrast ≥4.5 for text.

## Hardening

- Rate limits final: global 100/min/IP; magic-link 3/15min/email (exists); search 20/min; visits writes 60/min.
- helmet CSP tightened for web-independent API; CORS locked to WEB_ORIGIN.
- API `Dockerfile` (multi-stage: pnpm fetch → build → `node dist/main.js`, prisma migrate deploy in entrypoint) + `.dockerignore`. Verify `docker build` succeeds.
- `README.md` — product blurb, screenshot placeholder, quickstart (compose → install → migrate → seed → dev), env table, architecture sketch, deploy notes (Vercel + container host + Neon/Upstash).
- Dependency/audit quick check (`pnpm audit --prod` — fix criticals only).

## Tests

- Keep everything green; add tests for anything extracted/refactored.
- Playwright: add mobile-viewport smoke (pill opens sheet, toggle works).
- Full manual E2E checklist from CLAUDE.md/README run once end-to-end.

## Acceptance criteria

- [ ] Theme toggle works both ways incl. map; mobile layout usable at 375px
- [ ] Empty/loading/error states present; logged-out landing has idle globe + CTA
- [ ] `docker build` of api succeeds; README quickstart is accurate (follow it literally)
- [ ] `pnpm turbo lint typecheck test build` green; committed
