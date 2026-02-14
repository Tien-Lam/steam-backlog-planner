import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockSendTestEmbed = vi.fn();

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

import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
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
});
