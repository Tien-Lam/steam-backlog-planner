import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelectLimit = vi.fn();
const mockSendSessionCreated = vi.fn();
const mockSendAutoGenerate = vi.fn();
const mockSendSessionCompleted = vi.fn();

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
    userPreferences: { userId: "user_id", discordWebhookUrl: "discord_webhook_url", discordNotificationsEnabled: "discord_notifications_enabled" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
}));

vi.mock("../discord", () => ({
  isValidDiscordWebhookUrl: (url: string) =>
    /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url),
  sendSessionCreatedEmbed: (...args: unknown[]) => mockSendSessionCreated(...args),
  sendAutoGenerateEmbed: (...args: unknown[]) => mockSendAutoGenerate(...args),
  sendSessionCompletedEmbed: (...args: unknown[]) => mockSendSessionCompleted(...args),
}));

import {
  notifySessionCreated,
  notifyAutoGenerate,
  notifySessionCompleted,
} from "../discord-notify";

const WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifySessionCreated", () => {
  const data = {
    gameName: "TF2",
    headerImageUrl: null,
    startTime: new Date("2025-03-15T18:00:00Z"),
    endTime: new Date("2025-03-15T19:00:00Z"),
  };

  it("calls sendSessionCreatedEmbed when enabled with URL", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: WEBHOOK_URL, enabled: true },
    ]);
    mockSendSessionCreated.mockResolvedValue(undefined);

    await notifySessionCreated("user-1", data);
    expect(mockSendSessionCreated).toHaveBeenCalledWith(WEBHOOK_URL, data);
  });

  it("skips when disabled", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: WEBHOOK_URL, enabled: false },
    ]);
    await notifySessionCreated("user-1", data);
    expect(mockSendSessionCreated).not.toHaveBeenCalled();
  });

  it("skips when no webhook URL", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: null, enabled: true },
    ]);
    await notifySessionCreated("user-1", data);
    expect(mockSendSessionCreated).not.toHaveBeenCalled();
  });

  it("skips when no preferences row exists", async () => {
    mockDbSelectLimit.mockResolvedValue([]);
    await notifySessionCreated("user-1", data);
    expect(mockSendSessionCreated).not.toHaveBeenCalled();
  });

  it("skips when stored URL fails validation", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: "https://evil.com/api/webhooks/123/abc", enabled: true },
    ]);
    await notifySessionCreated("user-1", data);
    expect(mockSendSessionCreated).not.toHaveBeenCalled();
  });
});

describe("notifyAutoGenerate", () => {
  it("calls sendAutoGenerateEmbed when enabled", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: WEBHOOK_URL, enabled: true },
    ]);
    mockSendAutoGenerate.mockResolvedValue(undefined);

    const data = { sessionCount: 3, games: ["TF2"], startDate: "2025-03-17", weeks: 1 };
    await notifyAutoGenerate("user-1", data);
    expect(mockSendAutoGenerate).toHaveBeenCalledWith(WEBHOOK_URL, data);
  });
});

describe("notifySessionCompleted", () => {
  it("calls sendSessionCompletedEmbed when enabled", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: WEBHOOK_URL, enabled: true },
    ]);
    mockSendSessionCompleted.mockResolvedValue(undefined);

    const data = { gameName: "Portal", headerImageUrl: null };
    await notifySessionCompleted("user-1", data);
    expect(mockSendSessionCompleted).toHaveBeenCalledWith(WEBHOOK_URL, data);
  });

  it("skips when disabled", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { webhookUrl: WEBHOOK_URL, enabled: false },
    ]);
    await notifySessionCompleted("user-1", { gameName: "Portal", headerImageUrl: null });
    expect(mockSendSessionCompleted).not.toHaveBeenCalled();
  });
});
