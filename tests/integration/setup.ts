import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { vi, beforeAll, afterEach, afterAll } from "vitest";
import * as schema from "@/lib/db/schema";

process.env.STEAM_API_KEY = "test-steam-api-key";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

let pglite: PGlite;

const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
}));

vi.mock("@/lib/services/cache", () => ({
  cachedFetch: vi.fn(
    async <T>(
      _category: string,
      _keyParts: (string | number)[],
      fetcher: () => Promise<T>
    ) => fetcher()
  ),
  getCached: vi.fn(async () => null),
  setCache: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = vi.fn(async () => null);
    set = vi.fn(async () => "OK");
    del = vi.fn(async () => 1);
  },
}));

vi.mock("@/lib/db", async () => {
  const schemaModule = await vi.importActual<typeof schema>("@/lib/db/schema");

  return {
    ...schemaModule,
    get db() {
      return (globalThis as Record<string, unknown>).__testDb;
    },
  };
});

const DDL = `
  CREATE TYPE game_status AS ENUM ('backlog', 'playing', 'completed', 'abandoned');

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    steam_id TEXT NOT NULL UNIQUE,
    steam_username TEXT NOT NULL,
    avatar_url TEXT,
    profile_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    weekly_hours INTEGER DEFAULT 10,
    session_length_minutes INTEGER DEFAULT 60,
    timezone TEXT DEFAULT 'UTC',
    discord_webhook_url TEXT,
    discord_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expiry TIMESTAMP,
    google_email TEXT,
    google_calendar_id TEXT,
    google_calendar_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE game_cache (
    steam_app_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    header_image_url TEXT,
    hltb_main_minutes INTEGER,
    hltb_extra_minutes INTEGER,
    hltb_completionist_minutes INTEGER,
    total_achievements INTEGER,
    cached_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE user_games (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    steam_app_id INTEGER NOT NULL,
    status game_status NOT NULL DEFAULT 'backlog',
    priority INTEGER DEFAULT 0,
    playtime_minutes INTEGER DEFAULT 0,
    last_played TIMESTAMP,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, steam_app_id)
  );

  CREATE TABLE user_achievements (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    steam_app_id INTEGER NOT NULL,
    achieved_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    last_synced TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, steam_app_id)
  );

  CREATE TABLE scheduled_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    steam_app_id INTEGER NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    google_calendar_event_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`;

beforeAll(async () => {
  pglite = new PGlite();
  await pglite.exec(DDL);

  const testDb = drizzle(pglite, { schema });
  (globalThis as Record<string, unknown>).__testDb = testDb;
});

afterEach(async () => {
  await pglite.exec(`
    TRUNCATE scheduled_sessions, user_achievements, user_games, user_preferences, game_cache, users CASCADE;
  `);
  vi.restoreAllMocks();
  mockAuth.mockReset();
});

afterAll(async () => {
  await pglite.close();
});

export { mockAuth };
