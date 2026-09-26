# Task 13 — Friend groups, a friendlier list, view/edit map modes, auto theme

Read `CLAUDE.md` first. Branch `claude/traveller-improvements-6uhqtg`.

Five user reports:

1. **"Make the list convenient."** The panel duplicated every visited country
   in a separate section at the top, and a row click marked the country.
2. **"Friend groups with stats."** Put a circle of friends together and show
   group statistics.
3. **"Too many accidental marks."** People tap a country to read its name and it
   gets marked.
4. **"The planet spins the wrong way."**
5. **"Light/dark by the time of day — unobtrusively."**

## 1. Country list

- All / Visited / Not yet tabs (with counts) replace the Visited section.
- Row = open (select + fly, detail card); round checkbox = mark/unmark.
- Unmarking from the list shows an Undo toast restoring year + note (toasts get
  an optional action).
- Sticky continent headings with visited/total + progress bar; fold/unfold all.
- Visit year shown next to visited countries; the open country is highlighted.

## 2. Groups

- Prisma `Group` + `GroupMember`; owner is a member. Limits: 50 members per
  group, 20 owned groups per user. Handle required to create/join.
- API: `GET /me/groups`, `POST /groups`, `GET|PATCH|DELETE /groups/:id`,
  `POST /groups/:id/invite-code`, `POST /groups/:id/members`,
  `DELETE /groups/:id/members/:username`, `GET|POST /group-invites/:code`.
  Members-only: everyone else gets 404; owner-only actions 403 for members.
- Stats (`group-stats.logic.ts`, pure): union count + world %, per-continent,
  average per member, countries everyone has been to, most popular (2+ members),
  per-member "only them" count.
- Web: `/groups` (list + create), `/groups/:id` (tiles, map with union +
  highlight of "everyone" or a focused member, leaderboard, shared/popular,
  continents, invite link, add-from-following, rename/delete/leave),
  `/join/:code` (invite landing). Header link (icons on phones).

## 3. View / Edit map modes

- View (default): a map click selects and opens the card with an explicit
  "Mark as visited". Edit: a click toggles immediately (bulk marking), with an
  accent frame. Segmented switch + `E` shortcut; persisted in localStorage.

## 4. Globe spin

- Idle spin now decreases the center longitude (west → east, like the Earth).

## 5. Auto theme

- Default `auto`: light 07:00–20:00 local, dark otherwise; pre-paint script,
  live switch timer + re-check on tab focus, soft background fade.
- Header toggle in auto mode overrides until the next switch; Settings gets
  Auto / Light / Dark for a permanent choice.

## Tests (convention #1)

- api: `groups.e2e-spec.ts` (every endpoint, permissions, limits),
  `group-stats.logic.spec.ts`.
- shared: `group.schema.test.ts`.
- web: groups screens, api-client group helpers, map mode, theme (clock,
  override, init script), country filter, toast action, page integration,
  MapCanvas pre-load highlight guard; Playwright `groups.spec.ts` + updated
  visits/profile specs.

## Acceptance criteria

- [x] List: status tabs, checkbox marking, undo, sticky progress headings
- [x] Groups: create, invite/join, add/remove/leave, rename/delete, stats page
- [x] Map opens in View mode; Edit mode toggles on click; choice remembered
- [x] Globe spins west → east
- [x] Theme follows the clock unless the user picked one
- [x] `pnpm turbo lint typecheck test build` green; Playwright green
