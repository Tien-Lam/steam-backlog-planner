import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  isValidDiscordWebhookUrl,
  sendSessionCreatedEmbed,
  sendAutoGenerateEmbed,
  sendSessionCompletedEmbed,
  sendTestEmbed,
} from "../discord";

beforeEach(() => {
  mockFetch.mockReset();
});

const VALID_URL =
  "https://discord.com/api/webhooks/123456/abcdef";

describe("isValidDiscordWebhookUrl", () => {
  it("accepts valid discord.com webhook URL", () => {
    expect(isValidDiscordWebhookUrl(VALID_URL)).toBe(true);
  });

  it("accepts valid discordapp.com webhook URL", () => {
    expect(
      isValidDiscordWebhookUrl(
        "https://discordapp.com/api/webhooks/123/abc"
      )
    ).toBe(true);
  });

  it("rejects non-discord URL", () => {
    expect(isValidDiscordWebhookUrl("https://example.com/webhook")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidDiscordWebhookUrl("")).toBe(false);
  });

  it("rejects http (non-https)", () => {
    expect(
      isValidDiscordWebhookUrl("http://discord.com/api/webhooks/123/abc")
    ).toBe(false);
  });
});

describe("sendSessionCreatedEmbed", () => {
  it("sends embed with game info and thumbnail", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await sendSessionCreatedEmbed(VALID_URL, {
      gameName: "Half-Life 2",
      headerImageUrl: "https://img.steam.com/hl2.jpg",
      startTime: new Date("2025-03-15T18:00:00Z"),
      endTime: new Date("2025-03-15T19:00:00Z"),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(VALID_URL);
    const body = JSON.parse(opts.body);
    expect(body.embeds[0].title).toBe("Session Scheduled");
    expect(body.embeds[0].description).toBe("Half-Life 2");
    expect(body.embeds[0].thumbnail.url).toBe("https://img.steam.com/hl2.jpg");
    expect(body.embeds[0].fields).toHaveLength(2);
  });

  it("sends embed without thumbnail when headerImageUrl is null", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await sendSessionCreatedEmbed(VALID_URL, {
      gameName: "TF2",
      headerImageUrl: null,
      startTime: new Date("2025-03-15T18:00:00Z"),
      endTime: new Date("2025-03-15T19:00:00Z"),
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].thumbnail).toBeUndefined();
  });
});

describe("sendAutoGenerateEmbed", () => {
  it("sends embed with session count and games", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await sendAutoGenerateEmbed(VALID_URL, {
      sessionCount: 5,
      games: ["Half-Life 2", "Portal"],
      startDate: "2025-03-17",
      weeks: 2,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].title).toBe("Sessions Auto-Generated");
    expect(body.embeds[0].description).toContain("5 sessions");
    expect(body.embeds[0].description).toContain("2 weeks");
  });
});

describe("sendSessionCompletedEmbed", () => {
  it("sends embed with game name and thumbnail", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await sendSessionCompletedEmbed(VALID_URL, {
      gameName: "Portal",
      headerImageUrl: "https://img.steam.com/portal.jpg",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].title).toBe("Session Completed");
    expect(body.embeds[0].description).toBe("Portal");
    expect(body.embeds[0].thumbnail.url).toBe("https://img.steam.com/portal.jpg");
  });

  it("sends embed without thumbnail when null", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await sendSessionCompletedEmbed(VALID_URL, {
      gameName: "Portal",
      headerImageUrl: null,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].thumbnail).toBeUndefined();
  });
});

describe("sendTestEmbed", () => {
  it("sends test embed with footer", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await sendTestEmbed(VALID_URL);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].title).toBe("Steam Backlog Planner");
    expect(body.embeds[0].footer.text).toBe("Test notification");
  });
});

describe("postToWebhook error handling", () => {
  it("throws when Discord returns non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    await expect(sendTestEmbed(VALID_URL)).rejects.toThrow(
      "Discord webhook failed: 429"
    );
  });
});
