# Steam Backlog Planner - Implementation Handover

## Session Summary
Phase 3 (Calendar & Scheduling) is fully implemented. 258 tests passing across 32 files, all coverage thresholds met. Six code review findings from Phase 3: four fixed in-session (CR-014–016, CR-018), two deferred (CR-013 LOW, CR-017 MEDIUM).

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
- **`src/app/api/sessions/auto-generate/route.ts`**: Fetch preferences + backlog, run scheduler, bulk insert in DB transaction
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
- **CR-018 MEDIUM** (fixed): Race condition in clearExisting — wrapped in `db.transaction()`
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
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/steam/{route,callback/route}.ts
│   │       ├── steam/library/route.ts
│   │       ├── steam/achievements/[appId]/route.ts
│   │       ├── games/route.ts
│   │       ├── hltb/[appId]/route.ts
│   │       ├── games/batch/route.ts
│   │       ├── sessions/route.ts
│   │       ├── sessions/[sessionId]/route.ts
│   │       ├── sessions/auto-generate/route.ts
│   │       ├── calendar/export.ics/route.ts
│   │       └── preferences/route.ts
│   ├── components/
│   │   ├── nav.tsx
│   │   ├── ui/                              (16 shadcn components)
│   │   ├── games/
│   │   │   ├── game-card.tsx
│   │   │   ├── game-grid.tsx
│   │   │   └── backlog-prioritizer.tsx
│   │   └── schedule/
│   │       ├── session-card.tsx
│   │       ├── session-form-dialog.tsx
│   │       ├── auto-schedule-dialog.tsx
│   │       └── calendar-view.tsx
│   └── lib/
│       ├── auth/{index,steam-provider,types}.ts
│       ├── db/{index,schema}.ts
│       ├── services/{steam,cache,hltb,ical,scheduler}.ts
│       ├── hooks/{use-library,use-game-detail,use-preferences,use-priority,use-sessions}.ts
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

## To Run

1. Copy `.env.example` to `.env.local` and fill in values
2. `npm run db:push` - Push schema to Neon
3. `npm run dev` - Start dev server

## Next Steps - Phase 4: Statistics & Polish

- [ ] CR-013: Add staleness check for HLTB data in DB cache (re-fetch if >30 days)
- [ ] CR-017: Add rate limiting to auto-generate endpoint
- [ ] Statistics dashboard with charts
- [ ] Playtime analytics and completion predictions
- [ ] Mobile responsive design refinement

## Next Steps - Phase 5: External Integrations

- [ ] Google Calendar OAuth and two-way sync
- [ ] Discord webhook notifications
- [ ] IGDB integration for additional metadata

## Known Issues

- **Build requires env vars**: `npm run build` fails without `DATABASE_URL` set (Neon client initializes at module load). This is expected — deploy with env vars configured.
- **Pre-existing lint warning**: `login/page.tsx` uses `<a>` for Steam auth redirect — intentional since it's an API route that redirects externally.
