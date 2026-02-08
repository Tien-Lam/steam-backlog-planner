const REQUIRED_VARS = [
  "STEAM_API_KEY",
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "LIVE_TEST_STEAM_ID",
] as const;

function validateEnv() {
  if (process.env.LIVE_TESTS !== "true") {
    throw new Error(
      "LIVE_TESTS=true is required. Run with: npm run test:live"
    );
  }

  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars for live tests: ${missing.join(", ")}\n` +
        "Ensure these are set in .env.local"
    );
  }
}

validateEnv();

export const liveConfig = {
  steamApiKey: process.env.STEAM_API_KEY!,
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.UPSTASH_REDIS_REST_URL!,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN!,
  steamId: process.env.LIVE_TEST_STEAM_ID!,
} as const;
