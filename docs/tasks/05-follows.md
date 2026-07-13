# Task 05 — Friends: follow, search, friends map overlay

Read `CLAUDE.md` first. Prereqs: task 04.

## API (apps/api)

`modules/follows/`:
- `POST /users/:username/follow` — 400 on self-follow, idempotent on duplicate (200/204), 404 unknown user.
- `DELETE /users/:username/follow` — idempotent.
- `GET /me/following` → `[{ username, displayName, avatarUrl, countryCount }]`
- `GET /me/followers` → same shape.
- `GET /me/friends-map` → `[{ username, displayName, avatarUrl, countryCodes: string[] }]` for everyone I follow (cap at first 50 by follow date).
- `GET /users/search?q=` — prefix/substring match on username + displayName, public users only, limit 10, throttled tighter (20/min). Exclude self.
- Follow/unfollow must invalidate `stats:{username}` for both parties (follower/following counts).
- Include `isFollowing` in `GET /users/:username` when the request is authenticated (OptionalAuthGuard).
- Shared: `follow.schema.ts`.

e2e: follow → shows in following + follower counts update in stats; self-follow 400; duplicate idempotent; unfollow; search finds seeded users, excludes self, respects limit; friends-map returns codes.

## Web (apps/web)

- `app/friends/page.tsx` — auth-required page: search input (debounced `/users/search`), result rows with FollowButton; "Following" and "Followers" tabs/lists (`social/FriendCard.tsx` — avatar, name, country count, link to `/username`).
- `components/social/FollowButton.tsx` — on public profiles + search results + friend cards; optimistic; hidden on self/logged-out (logged-out → login CTA).
- **Friend overlay on the main map**: from `/friends` or a friend card, "View on map" → main screen shows that friend's countries in a secondary color alongside yours (legend chip bottom-right: your color/name, their color/name, overlap color). Implement as a `compare` mode in the map store + extra fill layer. Keep it to comparing with ONE friend at a time (v1).
- Header: link to /friends when logged in.
- Tests: vitest for overlay filter builders (yours/theirs/both partition), FollowButton optimistic logic if extracted. Playwright: follow maria from her profile → she appears in /friends following list.

## Acceptance criteria

- [ ] Search → follow → friend in following list with country count
- [ ] Friend profile shows Follow/Unfollow correctly; counts update
- [ ] Compare mode: friend's countries overlay in second color with legend; overlap distinct
- [ ] Self-follow impossible (UI hides + API 400)
- [ ] All tests pass; `pnpm turbo lint typecheck test build` green; committed
