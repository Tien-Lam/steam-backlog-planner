import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  findGameBySteamAppId,
  getGameDetails,
  clearTokenCache,
} from "../igdb-client";

beforeEach(() => {
  vi.clearAllMocks();
  clearTokenCache();
  process.env.TWITCH_CLIENT_ID = "test-client-id";
  process.env.TWITCH_CLIENT_SECRET = "test-client-secret";
});

function tokenResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: "test-token", expires_in: 5000 }),
  };
}

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function failRes(status = 400) {
  return { ok: false, status, json: async () => ({ message: "fail" }) };
}

describe("findGameBySteamAppId", () => {
  it("returns IGDB game id for a Steam app", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([{ game: 1942 }]));

    const result = await findGameBySteamAppId(440);
    expect(result).toBe(1942);

    const [, igdbOpts] = mockFetch.mock.calls[1];
    expect(igdbOpts.body).toContain('uid = "440"');
    expect(igdbOpts.body).toContain("category = 1");
  });

  it("returns null when no match found", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([]));

    const result = await findGameBySteamAppId(99999);
    expect(result).toBeNull();
  });

  it("throws when Twitch token request fails", async () => {
    mockFetch.mockResolvedValueOnce(failRes(401));
    await expect(findGameBySteamAppId(440)).rejects.toThrow("Twitch token");
  });

  it("throws when IGDB API returns error", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(failRes(500));

    await expect(findGameBySteamAppId(440)).rejects.toThrow("IGDB API error");
  });

  it("reuses cached token on subsequent calls", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([{ game: 100 }]))
      .mockResolvedValueOnce(okJson([{ game: 200 }]));

    await findGameBySteamAppId(440);
    await findGameBySteamAppId(730);

    // Token endpoint called once, IGDB called twice
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const [firstUrl] = mockFetch.mock.calls[0];
    expect(firstUrl).toContain("twitch.tv");
  });

  it("throws when env vars missing", async () => {
    delete process.env.TWITCH_CLIENT_ID;
    await expect(findGameBySteamAppId(440)).rejects.toThrow(
      "TWITCH_CLIENT_ID"
    );
  });
});

describe("getGameDetails", () => {
  it("returns game details with all fields", async () => {
    mockFetch.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      okJson([
        {
          id: 1942,
          genres: [{ name: "Shooter" }, { name: "Action" }],
          aggregated_rating: 92.5,
          summary: "A great game",
          cover: { url: "//images.igdb.com/t_thumb/co1234.jpg" },
          first_release_date: 1256688000,
        },
      ])
    );

    const result = await getGameDetails(1942);
    expect(result).toEqual({
      id: 1942,
      genres: [{ name: "Shooter" }, { name: "Action" }],
      aggregated_rating: 92.5,
      summary: "A great game",
      cover: { url: "//images.igdb.com/t_thumb/co1234.jpg" },
      first_release_date: 1256688000,
    });
  });

  it("returns null when game not found", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([]));

    const result = await getGameDetails(99999);
    expect(result).toBeNull();
  });

  it("sends correct query for game id", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([{ id: 42 }]));

    await getGameDetails(42);
    const [url, opts] = mockFetch.mock.calls[1];
    expect(url).toContain("/games");
    expect(opts.body).toContain("where id = 42");
    expect(opts.body).toContain("genres.name");
    expect(opts.body).toContain("aggregated_rating");
    expect(opts.body).toContain("cover.url");
  });
});

describe("clearTokenCache", () => {
  it("forces new token fetch after clearing", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(okJson([]));

    await findGameBySteamAppId(440);
    clearTokenCache();
    await findGameBySteamAppId(440);

    // Token endpoint called twice (once before clear, once after)
    const tokenCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes("twitch.tv")
    );
    expect(tokenCalls).toHaveLength(2);
  });
});
