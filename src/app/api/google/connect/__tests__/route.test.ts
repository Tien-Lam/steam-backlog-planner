import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/services/cache", () => ({
  redis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisIncr.mockResolvedValue(1);
  mockRedisExpire.mockResolvedValue(true);
});

describe("GET /api/google/connect", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 503 when GOOGLE_CLIENT_ID not set", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_REDIRECT_URI;

    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("redirects to Google OAuth with correct params", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisSet.mockResolvedValue("OK");
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";

    const res = await GET();
    expect(res.status).toBe(307);
    const location = res.headers.get("location")!;
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("access_type=offline");
    expect(location).toContain("prompt=consent");
    expect(location).toContain("scope=");
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisIncr.mockResolvedValue(6);
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";

    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("allows request when Redis rate limit fails (fail-open)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisIncr.mockRejectedValue(new Error("Redis down"));
    mockRedisSet.mockResolvedValue("OK");
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";

    const res = await GET();
    expect(res.status).toBe(307);
  });

  it("stores state in Redis with 10-minute TTL", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisSet.mockResolvedValue("OK");
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";

    await GET();
    expect(mockRedisSet).toHaveBeenCalledWith(
      "sbp:google-oauth-state:u1",
      expect.any(String),
      { ex: 600 }
    );
  });
});
