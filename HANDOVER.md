# Steam Backlog Planner - Implementation Handover

## Session Summary
Phase 1 (Foundation) is fully implemented. All 7 tasks complete, project type-checks cleanly.
Unit testing infrastructure added with 94 tests passing, all coverage thresholds met.

## Completed Tasks - Testing Infrastructure ✅

### Vitest Setup
- **Config**: `vitest.config.ts` — jsdom environment, v8 coverage, 80% thresholds
- **Setup**: `vitest.setup.ts` — jest-dom matchers, dummy env vars, afterEach cleanup
- **Scripts**: `npm test`, `npm run test:watch`, `npm run test:coverage`
- **Helpers**: `src/lib/__tests__/helpers.ts` — `makeLibraryGame()` factory, `mockFetchResponse()`

### Test Files (13 files, 94 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `src/lib/services/__tests__/steam.test.ts` | 15 | All fetch functions + URL helpers |
| `src/lib/services/__tests__/cache.test.ts` | 11 | getCached, setCache, invalidateCache, cachedFetch, TTLs |
| `src/lib/auth/__tests__/steam-provider.test.ts` | 9 | getSteamLoginUrl (params, realm), verifySteamLogin (valid/invalid/missing) |
| `src/lib/db/__tests__/schema.test.ts` | 7 | Enum values, table exports |
| `src/lib/hooks/__tests__/use-library.test.tsx` | 5 | useLibrary (loading/success/error), useUpdateGameStatus |
| `src/app/api/steam/library/__tests__/route.test.ts` | 4 | 401, 404, cache+upsert, returns list |
| `src/app/api/steam/achievements/[appId]/__tests__/route.test.ts` | 8 | 401, 400, 404, enriched data, fetcher callback, DB updates |
| `src/app/api/games/__tests__/route.test.ts` | 5 | 401, 400, update status/priority |
| `src/app/api/auth/steam/__tests__/route.test.ts` | 2 | Redirect to Steam |
| `src/app/api/auth/steam/callback/__tests__/route.test.ts` | 5 | Failed verify, profile fetch, signIn, missing profile |
| `src/components/games/__tests__/game-card.test.tsx` | 7 | Name, fallback, badge, playtime, HLTB progress, image |
| `src/components/games/__tests__/game-grid.test.tsx` | 12 | Loading, error, cards, search, filter, sort (name/lastPlayed), status change, empty states |
| `src/components/__tests__/nav.test.tsx` | 4 | Nav items, brand, authenticated user, unauthenticated |

### Coverage Results
| Metric | Result | Threshold |
|--------|--------|-----------|
| Statements | 97.43% | 80% |
| Branches | 89.31% | 80% |
| Functions | 93.87% | 80% |
| Lines | 98.86% | 80% |

### Coverage Exclusions (in vitest.config.ts)
- `src/components/ui/**` — shadcn primitives
- `src/lib/db/index.ts` — DB client init
- `src/lib/db/schema.ts` — Drizzle relation declarations
- `src/lib/auth/index.ts` — NextAuth config with DB calls
- `src/lib/auth/types.ts` — type declarations only
- `src/lib/providers.tsx` — thin wrapper
- `src/lib/utils.ts` — tiny utility
- `src/lib/__tests__/**` — test helpers
- `src/app/api/auth/[...nextauth]/**` — re-export

### Remaining
- [ ] Run `npx tsc --noEmit` to verify no type errors
- [ ] Consider E2E tests as a future phase

## Completed Tasks - Phase 1: Foundation

### 1. Next.js 15 Project Setup ✅
- Created project at `V:\Projects\steam-backlog-planner`
- Next.js 16.1.6 with App Router, TypeScript, Tailwind CSS v4
- ESLint configured
- Image remotePatterns configured for Steam CDN domains

### 2. shadcn/ui Installation ✅
- Initialized with dark theme
- Installed components: button, card, input, label, badge, avatar, dropdown-menu, dialog, scroll-area, separator, tabs, skeleton, progress, select
- Updated `globals.css` with dark gaming theme (deep blue/cyan colors using oklch)
- Set `<html className="dark">` in layout

### 3. Drizzle ORM Setup ✅
- Schema defined at `src/lib/db/schema.ts`
- Tables: users, user_preferences, user_games, game_cache, user_achievements, scheduled_sessions
- Enums: game_status (backlog, playing, completed, abandoned)
- Relations configured between all tables
- Types exported
- Drizzle config at `drizzle.config.ts`
- DB scripts: db:generate, db:migrate, db:push, db:studio

### 4. Steam OpenID Authentication ✅
- Custom Steam OpenID 2.0 provider at `src/lib/auth/steam-provider.ts`
- Auth.js v5 configured with Credentials provider at `src/lib/auth/index.ts`
- Type augmentation for steamId on session at `src/lib/auth/types.ts`
- API routes:
  - `src/app/api/auth/[...nextauth]/route.ts` - NextAuth handler
  - `src/app/api/auth/steam/route.ts` - Redirects to Steam OpenID
  - `src/app/api/auth/steam/callback/route.ts` - Validates OpenID response, fetches profile, creates/updates user
- Login page at `src/app/(auth)/login/page.tsx` with Steam branding

### 5. Steam API Service Layer ✅
- `src/lib/services/steam.ts` with functions:
  - `getPlayerSummary(steamId)` - Player profile
  - `getOwnedGames(steamId)` - Full game library with playtime
  - `getPlayerAchievements(steamId, appId)` - Per-game achievements
  - `getSchemaForGame(appId)` - Achievement metadata
  - Helper URLs: `getGameHeaderUrl`, `getGameCapsuleUrl`, `getStorePage`

### 6. Redis Caching (Upstash) ✅
- `src/lib/services/cache.ts` with:
  - TTL constants: STEAM_LIBRARY (1hr), STEAM_ACHIEVEMENTS (30min), HLTB_DATA (7d), GAME_METADATA (24hr), PLAYER_PROFILE (6hr)
  - `getCached<T>()` / `setCache<T>()` - Direct cache read/write
  - `cachedFetch<T>()` - Fetch-through cache (check cache, fallback to fetcher, store result)
  - `invalidateCache()` - Cache busting
  - Namespaced keys: `sbp:{category}:{parts}`

### 7. Game Library UI ✅
- **Dashboard layout**: `src/app/(dashboard)/layout.tsx` - Auth-gated with nav
- **Nav component**: `src/components/nav.tsx` - Links to Dashboard, Library, Settings; user avatar dropdown with sign out
- **Dashboard page**: `src/app/(dashboard)/page.tsx` - Stats cards (total, backlog, playing, completed), total playtime
- **Library page**: `src/app/(dashboard)/library/page.tsx`
- **Game card**: `src/components/games/game-card.tsx` - Header image, status badge, playtime, HLTB progress bar, status selector
- **Game grid**: `src/components/games/game-grid.tsx` - Search, status filter, sort (playtime/name/lastPlayed), loading skeletons
- **API routes**:
  - `GET /api/steam/library` - Syncs Steam library to DB, returns enriched game list
  - `GET /api/steam/achievements/[appId]` - Fetches and caches achievements with schema
  - `PATCH /api/games` - Update game status/priority
- **Hooks**: `src/lib/hooks/use-library.ts` - TanStack Query hooks for library data and status mutations
- **Providers**: `src/lib/providers.tsx` - SessionProvider + QueryClientProvider

## File Structure

```
steam-backlog-planner/
├── drizzle.config.ts
├── vitest.config.ts               (test config, coverage thresholds)
├── vitest.setup.ts                (jest-dom, env vars, cleanup)
├── CLAUDE.md                      (Claude Code project instructions)
├── HANDOVER.md                    (this file)
├── next.config.ts                 (image domains for Steam CDN)
├── .env.example
├── .gitignore                     (excludes .env*, keeps .env.example)
├── .claude/rules/testing.md       (mocking recipes for tests)
├── src/
│   ├── app/
│   │   ├── globals.css            (dark gaming theme)
│   │   ├── layout.tsx             (root layout with Providers)
│   │   ├── (auth)/
│   │   │   └── login/page.tsx     (Steam login page)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         (auth-gated, nav)
│   │   │   ├── page.tsx           (dashboard overview)
│   │   │   └── library/page.tsx   (game library grid)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts
│   │       │   └── steam/
│   │       │       ├── route.ts          (redirect to Steam)
│   │       │       └── callback/route.ts (OpenID callback)
│   │       ├── steam/
│   │       │   ├── library/route.ts
│   │       │   └── achievements/[appId]/route.ts
│   │       └── games/route.ts
│   ├── components/
│   │   ├── nav.tsx
│   │   ├── ui/                    (14 shadcn components)
│   │   └── games/
│   │       ├── game-card.tsx
│   │       └── game-grid.tsx
│   └── lib/
│       ├── providers.tsx
│       ├── utils.ts
│       ├── __tests__/helpers.ts   (test factories)
│       ├── auth/
│       │   ├── index.ts           (Auth.js config)
│       │   ├── steam-provider.ts  (OpenID 2.0 helpers)
│       │   ├── types.ts           (session type augmentation)
│       │   └── __tests__/steam-provider.test.ts
│       ├── db/
│       │   ├── index.ts           (Neon + Drizzle client)
│       │   ├── schema.ts          (all tables, relations, types)
│       │   └── __tests__/schema.test.ts
│       ├── services/
│       │   ├── steam.ts           (Steam Web API wrapper)
│       │   ├── cache.ts           (Upstash Redis caching)
│       │   └── __tests__/{steam,cache}.test.ts
│       ├── hooks/
│       │   ├── use-library.ts     (TanStack Query hooks)
│       │   └── __tests__/use-library.test.tsx
│       └── stores/                (empty, for Zustand later)
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

## Next Steps - Phase 2: Game Management

- [ ] HowLongToBeat integration (`src/lib/services/hltb.ts`) using `howlongtobeat` package
- [ ] Game detail pages with HLTB/achievement data (`src/app/(dashboard)/library/[appId]/page.tsx`)
- [ ] Backlog prioritization with drag & drop
- [ ] Settings page for user preferences

## Next Steps - Phase 3: Calendar & Scheduling

- [ ] Calendar component (weekly/monthly views)
- [ ] Manual gaming session scheduling
- [ ] Auto-schedule generator (`src/lib/services/scheduler.ts`)
- [ ] iCal export functionality

## Next Steps - Phase 4: Statistics & Polish

- [ ] Statistics dashboard with charts
- [ ] Playtime analytics and completion predictions
- [ ] Mobile responsive design refinement

## Next Steps - Phase 5: External Integrations

- [ ] Google Calendar OAuth and two-way sync
- [ ] Discord webhook notifications
- [ ] IGDB integration for additional metadata

---

# Full Implementation Plan

## Overview
A modern web app to manage Steam game backlog, track completion progress via achievements and HowLongToBeat data, and schedule gaming sessions with calendar integration.

## Project Details
- **Location**: `V:\Projects\steam-backlog-planner`
- **Database**: Neon (serverless PostgreSQL)
- **Deployment**: Vercel
- **Theme**: Dark gaming aesthetic

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | Next.js 15 (App Router) | API routes, RSC, SSR, excellent Auth.js integration |
| **UI** | shadcn/ui + Tailwind CSS | Modern design, full customization, Radix accessibility |
| **Database** | PostgreSQL + Drizzle ORM | Type-safe, serverless-ready, lightweight |
| **Caching** | Upstash Redis + TanStack Query | Multi-tier caching, respects API rate limits |
| **State** | Zustand (UI) + TanStack Query (server) | Clean separation, minimal boilerplate |
| **Auth** | Auth.js v5 + custom Steam provider | Steam OpenID 2.0 support |

## Core Features

### Phase 1: Foundation ✅ COMPLETE
- [x] Next.js 15 project setup with TypeScript
- [x] shadcn/ui installation and theme configuration
- [x] PostgreSQL + Drizzle schema and migrations
- [x] Steam OpenID authentication via Auth.js
- [x] Steam API integration (GetOwnedGames, GetPlayerSummaries)
- [x] Redis caching layer setup
- [x] Game library display (grid view)

### Phase 2: Game Management
- [ ] Game status system (backlog, playing, completed, abandoned)
- [ ] HowLongToBeat integration for completion estimates
- [ ] Steam achievement fetching and progress calculation
- [ ] Game detail pages with HLTB/achievement data
- [ ] Search, filter, and sort functionality
- [ ] Backlog prioritization (drag & drop)

### Phase 3: Calendar & Scheduling
- [ ] Calendar component (weekly/monthly views)
- [ ] Manual gaming session scheduling
- [ ] Auto-schedule generator based on:
  - Remaining playtime (HLTB - current playtime)
  - Achievement completion percentage
  - User preferences (weekly hours, session length)
- [ ] iCal export functionality

### Phase 4: Statistics & Polish
- [ ] Statistics dashboard with charts
- [ ] Playtime analytics and completion predictions
- [ ] Mobile responsive design
- [ ] Loading states and error handling

### Phase 5: External Integrations
- [ ] Google Calendar OAuth and two-way sync
- [ ] Discord webhook notifications
- [ ] IGDB integration for additional metadata

## Database Schema (Key Tables)

```sql
users (id, steam_id, steam_username, avatar_url, created_at)
user_preferences (user_id, weekly_hours, session_length, timezone)
user_games (user_id, steam_app_id, status, priority, playtime_minutes)
game_cache (steam_app_id, name, hltb_main, hltb_extra, total_achievements)
user_achievements (user_id, steam_app_id, achieved_count, total_count)
scheduled_sessions (user_id, steam_app_id, start_time, end_time, completed)
```

## Caching Strategy

| Data Type | TTL | Layer |
|-----------|-----|-------|
| Steam Library | 1 hour | Redis |
| Steam Achievements | 30 min | Redis |
| HLTB Data | 7 days | Redis + PostgreSQL |
| Game Metadata | 24 hours | Redis + PostgreSQL |
| Player Profile | 6 hours | Redis |

## API Rate Limits

- **Steam Web API**: ~100k calls/day, batch up to 100 IDs per request
- **HowLongToBeat**: Unofficial scraping, cache aggressively (7+ days)
- Use server-side rate limiting with token bucket algorithm

## Verification Plan

1. **Auth**: Sign in with Steam, verify session persists
2. **Library**: Confirm games load with correct playtime data
3. **HLTB**: Verify completion estimates match HowLongToBeat website
4. **Achievements**: Check achievement progress syncs correctly
5. **Calendar**: Create session, verify it appears on calendar
6. **Export**: Download iCal, import to calendar app
7. **Caching**: Check Redis keys populate, verify TTL behavior
