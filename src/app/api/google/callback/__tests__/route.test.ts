import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockRedisGet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();
const mockExchangeCodeForTokens = vi.fn();
const mockGetUserEmail = vi.fn();
const mockCreateCalendar = vi.fn();
const mockDbInsertOnConflict = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/services/cache", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

vi.mock("@/lib/services/google-calendar", () => ({
  exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCodeForTokens(...args),
  getUserEmail: (...args: unknown[]) => mockGetUserEmail(...args),
  createCalendar: (...args: unknown[]) => mockCreateCalendar(...args),
}));

vi.mock("@/lib/db", () => {
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: (...args: unknown[]) => mockDbInsertOnConflict(...args),
  };
  return {
    db: {
      insert: () => insertChain,
    },
    userPreferences: { userId: "user_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { GET } from "../route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "csec";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";
  mockRedisIncr.mockResolvedValue(1);
  mockRedisExpire.mockResolvedValue(true);
});

describe("GET /api/google/callback", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/google/callback?code=c&state=s"));
    expect(res.status).toBe(401);
  });

  it("redirects with error when Google returns error param", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await GET(makeRequest("/api/google/callback?error=access_denied"));
    expect(res.headers.get("location")).toContain("googleError=consent_denied");
  });

  it("redirects with error when code or state missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await GET(makeRequest("/api/google/callback?code=c"));
    expect(res.headers.get("location")).toContain("googleError=missing_params");
  });

  it("redirects with error when state does not match", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue("stored-state");
    const res = await GET(makeRequest("/api/google/callback?code=c&state=wrong-state"));
    expect(res.headers.get("location")).toContain("googleError=invalid_state");
  });

  it("redirects with error when state is expired (null)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/google/callback?code=c&state=s"));
    expect(res.headers.get("location")).toContain("googleError=invalid_state");
  });

  it("redirects with error when env vars missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue("valid-state");
    mockRedisDel.mockResolvedValue(1);
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await GET(makeRequest("/api/google/callback?code=c&state=valid-state"));
    expect(res.headers.get("location")).toContain("googleError=config_missing");
  });

  it("redirects with error when token exchange fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue("valid-state");
    mockRedisDel.mockResolvedValue(1);
    mockExchangeCodeForTokens.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/google/callback?code=c&state=valid-state"));
    expect(res.headers.get("location")).toContain("googleError=token_exchange");
  });

  it("redirects with error when calendar creation fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue("valid-state");
    mockRedisDel.mockResolvedValue(1);
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
    });
    mockGetUserEmail.mockResolvedValue("user@gmail.com");
    mockCreateCalendar.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/google/callback?code=c&state=valid-state"));
    expect(res.headers.get("location")).toContain("googleError=calendar_create");
  });

  it("stores tokens and redirects to settings on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue("valid-state");
    mockRedisDel.mockResolvedValue(1);
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
    });
    mockGetUserEmail.mockResolvedValue("user@gmail.com");
    mockCreateCalendar.mockResolvedValue({ calendarId: "cal-123" });
    mockDbInsertOnConflict.mockResolvedValue(undefined);

    const res = await GET(makeRequest("/api/google/callback?code=c&state=valid-state"));
    expect(res.headers.get("location")).toContain("/settings?googleConnected=true");
    expect(mockDbInsertOnConflict).toHaveBeenCalledOnce();
    // State deleted immediately after validation, not at the end
    expect(mockRedisDel).toHaveBeenCalledWith("sbp:google-oauth-state:u1");
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisIncr.mockResolvedValue(6);
    const res = await GET(makeRequest("/api/google/callback?code=c&state=s"));
    expect(res.status).toBe(429);
  });

  it("allows request when Redis rate limit fails (fail-open)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisIncr.mockRejectedValue(new Error("Redis down"));
    mockRedisGet.mockResolvedValue("valid-state");
    mockRedisDel.mockResolvedValue(1);
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
    });
    mockGetUserEmail.mockResolvedValue("user@gmail.com");
    mockCreateCalendar.mockResolvedValue({ calendarId: "cal-123" });
    mockDbInsertOnConflict.mockResolvedValue(undefined);

    const res = await GET(makeRequest("/api/google/callback?code=c&state=valid-state"));
    expect(res.headers.get("location")).toContain("/settings?googleConnected=true");
  });

  it("calls exchangeCodeForTokens with correct params", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRedisGet.mockResolvedValue("valid-state");
    mockRedisDel.mockResolvedValue(1);
    mockExchangeCodeForTokens.mockResolvedValue(null);

    await GET(makeRequest("/api/google/callback?code=my-code&state=valid-state"));
    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith("my-code", "cid", "csec", "http://localhost:3000/api/google/callback");
  });
});
