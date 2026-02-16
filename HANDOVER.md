# Steam Backlog Planner - Implementation Handover

## Session Summary
Phase 6 (continued): IGDB integration for richer game metadata (genres, ratings, descriptions, cover art) plus three deferred code review fixes (CR-028 token refresh race, CR-029 OAuth rate limiting, CR-033 transient failure tracking). Also fixed pre-existing broken HLTB integration test mock. All 473 unit tests pass (53 files), 55 integration tests pass (7 files), coverage 94.46%/89.71%/88.63%/95.22%.

## URGENT: Rotate All Credentials
All `.env.local` secrets were exposed in a conversation. Rotate these BEFORE deploying anywhere:
- [ ] Neon DB password (Neon console)
- [ ] Upstash Redis token (Upstash console)
- [ ] AUTH_SECRET (`openssl rand -base64 32`)
- [ ] Steam API key (https://steamcommunity.com/dev/apikey)

## Next Session TODO
1. Run `npm run db:push` to apply Discord + Google Calendar + IGDB schema changes to Neon
2. Consider adding HLTB endpoint discovery (scrape JS bundles for search URL) as a fallback
3. Phase 7 planning: what's next? (mobile polish, PWA, export features, etc.)

## Completed — Phase 6 (Continued): IGDB Integration + CR Fixes

### Code Review Fixes
- **CR-029** (fixed): Per-user rate limiting (5 req/300s) on Google OAuth connect + callback endpoints
- **CR-028** (fixed): Redis distributed lock (`NX`, 30s TTL) around token refresh to prevent race conditions
- **CR-033** (fixed): `tryRefreshAccessToken()` discriminated union — permanent failures (400/401) disable immediately, transient (500/network) tracked in Redis counter, disable after 3+ consecutive failures

### IGDB Integration
```
Game Detail Page → /api/igdb/[appId] → igdb.ts → igdb-client.ts → IGDB API
                                         ↑ cachedFetch + DB persist   ↑ Twitch OAuth
```

#### New Files
| File | Purpose |
|------|---------|
| `src/lib/services/igdb-client.ts` | Twitch OAuth, Apicalypse query wrapper, Steam→IGDB lookup, game details |
| `src/lib/services/igdb.ts` | cachedFetch orchestrator, DB persistence, cover URL formatting |
| `src/app/api/igdb/[appId]/route.ts` | Auth-gated GET, DB lookup, 30-day staleness, lazy fetch |

#### Modified Files
| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | +6 columns on gameCache (igdbId, genres, igdbRating, summary, coverUrl, releaseDate) |
| `src/lib/hooks/use-game-detail.ts` | +useIGDBData hook |
| `src/app/(dashboard)/library/[appId]/page.tsx` | Genre badges, About card, IGDB Rating in sidebar |
| `tests/integration/setup.ts` | Updated PGlite DDL with IGDB columns |
| `tests/integration/flows/error-boundaries.test.ts` | Added IGDB route to completeness check |

### Bug Fix
- Fixed pre-existing broken integration test: `game-enrichment.test.ts` was mocking removed `howlongtobeat` package instead of current `hltb-client`. Updated mock to use correct field names (`comp_main`/`comp_plus`/`comp_100` in seconds).

### Code Review Findings
- **CR-035 LOW** (informational): HLTB and IGDB share `cachedAt` column — fetching one resets the other's staleness timer. Both use 30-day windows so impact is minimal. Would need separate columns if windows diverge.

### Environment Variables (2 new)
```
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
```

### Test Results
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 53 | 473 | All pass |
| Integration tests | 7 | 55 | All pass |
| Coverage | — | — | 94.46% stmts, 89.71% branches, 88.63% funcs, 95.22% lines |

## Completed — Phase 6 (Continued): Google Calendar Push-Only Integration

### Architecture
```
Settings Page → /api/google/connect → Google OAuth → /api/google/callback → DB
                                                         ↑ stores tokens + calendarId
Session APIs → gcal-sync.ts → google-calendar.ts → Google Calendar API
               (DB lookup + gate + token refresh)   (raw fetch, no SDK)
```

### New Files
| File | Purpose |
|------|---------|
| `src/lib/services/google-calendar.ts` | Raw Google Calendar API client (exchangeCodeForTokens, refreshAccessToken, getUserEmail, createCalendar, event CRUD, revokeToken) |
| `src/lib/services/gcal-sync.ts` | Sync orchestrator: reads config from DB, auto-refreshes tokens, gates on enabled, delegates to API client |
| `src/app/api/google/connect/route.ts` | GET → redirect to Google OAuth consent screen with CSRF state token |
| `src/app/api/google/callback/route.ts` | GET → exchange code, create calendar, store tokens, redirect to settings |
| `src/app/api/google/disconnect/route.ts` | POST → revoke tokens, clear DB fields, clear event IDs |
| `src/lib/hooks/use-google-calendar.ts` | `useDisconnectGoogleCalendar()` mutation hook |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | +6 columns on userPreferences, +1 on scheduledSessions |
| `src/app/api/sessions/route.ts` | Fire-and-forget `syncSessionCreated()` |
| `src/app/api/sessions/[sessionId]/route.ts` | Fire-and-forget `syncSessionUpdated()` + `syncSessionDeleted()` |
| `src/app/api/sessions/auto-generate/route.ts` | Fire-and-forget `syncAutoGenerate()` |
| `src/app/api/preferences/route.ts` | Return Google fields in GET; validate `googleCalendarSyncEnabled` in PATCH |
| `src/lib/hooks/use-preferences.ts` | Added Google fields to Preferences interface |
| `src/app/(dashboard)/settings/page.tsx` | Google Calendar card (connect/disconnect/toggle) |

### Security Hardening
- **CSRF protection**: Random state token stored in Redis (10min TTL), validated in callback, deleted immediately after validation (CR-025)
- **Env var validation**: Explicit null checks on GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI in callback (CR-026)
- **Token revocation**: Best-effort revoke on disconnect, fail gracefully if already revoked
- **Event ID cleanup**: Clear orphaned event IDs on disconnect to prevent duplicates on reconnect (CR-034)
- **Auto-disable**: Sync automatically disabled when refresh token is permanently invalid
- **Fire-and-forget safety**: All sync calls wrapped in `.catch()` — never block session operations

### Also Fixed This Session
- **CR-023 (MEDIUM)**: Added per-user Redis rate limit (3/hour) to Discord test endpoint
- **CR-024 (LOW)**: Added `isValidDiscordWebhookUrl()` re-validation in `getDiscordConfig()`

### Code Review Findings
- **CR-025 HIGH** (fixed): OAuth state deleted too late — moved to immediately after validation
- **CR-026 HIGH** (fixed): Env vars used with `!` assertion — added explicit null checks
- **CR-027 HIGH** (accepted risk): Tokens stored in plain text — same pattern as Discord, DB behind TLS + auth
- **CR-028 MEDIUM** (deferred): Token refresh race condition — acceptable for fire-and-forget
- **CR-029 MEDIUM** (deferred): No rate limiting on OAuth endpoints
- **CR-033 MEDIUM** (deferred): Sync permanently disabled on any refresh failure
- **CR-034 MEDIUM** (fixed): Event IDs not cleared on disconnect

### Environment Variables (3 new)
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

### Test Results
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 50 | 426 | All pass |
| Coverage | — | — | 93.82% stmts, 88.85% branches, 87.86% funcs, 94.65% lines |

## Completed — Phase 6 (Partial): Discord Webhook Notifications

### Architecture
```
Settings Page → Preferences API → userPreferences (DB)
                                      ↑ read config
Session APIs → discord-notify.ts → discord.ts → Discord Webhook
               (DB lookup + gate)   (embed + HTTP)
```

### New Files
| File | Purpose |
|------|---------|
| `src/lib/services/discord.ts` | URL validation, embed builders, webhook POST with 5s timeout |
| `src/lib/services/discord-notify.ts` | Orchestrator: reads user prefs, gates on enabled + URL, delegates to discord.ts |
| `src/app/api/discord/test/route.ts` | POST endpoint: sends test embed, returns success/502 |
| `src/lib/hooks/use-discord.ts` | `useTestDiscordWebhook()` mutation hook |
| `src/components/ui/switch.tsx` | shadcn Switch component |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Added `discordWebhookUrl` (text, nullable) and `discordNotificationsEnabled` (boolean, default false) |
| `src/app/api/preferences/route.ts` | Discord fields in GET/PATCH, auto-disable on URL clear |
| `src/app/api/sessions/route.ts` | Fire-and-forget notification on session create |
| `src/app/api/sessions/auto-generate/route.ts` | Fire-and-forget notification on auto-generate |
| `src/app/api/sessions/[sessionId]/route.ts` | Fire-and-forget notification on session completion |
| `src/lib/hooks/use-preferences.ts` | Added Discord fields to Preferences interface |
| `src/app/(dashboard)/settings/page.tsx` | Discord Notifications card with URL input, enable switch, test button |

### Security Hardening
- **SSRF defense**: URL validated with strict regex (`/\d+/[A-Za-z0-9_-]+$`) AND `new URL()` hostname check
- **Fetch timeout**: 5s `AbortSignal.timeout` prevents hanging requests
- **Content truncation**: Embed descriptions capped at 256 chars, field values at 1024 chars
- **Auto-disable**: Clearing webhook URL automatically sets `discordNotificationsEnabled = false`
- **Fire-and-forget safety**: All notification calls wrapped in `.catch()` with contextual logging — can never block session operations

### Code Review Findings
- **CR-023 (MEDIUM, deferred)**: Test endpoint lacks rate limiting — could be abused to spam a Discord channel. Add per-user Redis rate limit (e.g., 3 tests/hour). Low priority since it requires auth.
- **CR-024 (LOW, deferred)**: Stored webhook URLs not re-validated before use in fire-and-forget notifications (only validated on insert and in test endpoint). Defense-in-depth improvement.

### Test Results
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 44 | 352 | All pass |
| Coverage | — | — | 93.25% stmts, 87.18% branches, 89.77% funcs, 94.36% lines |

## Completed — Phase 5 Polish (Navigation + Dashboard + Error States)

### Adaptive Navigation ✅
- **Desktop (md+)**: Full horizontal nav bar with lucide-react icons, sticky top
- **Mobile (<md)**: Slim top bar (SBP logo + avatar dropdown) + fixed bottom tab bar with icons + labels
- **Active state**: `isActive()` uses `startsWith()` for nested routes (e.g. `/library/440` highlights Library)
- **Layout**: `pb-20 md:pb-6` on main content to account for bottom nav height
- **Icons**: LayoutDashboard, Gamepad2, Calendar, BarChart3, Settings from lucide-react

### Dashboard Page ✅
- **Stats row**: 4 cards — Total Games, Backlog, Playing, Completed (2×2 on mobile, 4 cols on lg)
- **Playtime + Achievements**: Side-by-side cards with Clock/Trophy icons, shows `--` when data unavailable
- **Upcoming sessions**: Next 5 sessions from API with game name, date, time range, timezone-aware; "View all" link when >5
- **Empty states**: "Sync your Steam games" CTA when library empty, "Schedule some gaming time" when no sessions
- **Error states**: Red error cards with AlertCircle icon and "Try again" button calling refetch()
- **Quick actions**: View Library / View Schedule / View Statistics buttons with icons
- **Performance**: Stats memoized with `useMemo`, session query key stabilized with `useState`

### Error/Empty State Improvements ✅
- **game-grid.tsx**: Error state now has retry button (was plain text)
- **Dashboard**: Full loading/error/empty coverage for games, sessions, and achievements

### Code Review
- **MEDIUM fixed**: StatCard displayed `0` when data unavailable — changed to `--`
- **LOW fixed**: Nav active state used strict equality — now uses `startsWith()` for nested routes
- **LOW fixed**: Stats computation not memoized — wrapped in `useMemo`
- No new HIGH issues found

### Bug Fix
- Removed `src/app/page.tsx` (default Next.js template) that was shadowing `(dashboard)/page.tsx` at `/`

### E2E Tests Added
- **`dashboard.spec.ts`** (10 tests): Welcome header, stat cards, playtime, achievements, empty sessions, quick actions, upcoming sessions after auto-generate, empty library CTA with navigation
- **`nav-responsive.spec.ts`** (7 tests): Desktop nav links visible/functional, mobile bottom nav hidden on desktop, mobile bottom nav visible/functional at 375×812, desktop nav hidden on mobile, content not hidden behind bottom nav

### Test Results
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 40 | 315 | ✅ All pass |
| E2E tests | 6 | 35 | ✅ All pass |
| Coverage | — | — | ✅ 92.7% stmts, 86.9% branches, 88.9% funcs, 93.8% lines |

## Future — Phase 6: External Integrations (Complete)

### Features
- [x] Google Calendar push-only integration
- [x] Discord webhook notifications
- [x] IGDB integration for additional metadata

## Completed — HLTB Package Replacement

### Problem
- `howlongtobeat@1.8.0` returned 404 — HLTB changed API from `/api/search` to `/api/finder`
- `howlongtobeat-core@1.1.1` — auth endpoint `/api/search/init` returns 404
- `howlongtobeat-js@1.0.2` — JS bundle scraping fails to extract API key (null)

### Solution ✅
- **`src/lib/services/hltb-client.ts`** (NEW): Custom lightweight HLTB client
  - Auth token from `GET /api/finder/init?t={timestamp}` (5min cache)
  - Search via `POST /api/finder` with `x-auth-token` header
  - Response fields: `comp_main`, `comp_plus`, `comp_100` in seconds
- **`src/lib/services/hltb.ts`**: Updated to use custom client, seconds→minutes conversion
- Removed `howlongtobeat` from `package.json` (zero npm dependencies for HLTB)
- Re-enabled 2 skipped live tests

### Test Results
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 39 | 298 | ✅ All pass |
| Integration tests | 7 | 50 | ✅ All pass |
| Live tests | 8 | 42 (0 skip) | ✅ All pass |
| Coverage | — | — | ✅ 92.74% stmts, 86.80% branches |

## Completed — Live Test First Run & Fixes

### Bug Fixes ✅
- **ESM import hoisting**: `dotenv.config()` in `setup.ts` was called after `config.ts` validation due to ESM import hoisting. Moved `dotenv.config({ path: ".env.local" })` into `config.ts` itself so env vars load before validation runs.
- **Vitest 4 parallel forks**: `singleFork: true` (Vitest 3 API) was ignored in Vitest 4. Replaced with `fileParallelism: false` to run test files sequentially. This fixed all FK violation errors where one fork's `afterAll` deleted the test user while other forks were still running.
- **Library sync batch inserts**: Replaced per-game individual INSERT queries (2N queries for N games) with batch INSERT using `sql\`excluded."col"\`` references (2 queries total). Library sync dropped from >60s to ~8s for a 200+ game library.
- **HLTB upstream broken**: `howlongtobeat@1.8.0` returns 404 (HLTB changed API). Skipped 2 tests that require successful HLTB lookup. The other 2 HLTB tests handle null gracefully and pass.

### Final Live Test Results
| File | Tests | Status | Notes |
|------|-------|--------|-------|
| steam-api.test.ts | 7/7 | ✅ Pass | |
| redis-cache.test.ts | 8/8 | ✅ Pass | |
| neon-crud.test.ts | 8/8 | ✅ Pass | |
| scheduling.test.ts | 6/6 | ✅ Pass | |
| hltb.test.ts | 2/2+2skip | ✅ Pass | 2 skipped (upstream broken) |
| library-sync.test.ts | 4/4 | ✅ Pass | batch inserts fixed timeouts |
| game-enrichment.test.ts | 4/4 | ✅ Pass | |
| full-workflow.test.ts | 1/1 | ✅ Pass | dropped from >120s to ~13s |

### Test Suite Totals
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 39 | 298 | ✅ All pass |
| Integration tests | 7 | 50 | ✅ All pass |
| Live tests | 8 | 42 | ✅ All pass |
| Coverage | — | — | ✅ 92.74% stmts, 86.80% branches |

## Completed — Live Integration Test Suite

### Infrastructure ✅
- **`vitest.live.config.ts`**: Separate Vitest config — node environment, forks pool, singleFork, 60s test timeout, 120s hook timeout
- **`tests/live/config.ts`**: Env validation — requires `LIVE_TESTS=true` plus `STEAM_API_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `LIVE_TEST_STEAM_ID`
- **`tests/live/setup.ts`**: dotenv load, auth-only mock, test user insert/cleanup in `beforeAll`/`afterAll`
- **`tests/live/helpers.ts`**: Constants, auth wrappers, request builders, cleanup functions, seed helpers
- **`npm run test:live`**: New script gated behind `cross-env LIVE_TESTS=true`

### Service Tests ✅ (~20 tests)
- **`steam-api.test.ts`** (8): Player summary, invalid ID, owned games, achievements (discovered), invalid game, schema
- **`redis-cache.test.ts`** (8): Round-trip, invalidate, cachedFetch miss/hit, null sentinel, TTL, non-existent key, overwrite
- **`hltb.test.ts`** (4): Known game data, non-existent game, Redis caching, DB row update

### DB Tests ✅ (~8 tests)
- **`neon-crud.test.ts`** (8): User CRUD, gameCache with nullables, FK relationships, upsert, preferences, sessions, achievements, cascade delete

### Flow Tests ✅ (~18 tests)
- **`library-sync.test.ts`** (4): Sync + DB verification, upsert idempotency, auth check
- **`game-enrichment.test.ts`** (4): Achievements via route handler, DB persistence, HLTB fetch, invalid appId
- **`scheduling.test.ts`** (7): Auto-generate, session listing, iCal export, clearExisting, rate limiting, auth check
- **`full-workflow.test.ts`** (1): End-to-end: sync → backlog → enrich → schedule → list → export → stats

### Cleanup Strategy
- User-scoped DB rows: DELETE WHERE userId = 'live-test-user' (sessions, achievements, userGames, prefs)
- gameCache: Left in place (shared metadata) or cleaned by test-specific arrays
- Redis keys: Tracked per test, cleaned in afterEach
- Test user: Created in beforeAll, deleted in afterAll

## Completed — Phase 4 Hardening

### Code Review ✅
- **CR-021 MEDIUM** (fixed): Library sync reset `cachedAt` on every visit, defeating HLTB staleness check (CR-013). Removed `cachedAt` from library sync's `onConflictDoUpdate`.
- **CR-022 LOW** (fixed): `totalPlayed` in completion predictions derived from clamped remaining time, underreporting when users overplayed HLTB estimates. Now uses `playedMinutes` directly.

### Integration Tests ✅
- **`tests/integration/flows/statistics.test.ts`** (5 tests): Empty state, multi-game aggregation, zero-division, cross-user isolation, fallback game name
- **`tests/integration/flows/error-boundaries.test.ts`**: Added `GET /api/statistics` 401 check + completeness meta-tests (2 tests verifying all endpoints covered, no stale entries)
- **`tests/integration/helpers.ts`**: Added `seedAchievements` helper
- Total: 50 integration tests across 7 files (up from 42 across 6 files)

## Completed — Phase 4: Statistics Dashboard

### Code Review Fixes ✅
- **CR-013**: HLTB staleness check — re-fetches if cachedAt >30 days or null
- **CR-017**: Rate limiting auto-generate — 3 req/60s per user via Redis INCR/EXPIRE, fail-open on Redis errors
- **CR-020**: Library sync error logging — console.error with user ID and error object

### Statistics Feature ✅
- **`src/app/api/statistics/route.ts`**: GET endpoint returning per-game and overall achievement percentages
- **`src/lib/hooks/use-statistics.ts`**: `computeLibraryStats()` (pure), `useLibraryStats()`, `useAchievementStats()`
- **4 chart components** in `src/components/statistics/`:
  - `status-chart.tsx` — Recharts PieChart (donut) showing library status breakdown
  - `playtime-chart.tsx` — Recharts BarChart (horizontal) for top 10 games by playtime
  - `completion-predictions.tsx` — Summary cards + per-game Progress bars with HLTB time remaining
  - `achievement-overview.tsx` — Overall achievement % + per-game achievement progress
- **`src/app/(dashboard)/statistics/page.tsx`**: 2-column responsive grid with loading skeletons
- **Nav**: Added "Statistics" link between Schedule and Settings

### Test Results
| Metric | Phase 3 | Phase 4 | Threshold |
|--------|---------|---------|-----------|
| Test files | 32 | 38 | — |
| Tests | 259 | 293 | — |
| Statements | 95.26% | 92.46% | 80% |
| Branches | 88.07% | 86.58% | 80% |
| Functions | 88.28% | 88.74% | 80% |
| Lines | 96.77% | 93.64% | 80% |

### Key Context
- **Neon HTTP limitation**: `@neondatabase/serverless`'s `neon()` driver does NOT support `db.transaction()`. All DB writes use sequential operations. Auto-generate uses insert-before-delete pattern for safety.
- **E2E auth**: `test-login` Credentials provider gated behind `E2E_TESTING=true`. Seed endpoint at `POST /api/test/seed` with scenarios `"default"`, `"with-library"`, `"full"`.
- **drizzle.config.ts**: Uses `config({ path: ".env.local" })` — not `import "dotenv/config"` which only loads `.env`.

## In Progress - Integration & E2E Testing

### Layer 1: API Integration Tests (PGlite) ✅
- **`vitest.integration.config.ts`**: Separate Vitest config — `environment: "node"`, `pool: "forks"`, `singleFork: true`
- **`tests/integration/setup.ts`**: PGlite (in-process Postgres via WASM), raw DDL matching schema.ts, mocks for auth/cache, real DB for everything else
- **`tests/integration/helpers.ts`**: `seedUser`, `seedGames`, `seedPreferences`, `seedSession`, `makeRequest`, `makeJsonRequest`, `authAs`, `authAsNone`
- **6 test flow files, 42 tests total:**
  - `error-boundaries.test.ts` (20): All 13 routes return 401 unauthed + 7 validation 400s
  - `library-sync.test.ts` (5): Sync, re-sync onConflictDoUpdate, preserves status/priority, relational query
  - `game-enrichment.test.ts` (4): Achievements persist to DB, HLTB fetch + DB cache early-return
  - `prioritization-scheduling.test.ts` (5): Batch priority update, auto-generate priority order, clearExisting transaction
  - `full-scheduling-workflow.test.ts` (3): Multi-step prefs→generate→CRUD→iCal, cross-user isolation, empty iCal
  - `timezone-handling.test.ts` (5): Asia/Tokyo, America/Los_Angeles, UTC, manual session round-trip
- **Key insight**: `vi.restoreAllMocks()` doesn't clear standalone `vi.fn()` call history — use `vi.hoisted()` for shared mock fns and track call count manually

### Layer 2: Playwright E2E Tests ✅
- **Installed**: `@playwright/test`, `cross-env`, Chromium browser
- **`playwright.config.ts`**: Chromium-only, single worker, dev server with `E2E_TESTING=true`
- **`src/lib/auth/index.ts`**: Added test-only `test-login` Credentials provider gated behind `E2E_TESTING=true`
- **`src/app/api/test/seed/route.ts`**: Seed endpoint with 3 scenarios (default, with-library, full) — returns 403 when `E2E_TESTING !== "true"`
- **`tests/e2e/auth.setup.ts`**: Seeds user, authenticates via test-login, saves storage state
- **Completed specs**: `settings.spec.ts` (4 tests), `library.spec.ts` (5 tests), `schedule.spec.ts` (8 tests), `full-workflow.spec.ts` (1 test)

### npm Scripts Added
- `npm run test:integration` — runs PGlite integration tests
- `npm run test:e2e` — runs Playwright E2E tests
- `npm run test:e2e:ui` — Playwright UI mode

### Test Results
| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Unit tests | 32 | 259 | ✅ All pass |
| Integration tests | 7 | 48 | ✅ All pass |
| E2E tests | 4+1 setup | 19 | ✅ All pass |

### Bugs Found & Fixed During E2E Testing
- **Neon HTTP transactions**: `neon()` driver doesn't support `db.transaction()`. Replaced with insert-before-delete pattern in auto-generate and sequential upserts in library sync.
- **Library sync resilience**: Wrapped Steam API sync in try-catch so library endpoint returns existing DB data when Steam API key is missing or API fails.
- **E2E selectors**: Fixed strict mode violations (`.first()` on multi-match locators), dialog title conflicts (`getByRole('heading')` instead of `getByText`), Next.js Dev Tools button conflict (exact `"Next →"` text).
- **drizzle.config.ts**: Changed to load `.env.local` instead of `.env`.

## Completed - Phase 3: Calendar & Scheduling

### Pre-Phase 3 Hardening ✅
- **CR-006**: Timezone validation against `Intl.supportedValuesOf('timeZone')`
- **CR-007**: Cache null sentinel pattern (`{ __cacheNull: true }`) to prevent redundant API calls
- **CR-009**: Batch priority endpoint (`PATCH /api/games/batch`) replacing N parallel requests

### Stage 1: Scheduling Services ✅
- **`src/lib/utils/date.ts`**: `formatSessionTime`, `formatSessionDate`, `getWeekDays`, `durationMinutes`, `formatDuration` — timezone-aware helpers
- **`src/lib/services/ical.ts`**: `generateICalendar()` — RFC 5545 iCal generation with proper CRLF, character escaping, VTIMEZONE support
- **`src/lib/services/scheduler.ts`**: `generateSchedule()` — greedy forward-fill algorithm distributing backlog games across weekday evenings (19:00) and weekend afternoons (14:00), using HLTB time estimates
- 32 tests (11 date + 7 iCal + 14 scheduler)

### Stage 2: Session API Routes ✅
- **`src/app/api/sessions/route.ts`**: GET (date range filter with game cache join) + POST (full validation, crypto.randomUUID)
- **`src/app/api/sessions/[sessionId]/route.ts`**: PATCH (cross-field validation for partial updates) + DELETE (ownership check)
- **`src/app/api/sessions/auto-generate/route.ts`**: Fetch preferences + backlog, run scheduler, insert-before-delete (Neon HTTP doesn't support transactions)
- **`src/app/api/calendar/export.ics/route.ts`**: iCal export with Content-Type: text/calendar
- 40 tests (13 sessions + 14 sessionId + 9 auto-generate + 4 iCal export)

### Stage 3: Session Hooks ✅
- **`src/lib/hooks/use-sessions.ts`**: `useSessions`, `useCreateSession`, `useUpdateSession`, `useDeleteSession`, `useAutoGenerateSessions` — all invalidate `["sessions"]` query cache
- 10 tests

### Stage 4-5: UI Components & Page ✅
- **`src/components/schedule/session-card.tsx`**: Game image, time range, duration badge, complete/edit/delete actions
- **`src/components/schedule/session-form-dialog.tsx`**: Create/edit with timezone-aware local↔UTC conversion (key-based form reset)
- **`src/components/schedule/auto-schedule-dialog.tsx`**: Start date, weeks (1-12), clear existing option
- **`src/components/schedule/calendar-view.tsx`**: Week/month tabs, session grid, DayPicker with session indicators
- **`src/app/(dashboard)/schedule/page.tsx`**: Schedule page
- **`src/components/nav.tsx`**: Added "Schedule" nav link
- 19 tests (9 session-card + 5 form-dialog + 5 auto-schedule)

### Phase 3 Code Review ✅
- **CR-014 HIGH** (fixed): Timezone bug in session form — added `timezone` prop with `fromZonedTime`/`toZonedTime`
- **CR-015 MEDIUM-HIGH** (fixed): Cross-field validation gap in PATCH — fetch existing session for merged validation
- **CR-016 MEDIUM** (fixed): Missing notes length validation — added 2000 char limit
- **CR-018 MEDIUM** (fixed): Race condition in clearExisting — insert-before-delete pattern (Neon HTTP doesn't support transactions)
- **CR-013 LOW** (deferred): HLTB data never expires in DB — fix in Phase 4
- **CR-017 MEDIUM** (deferred): Auto-generate lacks rate limiting — fix in Phase 4

### Test Results
| Metric | Phase 1 | Phase 2 | Phase 3 | Threshold |
|--------|---------|---------|---------|-----------|
| Test files | 13 | 20 | 32 | — |
| Tests | 94 | 144 | 258 | — |
| Statements | 97.43% | 94.01% | 95.26% | 80% |
| Branches | 89.31% | 85.24% | 88.07% | 80% |
| Functions | 93.87% | 89.15% | 88.28% | 80% |
| Lines | 98.86% | 95.98% | 96.77% | 80% |

## Completed - Phase 2: Hardening + Game Management

### Stage 1: Hardening Pass ✅
- **CR-001**: Wrapped library sync DB writes in `db.transaction()` with error handling
- **CR-002**: Added `res.ok` checks to `getPlayerSummary`, `getOwnedGames`, `getSteamProfile`
- **CR-003**: Added runtime validation for `status` (enum check) and `priority` (non-negative integer) in PATCH /api/games
- All 3 issues moved to Resolved in `CODE_REVIEW.md`

### Stage 2: HLTB Integration ✅
- **`src/lib/services/hltb.ts`**: `getHLTBData(gameName, steamAppId)` — searches HLTB, converts hours→minutes, persists to `game_cache`, 7-day cache via `cachedFetch`
- **`src/app/api/hltb/[appId]/route.ts`**: Auth-gated GET endpoint, checks `game_cache` first, lazy-fetches HLTB on miss
- 12 tests (6 service + 6 route)

### Stage 3: Game Detail Pages ✅
- **`src/lib/hooks/use-game-detail.ts`**: `useGameAchievements(appId)` + `useHLTBData(appId)` hooks
- **`src/app/(dashboard)/library/[appId]/page.tsx`**: Full detail page with header image, HLTB progress bars (main/extra/completionist), achievements list with progress, status selector, Steam store link, sidebar with playtime
- **`src/components/games/game-card.tsx`**: Added `next/link` wrapper — image/title link to `/library/{appId}`, status selector stays outside link
- 7 new tests (6 hooks + 1 game-card link)

### Stage 4: Settings Page ✅
- **`src/app/api/preferences/route.ts`**: GET (returns defaults if none) + PATCH (validates weeklyHours 0-168, sessionLength 15-480, timezone non-empty; upserts)
- **`src/lib/hooks/use-preferences.ts`**: `usePreferences()` + `useUpdatePreferences()` hooks
- **`src/app/(dashboard)/settings/page.tsx`**: Form with number inputs, timezone select (15 common timezones), save button with success/error messages
- 12 tests (8 API + 4 hooks)

### Stage 5: Backlog Prioritization ✅
- **Installed**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **`src/lib/hooks/use-priority.ts`**: `useBatchUpdatePriorities()` — batch PATCH /api/games for each reordered game
- **`src/components/games/backlog-prioritizer.tsx`**: DnD sortable list of backlog games, drag handle, save button assigns `(length - index)` priority
- **`src/app/(dashboard)/library/page.tsx`**: Converted to client component with Tabs — "All Games" (GameGrid) + "Prioritize Backlog" (BacklogPrioritizer)
- 9 tests (4 hooks + 5 component)

### Test Results
| Metric | Phase 1 | Phase 2 | Threshold |
|--------|---------|---------|-----------|
| Test files | 13 | 20 | — |
| Tests | 94 | 144 | — |
| Statements | 97.43% | 94.01% | 80% |
| Branches | 89.31% | 85.24% | 80% |
| Functions | 93.87% | 89.15% | 80% |
| Lines | 98.86% | 95.98% | 80% |

### New Files (Phase 2)
| File | Type |
|------|------|
| `src/lib/services/hltb.ts` | HLTB service |
| `src/app/api/hltb/[appId]/route.ts` | HLTB API route |
| `src/lib/hooks/use-game-detail.ts` | Achievement + HLTB hooks |
| `src/lib/hooks/use-preferences.ts` | Preferences hooks |
| `src/lib/hooks/use-priority.ts` | Batch priority hook |
| `src/app/(dashboard)/library/[appId]/page.tsx` | Game detail page |
| `src/app/(dashboard)/settings/page.tsx` | Settings page |
| `src/app/api/preferences/route.ts` | Preferences API |
| `src/components/games/backlog-prioritizer.tsx` | DnD priority component |

### Modified Files (Phase 2)
| File | Change |
|------|--------|
| `src/app/api/steam/library/route.ts` | Transaction wrapper + error handling |
| `src/lib/services/steam.ts` | `res.ok` checks on getPlayerSummary, getOwnedGames |
| `src/app/api/auth/steam/callback/route.ts` | `res.ok` check on getSteamProfile |
| `src/app/api/games/route.ts` | Status enum + priority validation |
| `src/components/games/game-card.tsx` | Link wrapper to detail page |
| `src/app/(dashboard)/library/page.tsx` | Client component with tabs |

## Completed - Phase 1: Foundation ✅

### Testing Infrastructure
- **Config**: `vitest.config.ts` — jsdom environment, v8 coverage, 80% thresholds
- **Setup**: `vitest.setup.ts` — jest-dom matchers, dummy env vars, afterEach cleanup
- **Helpers**: `src/lib/__tests__/helpers.ts` — `makeLibraryGame()` factory, `mockFetchResponse()`

### Foundation Features
1. Next.js 16 project with App Router, TypeScript, Tailwind CSS v4
2. shadcn/ui with dark gaming theme (14 components)
3. Drizzle ORM schema (users, preferences, games, cache, achievements, sessions)
4. Steam OpenID authentication via Auth.js v5
5. Steam API service layer (player summary, owned games, achievements, schema)
6. Upstash Redis caching with TTL constants
7. Game library UI (dashboard, grid, cards, search/filter/sort)

## File Structure

```
steam-backlog-planner/
├── CLAUDE.md
├── HANDOVER.md
├── CODE_REVIEW.md
├── vitest.config.ts
├── vitest.setup.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    (dashboard)
│   │   │   ├── library/
│   │   │   │   ├── page.tsx                (tabbed: grid + prioritizer)
│   │   │   │   └── [appId]/page.tsx        (game detail)
│   │   │   ├── statistics/page.tsx         (charts dashboard)
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/steam/{route,callback/route}.ts
│   │       ├── steam/library/route.ts
│   │       ├── steam/achievements/[appId]/route.ts
│   │       ├── games/route.ts
│   │       ├── hltb/[appId]/route.ts
│   │       ├── igdb/[appId]/route.ts
│   │       ├── games/batch/route.ts
│   │       ├── sessions/route.ts
│   │       ├── sessions/[sessionId]/route.ts
│   │       ├── sessions/auto-generate/route.ts
│   │       ├── calendar/export.ics/route.ts
│   │       ├── statistics/route.ts
│   │       ├── preferences/route.ts
│   │       ├── discord/test/route.ts
│   │       └── google/{connect,callback,disconnect}/route.ts
│   ├── components/
│   │   ├── nav.tsx
│   │   ├── ui/                              (17 shadcn components)
│   │   ├── games/
│   │   │   ├── game-card.tsx
│   │   │   ├── game-grid.tsx
│   │   │   └── backlog-prioritizer.tsx
│   │   ├── schedule/
│   │   │   ├── session-card.tsx
│   │   │   ├── session-form-dialog.tsx
│   │   │   ├── auto-schedule-dialog.tsx
│   │   │   └── calendar-view.tsx
│   │   └── statistics/
│   │       ├── status-chart.tsx
│   │       ├── playtime-chart.tsx
│   │       ├── completion-predictions.tsx
│   │       └── achievement-overview.tsx
│   └── lib/
│       ├── auth/{index,steam-provider,types}.ts
│       ├── db/{index,schema}.ts
│       ├── services/{steam,cache,hltb,hltb-client,ical,scheduler,discord,discord-notify,google-calendar,gcal-sync,igdb-client,igdb}.ts
│       ├── hooks/{use-library,use-game-detail,use-preferences,use-priority,use-sessions,use-statistics,use-discord,use-google-calendar}.ts
│       ├── utils/date.ts
│       └── providers.tsx
```

## Environment Variables Needed

Copy `.env.example` to `.env.local` and fill in:
- `STEAM_API_KEY` - Get from https://steamcommunity.com/dev/apikey
- `DATABASE_URL` - Neon PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL` - From Upstash console
- `UPSTASH_REDIS_REST_TOKEN` - From Upstash console
- `AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - `http://localhost:3000` for dev
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (Cloud Console)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - `http://localhost:3000/api/google/callback` for dev

## To Run

1. Copy `.env.example` to `.env.local` and fill in values
2. `npm run db:push` - Push schema to Neon
3. `npm run dev` - Start dev server

## Next Steps - Phase 5: Polish & Integrations

- [ ] Mobile responsive design refinement
- [ ] Dashboard page content
- [ ] Loading/error states UX improvements

## Next Steps - Phase 6: External Integrations

- [ ] Google Calendar OAuth and two-way sync
- [ ] Discord webhook notifications
- [ ] IGDB integration for additional metadata

## Known Issues

- **Build requires env vars**: `npm run build` fails without `DATABASE_URL` set (Neon client initializes at module load). This is expected — deploy with env vars configured.
- **Pre-existing lint warning**: `login/page.tsx` uses `<a>` for Steam auth redirect — intentional since it's an API route that redirects externally.
- **HLTB API fragility**: Custom client uses hardcoded `/api/finder` endpoint. If HLTB changes the path again, the client will need updating. Consider adding JS bundle scraping as a fallback (see `howlongtobeat-js` for the pattern).
