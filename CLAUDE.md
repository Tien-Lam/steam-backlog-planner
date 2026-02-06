# Steam Backlog Planner

## Handover
Read `HANDOVER.md` at the repo root for full implementation history, completed work, and next steps. Update it at the end of each session with what was done.

## Stack
- **Framework**: Next.js 16 (App Router) + React 19
- **Auth**: next-auth v5 beta with Steam OpenID
- **Database**: Neon (Postgres) via Drizzle ORM
- **Cache**: Upstash Redis
- **UI**: shadcn/ui + Tailwind CSS v4
- **State**: TanStack Query + Zustand

## Commands
```bash
npm run dev          # Dev server
npm run build        # Production build
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report (80% threshold)
npm run lint         # ESLint
npm run db:push      # Push schema to DB
npm run db:generate  # Generate migrations
```

## Path Alias
`@/*` → `./src/*`

## Testing
- **Framework**: Vitest with jsdom
- **Colocated tests**: `__tests__/` directories next to source files
- **Pattern**: `src/**/__tests__/**/*.test.{ts,tsx}`
- **Coverage**: v8 provider, 80% thresholds (lines/branches/functions/statements)
- **Skip testing**: `src/components/ui/`, `src/lib/db/index.ts`, `src/lib/auth/types.ts`, `src/lib/providers.tsx`
- Every new module must have corresponding tests
- Mock all externals (fetch, Redis, DB, auth) — no real API calls in tests
- Run `npm run test:coverage` before merging to verify thresholds
- See `.claude/rules/testing.md` for detailed mocking recipes

### Vitest Gotchas
- `vi.mock` factories are **hoisted** — use `vi.hoisted()` for mock fns referenced inside factories
- To test inner callbacks (like `cachedFetch`'s fetcher), use `mockImplementation` that calls the arg
- React state updates in tests need `act()` wrapper when calling callbacks directly
- Mock chained Drizzle queries: each method returns `this`, terminal method returns mock data
- Next.js 16 route params are `Promise<{}>`: `{ params: Promise.resolve({ appId: "440" }) }`

## Session Workflow
1. Read `HANDOVER.md` at session start for context
2. Do the work
3. Run `npm test` and `npm run test:coverage` before committing
4. Run a code review on all changed files — check for security issues, missing error handling, logic bugs, and data integrity risks
5. Log new findings in `CODE_REVIEW.md` with severity, file locations, and a target fix-by milestone
6. Address any open findings that fall within the current session's scope (e.g., if building on affected code, fix it first)
7. Update `HANDOVER.md` with what was done

## Code Review Tracker
`CODE_REVIEW.md` at repo root. Open issues must be fixed before building on top of the affected code. When resolving an issue, move it to the "Resolved" section with the commit that fixed it.

## Conventions
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Branch naming: `feature/*`, `fix/*`, `chore/*`
- Prefer simple, direct solutions over abstractions
