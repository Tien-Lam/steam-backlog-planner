import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockSendTestEmbed = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  return {
    db: {
      select: () => selectChain,
    },
    userPreferences: { userId: "user_id", discordWebhookUrl: "discord_webhook_url" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
}));

vi.mock("@/lib/services/discord", () => ({
  isValidDiscordWebhookUrl: (url: string) =>
    /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url),
  sendTestEmbed: (...args: unknown[]) => mockSendTestEmbed(...args),
}));

vi.mock("@/lib/services/cache", () => ({
  redis: {
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisIncr.mockResolvedValue(1);
  mockRedisExpire.mockResolvedValue(1);
});

describe("POST /api/discord/test", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 400 when no webhook URL configured", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{ webhookUrl: null }]);
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it("returns 400 when no preferences row exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([]);
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it("sends test embed and returns success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
    ]);
    mockSendTestEmbed.mockResolvedValue(undefined);

    const res = await POST();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSendTestEmbed).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc"
    );
  });

  it("returns 502 when Discord webhook fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
    ]);
    mockSendTestEmbed.mockRejectedValue(new Error("Discord webhook failed: 429"));

    const res = await POST();
    expect(res.status).toBe(502);
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockRedisIncr.mockResolvedValue(4);

    const res = await POST();
    expect(res.status).toBe(429);
    expect(mockDbSelectLimit).not.toHaveBeenCalled();
  });

  it("allows request when Redis fails (fail-open)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockRedisIncr.mockRejectedValue(new Error("Redis down"));
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
    ]);
    mockSendTestEmbed.mockResolvedValue(undefined);

    const res = await POST();
    expect(res.status).toBe(200);
  });

  it("sets rate limit key with 1-hour TTL", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockRedisIncr.mockResolvedValue(1);
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
    ]);
    mockSendTestEmbed.mockResolvedValue(undefined);

    await POST();
    expect(mockRedisIncr).toHaveBeenCalledWith("sbp:ratelimit:discord-test:user-1");
    expect(mockRedisExpire).toHaveBeenCalledWith("sbp:ratelimit:discord-test:user-1", 3600);
  });
});
