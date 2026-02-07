# Code Review Findings

Tracked issues from end-of-session code reviews. Fix before building on top of affected code.

## Open

### CR-013: DB-cached HLTB data never expires [LOW]
- **File**: `src/app/api/hltb/[appId]/route.ts` (line 34)
- **Found**: Phase 2 review
- **Fix by**: Phase 4 (low priority, data rarely changes)
- **Issue**: The HLTB route checks `game.hltbMainMinutes !== null` to return cached data, but never checks `cachedAt` freshness. Redis cache has 7-day TTL, but the DB-level cache is permanent.
- **Fix**: Add a staleness check (e.g., re-fetch if `cachedAt` older than 30 days).

### CR-017: Auto-generate endpoint lacks rate limiting [MEDIUM]
- **File**: `src/app/api/sessions/auto-generate/route.ts`
- **Found**: Phase 3 review
- **Fix by**: Phase 4 (before production deployment)
- **Issue**: The auto-generate endpoint can create 100+ sessions per request. No rate limiting exists to prevent abuse.
- **Fix**: Add rate limiting middleware or per-user throttling (e.g., max 1 auto-generate request per 10 seconds).

## Resolved

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
