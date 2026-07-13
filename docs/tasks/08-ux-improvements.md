# Task 08 — UX improvements: hover tooltip, profile title, flat-view toggle

Read `CLAUDE.md` first. Prereqs: v1 merged (tasks 00-07). Three small, user-requested fixes.

## 1. Country name tooltip on hover

- On both the main map and the public-profile map: hovering a country shows its name in a small floating label near the cursor (offset so the cursor doesn't cover it), disappearing on leave.
- Name source: canonical `COUNTRIES` list from shared (lookup by iso); fall back to the geojson feature's `name` property for codes not in the list (e.g. XK).
- Style: match the glassmorphism design (small rounded chip, backdrop blur, theme-aware). No flicker when moving within one country; updates when crossing borders. Include the flag emoji.
- Keep it pointer-only (no touch behavior change on mobile).
- Tests: extract the lookup/format helper (`countryLabel(iso, featureName?)`) into a pure function with vitest; tooltip positioning logic (offset/clamp to viewport) as a pure helper with tests if non-trivial.

## 2. Public profile tab title shows the nick

- `app/[username]/page.tsx` `generateMetadata` currently titles the page with `displayName` (which defaults to the email local part at first login) — e.g. an email-derived name appears in the browser tab.
- Change: title uses the username (nick): `@{username} — {N} countries`. Description keeps world %. OG image alt/text likewise should lead with `@{username}` (keep displayName inside the page header UI where the user can edit it).
- Tests: update/extend the metadata/formatting helper tests.

## 3. Flat-view toggle on the public profile screen

- Add a small control on the profile map (icon button, bottom-right near existing controls, theme-aware, aria-labeled): toggles projection globe ↔ flat (mercator) via MapLibre `setProjection`.
- Default stays globe; choice persists per-tab (sessionStorage) — no server state.
- Implement as a `MapCanvas` capability (prop) so the main screen could adopt it later, but only render the control on the profile screen (that's what was asked).
- Tests: pure toggle-state/persistence helper with vitest; extend the existing mocked-maplibre MapCanvas test to assert setProjection is called.

## Acceptance criteria

- [ ] Hover any country (main + profile maps) → name chip with flag follows cursor; leaves cleanly
- [ ] `/john` tab title reads `@john — 5 countries` (seeded); OG alt leads with @john
- [ ] Profile map has globe/flat toggle; flat renders correctly; choice survives reload in the same tab
- [ ] `pnpm turbo lint typecheck test build` green; Playwright suite still passes (extend profile spec: toggle exists and flips)
- [ ] Committed on the current branch
