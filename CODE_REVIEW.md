# Code Review Findings

Tracked issues from end-of-session code reviews. Fix before building on top of affected code.

## Open

### CR-006: Timezone validation accepts arbitrary strings [MEDIUM]
- **File**: `src/app/api/preferences/route.ts` (lines 60-63)
- **Found**: Phase 2 review
- **Fix by**: Phase 3 start (scheduler will use timezone for session scheduling)
- **Issue**: Server-side validation only checks non-empty string. Any arbitrary value is accepted and persisted. The Settings UI has a hardcoded allowlist of 15 timezones, but the API does not enforce it.
- **Fix**: Validate against `Intl.supportedValuesOf('timeZone')` or the same allowlist used in the UI.

### CR-007: HLTB `cachedFetch` caches `null` results ineffectively [MEDIUM]
- **Files**: `src/lib/services/hltb.ts`, `src/lib/services/cache.ts`
- **Found**: Phase 2 review
- **Fix by**: Phase 3 (when scheduler needs reliable HLTB data)
- **Issue**: When HLTB search returns no results, `null` is stored in Redis. But `getCached` treats `null` as cache miss, so every request for games without HLTB data re-hits the HLTB API.
- **Fix**: Use a sentinel value (e.g., `{ notFound: true }`) instead of `null`, or special-case null handling in `cachedFetch`.

### CR-009: Batch priority update fires N parallel requests [MEDIUM]
- **File**: `src/lib/hooks/use-priority.ts`
- **Found**: Phase 2 review
- **Fix by**: Phase 3 (before users accumulate large backlogs)
- **Issue**: `useBatchUpdatePriorities` sends one `PATCH /api/games` per game via `Promise.all`. For 100+ game backlogs, this overwhelms browser connections and may cause DB contention.
- **Fix**: Create a dedicated `PATCH /api/games/batch` endpoint that accepts an array of updates in a single request with one DB transaction.

### CR-013: DB-cached HLTB data never expires [LOW]
- **File**: `src/app/api/hltb/[appId]/route.ts` (line 34)
- **Found**: Phase 2 review
- **Fix by**: Phase 4 (low priority, data rarely changes)
- **Issue**: The HLTB route checks `game.hltbMainMinutes !== null` to return cached data, but never checks `cachedAt` freshness. Redis cache has 7-day TTL, but the DB-level cache is permanent.
- **Fix**: Add a staleness check (e.g., re-fetch if `cachedAt` older than 30 days).

## Resolved

### CR-001: Library sync lacks transaction boundary [HIGH]
- **File**: `src/app/api/steam/library/route.ts`
- **Found**: Phase 1 review
- **Resolved**: Phase 2 hardening
- **Fix**: Wrapped DB writes in `db.transaction()`, added try-catch returning 500 on failure

### CR-002: Steam API calls don't check response status [MEDIUM]
- **Files**: `src/lib/services/steam.ts`, `src/app/api/auth/steam/callback/route.ts`
- **Found**: Phase 1 review
- **Resolved**: Phase 2 hardening
- **Fix**: Added `if (!res.ok)` checks to `getPlayerSummary` (returns null), `getOwnedGames` (returns []), and `getSteamProfile` callback (returns null)

### CR-003: Missing input validation on PATCH /api/games [MEDIUM]
- **File**: `src/app/api/games/route.ts`
- **Found**: Phase 1 review
- **Resolved**: Phase 2 hardening
- **Fix**: Validate `status` against `gameStatusEnum.enumValues`, validate `priority` as non-negative integer, return 400 on invalid input

### CR-004: Unprotected req.json() in PATCH /api/games [HIGH]
- **File**: `src/app/api/games/route.ts`
- **Found**: Phase 2 review
- **Resolved**: Phase 2 review fixes
- **Fix**: Wrapped `req.json()` in try-catch, returns 400 on parse failure

### CR-005: Unprotected req.json() in PATCH /api/preferences [MEDIUM]
- **File**: `src/app/api/preferences/route.ts`
- **Found**: Phase 2 review
- **Resolved**: Phase 2 review fixes
- **Fix**: Wrapped `req.json()` in try-catch, returns 400 on parse failure

### CR-008: BacklogPrioritizer uses stale closure over initial backlogGames [MEDIUM]
- **File**: `src/components/games/backlog-prioritizer.tsx`
- **Found**: Phase 2 review
- **Resolved**: Phase 2 review fixes
- **Fix**: Added useEffect that resets items when backlog composition changes (keyed by appId list)

### CR-010: hasChanges cleared before mutation completes [LOW]
- **File**: `src/components/games/backlog-prioritizer.tsx`
- **Found**: Phase 2 review
- **Resolved**: Phase 2 review fixes
- **Fix**: Moved `setHasChanges(false)` into mutation's `onSuccess` callback

### CR-011: NaN appId fires wasted API requests [LOW]
- **File**: `src/lib/hooks/use-game-detail.ts`
- **Found**: Phase 2 review
- **Resolved**: Phase 2 review fixes
- **Fix**: Added `enabled: !isNaN(appId)` to both useQuery calls

### CR-012: formatPlaytime duplicated in three files [LOW]
- **Files**: `game-card.tsx`, `[appId]/page.tsx`, `backlog-prioritizer.tsx`
- **Found**: Phase 2 review
- **Resolved**: Phase 2 review fixes
- **Fix**: Extracted to `src/lib/utils.ts`, imported in all three files
