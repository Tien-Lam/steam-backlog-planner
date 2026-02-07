# Code Review Findings

Tracked issues from end-of-session code reviews. Fix before building on top of affected code.

## Open

(No open issues)

## Resolved

### CR-021: Library sync resets cachedAt, defeating HLTB staleness check [MEDIUM]
- **Files**: `src/app/api/steam/library/route.ts` (line 44), `src/app/api/hltb/[appId]/route.ts` (line 35)
- **Found**: Phase 4 hardening review
- **Resolved**: Phase 4 hardening
- **Issue**: Library sync's `onConflictDoUpdate` set `cachedAt: new Date()` on every visit, resetting the HLTB staleness timer. Users who visited their library regularly would never get HLTB data refreshed.
- **Fix**: Removed `cachedAt` from library sync's update set. Now only the HLTB service updates `cachedAt` when it fetches fresh data.

### CR-022: totalPlayed underreports in completion predictions [LOW]
- **File**: `src/components/statistics/completion-predictions.tsx` (lines 32-33)
- **Found**: Phase 4 hardening review
- **Resolved**: Phase 4 hardening
- **Issue**: `totalPlayed` was derived as `totalHltb - totalRemainingMinutes`. When a user played more than the HLTB estimate, `remaining` was clamped to 0 and `totalPlayed` equaled `totalHltb` instead of actual played time.
- **Fix**: Compute from `predictions.reduce((s, p) => s + p.playedMinutes, 0)` for accurate reporting.

### CR-020: Library sync errors silently swallowed [LOW]
- **File**: `src/app/api/steam/library/route.ts`
- **Found**: E2E testing session
- **Resolved**: Phase 4 (commit d64db15)
- **Fix**: Added `console.error("[Library Sync] Failed for user", userId, error)` in catch block

### CR-017: Auto-generate endpoint lacks rate limiting [MEDIUM]
- **File**: `src/app/api/sessions/auto-generate/route.ts`
- **Found**: Phase 3 review
- **Resolved**: Phase 4 (commit 0099307)
- **Fix**: Added per-user Redis rate limit (3 req/60s) via INCR/EXPIRE. Always sets TTL, wrapped in try-catch for Redis failure resilience.

### CR-013: DB-cached HLTB data never expires [LOW]
- **File**: `src/app/api/hltb/[appId]/route.ts`
- **Found**: Phase 2 review
- **Resolved**: Phase 4 (commit e0d6417)
- **Fix**: Added 30-day staleness check on `cachedAt` — re-fetches HLTB data when cache is older than 30 days or when `cachedAt` is null.

### CR-014: Timezone bug in session form dialog [HIGH]
- **File**: `src/components/schedule/session-form-dialog.tsx`
- **Found**: Phase 3 review
- **Resolved**: Phase 3 hardening
- **Fix**: Added `timezone` prop, use `fromZonedTime`/`toZonedTime` from date-fns-tz for correct local-to-UTC conversion

### CR-015: Incomplete cross-field validation in PATCH sessions [MEDIUM-HIGH]
- **File**: `src/app/api/sessions/[sessionId]/route.ts`
- **Found**: Phase 3 review
- **Resolved**: Phase 3 hardening
- **Fix**: Fetch existing session and validate merged start/end times when only one field is updated

### CR-016: Missing notes length validation [MEDIUM]
- **Files**: `src/app/api/sessions/route.ts`, `src/app/api/sessions/[sessionId]/route.ts`
- **Found**: Phase 3 review
- **Resolved**: Phase 3 hardening
- **Fix**: Added 2000 character limit on notes field in both POST and PATCH endpoints

### CR-018: Race condition in auto-generate clearExisting [MEDIUM]
- **File**: `src/app/api/sessions/auto-generate/route.ts`
- **Found**: Phase 3 review
- **Resolved**: E2E testing session (insert-before-delete)
- **History**: Originally fixed with `db.transaction()` in Phase 3. Regressed when Neon HTTP driver was discovered to not support transactions (CR-019). Re-fixed with insert-before-delete pattern: new sessions are inserted first, then old sessions are deleted by excluding new IDs via `notInArray`. This ensures data safety — if insert fails, old sessions remain intact.

### CR-019: Transaction removal reintroduced CR-018 race condition [HIGH]
- **File**: `src/app/api/sessions/auto-generate/route.ts`
- **Found**: E2E testing session code review
- **Resolved**: E2E testing session (same commit as CR-018 re-fix)
- **Issue**: Neon HTTP driver (`neon()` from `@neondatabase/serverless`) threw "No transactions support in neon-http driver" at runtime. Removing `db.transaction()` reintroduced the delete-before-insert race condition where delete succeeds but insert fails, losing all user sessions.
- **Fix**: Reversed operation order to insert-before-delete with `notInArray` exclusion. If insert fails, old sessions remain. If delete fails after insert, user has duplicates (much less harmful than data loss).

### CR-020: Library sync errors silently swallowed [LOW]
- **File**: `src/app/api/steam/library/route.ts` (line 69)
- **Found**: E2E testing session code review
- **Fix by**: Phase 4 (non-critical — endpoint still returns existing DB data)
- **Issue**: The catch block swallows all errors without logging. Partial sync failures (e.g., some games upserted, some failed) are invisible to operators.
- **Recommendation**: Add `console.error` or structured logging in the catch block.

### CR-006: Timezone validation accepts arbitrary strings [MEDIUM]
- **File**: `src/app/api/preferences/route.ts`
- **Found**: Phase 2 review
- **Resolved**: Pre-Phase 3 hardening
- **Fix**: Validated against `Intl.supportedValuesOf('timeZone')`

### CR-007: HLTB `cachedFetch` caches `null` results ineffectively [MEDIUM]
- **Files**: `src/lib/services/hltb.ts`, `src/lib/services/cache.ts`
- **Found**: Phase 2 review
- **Resolved**: Pre-Phase 3 hardening
- **Fix**: Added null sentinel pattern in `cachedFetch` — stores `{ __cacheNull: true }` for null values

### CR-009: Batch priority update fires N parallel requests [MEDIUM]
- **File**: `src/lib/hooks/use-priority.ts`
- **Found**: Phase 2 review
- **Resolved**: Pre-Phase 3 hardening
- **Fix**: Created `PATCH /api/games/batch` endpoint with single transaction, updated hook to use it

### CR-001: Library sync lacks transaction boundary [HIGH]
- **File**: `src/app/api/steam/library/route.ts`
- **Found**: Phase 1 review
- **Resolved**: Phase 2 hardening → E2E testing session (revised)
- **Fix**: Originally wrapped in `db.transaction()`. Revised to try-catch with sequential upserts + fallback to existing DB data, since Neon HTTP driver doesn't support transactions. Library sync uses idempotent `onConflictDoUpdate` upserts, so partial sync is safe — no data loss risk.

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
