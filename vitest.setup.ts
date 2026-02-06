import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

process.env.STEAM_API_KEY = "test-steam-api-key";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
