import { vi, beforeAll, afterAll } from "vitest";
import { liveConfig } from "./config";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { LIVE_TEST_USER_ID, cleanupUserData } from "./helpers";

const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
}));

beforeAll(async () => {
  await db
    .insert(users)
    .values({
      id: LIVE_TEST_USER_ID,
      steamId: liveConfig.steamId,
      steamUsername: "LiveTestUser",
      avatarUrl: "https://example.com/avatar.jpg",
      profileUrl: `https://steamcommunity.com/profiles/${liveConfig.steamId}`,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        steamId: liveConfig.steamId,
        updatedAt: new Date(),
      },
    });
});

afterAll(async () => {
  await cleanupUserData();
  await db.delete(users).where(eq(users.id, LIVE_TEST_USER_ID));
});

export { mockAuth };
