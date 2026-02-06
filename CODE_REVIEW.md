# Code Review Findings

Tracked issues from end-of-session code reviews. Fix before building on top of affected code.

## Open

### CR-001: Library sync lacks transaction boundary [HIGH]
- **File**: `src/app/api/steam/library/route.ts` (lines 30-67)
- **Found**: Phase 1 review
- **Fix by**: Phase 2 start (before adding more DB write paths)
- **Issue**: Sequential DB inserts in a loop with no transaction. If any insert fails mid-loop, the database is left in an inconsistent state — partial game list written, no rollback, user sees success.
- **Fix**: Wrap the loop in a Drizzle transaction (`db.transaction(async (tx) => { ... })`), or switch to batch inserts. Return an appropriate error response on failure.

### CR-002: Steam API calls don't check response status [MEDIUM]
- **Files**: `src/lib/services/steam.ts` (lines 47-50, 65-68, 83-89, 109-115), `src/app/api/auth/steam/callback/route.ts` (lines 15-20)
- **Found**: Phase 1 review
- **Fix by**: Phase 2 start (before HLTB integration adds more external API calls)
- **Issue**: `fetch()` calls to Steam API don't check `res.ok` before calling `.json()`. If Steam returns 500/503, parsing the HTML error page as JSON throws an unhelpful error.
- **Fix**: Check `res.ok` after each fetch. Return `null` or throw a typed error on non-2xx responses so callers can handle gracefully.

### CR-003: Missing input validation on PATCH /api/games [MEDIUM]
- **File**: `src/app/api/games/route.ts` (lines 13-18)
- **Found**: Phase 1 review
- **Fix by**: Phase 2 start (before adding more mutation endpoints)
- **Issue**: `status` and `priority` from request body are cast via `as` but never validated. Invalid enum values or non-numeric priorities pass through to the DB query. Drizzle ORM prevents SQL injection, but garbage data still gets written.
- **Fix**: Validate `status` against the `gameStatusEnum` values and `priority` as a positive integer before using in the query. Return 400 on invalid input.

## Resolved

(none yet)
