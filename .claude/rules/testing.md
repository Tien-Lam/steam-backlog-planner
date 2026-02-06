# Testing Rules

## Structure
- Tests live in `__tests__/` directories adjacent to source files
- Test files: `*.test.ts` or `*.test.tsx`
- Shared helpers: `src/lib/__tests__/helpers.ts`

## Test Helpers
- `makeLibraryGame(overrides)` — factory for LibraryGame test data
- `mockFetchResponse(data, ok?)` — creates mock Response objects

## Mocking Patterns

### Global fetch
```ts
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
```

### Upstash Redis
```ts
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() })),
}));
```

### Drizzle DB
Mock the chain pattern: `select().from().where().limit()` each returning `this`.

### Auth
```ts
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
}));
```

### next/image
```ts
vi.mock("next/image", () => ({
  default: (props) => <img {...props} />,
}));
```

### API Route params (App Router)
```ts
const params = Promise.resolve({ appId: "440" });
```

## Coverage Requirements
- Lines: 80%+
- Branches: 80%+
- Functions: 80%+
- Statements: 80%+
- Run `npm run test:coverage` to verify

## What NOT to test
- `src/components/ui/` (shadcn primitives)
- `src/lib/db/index.ts` (DB client initialization)
- `src/lib/auth/types.ts` (type declarations only)
- `src/lib/providers.tsx` (thin wrapper)
