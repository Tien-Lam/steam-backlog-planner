import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchHLTB, clearTokenCache } from "../hltb-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  clearTokenCache();
});

function mockJsonResponse(data: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(data), status: ok ? 200 : 500 };
}

describe("searchHLTB", () => {
  it("fetches auth token then searches", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({ token: "test-token" }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { game_id: 7231, game_name: "Portal 2", comp_main: 30000, comp_plus: 50000, comp_100: 80000, comp_all: 38000 },
          ],
        })
      );

    const results = await searchHLTB("Portal 2");

    expect(results).toHaveLength(1);
    expect(results[0].game_name).toBe("Portal 2");
    expect(results[0].comp_main).toBe(30000);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const searchCall = mockFetch.mock.calls[1];
    expect(searchCall[0]).toBe("https://howlongtobeat.com/api/finder");
    expect(searchCall[1].headers["x-auth-token"]).toBe("test-token");
  });

  it("returns empty array when auth token fails", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(null, false));

    const results = await searchHLTB("Some Game");
    expect(results).toEqual([]);
  });

  it("returns empty array when search fails", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({ token: "t" }))
      .mockResolvedValueOnce(mockJsonResponse(null, false));

    const results = await searchHLTB("Some Game");
    expect(results).toEqual([]);
  });

  it("caches auth token across calls", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({ token: "cached-token" }))
      .mockResolvedValueOnce(mockJsonResponse({ data: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ data: [] }));

    await searchHLTB("Game 1");
    await searchHLTB("Game 2");

    // 1 init + 2 search = 3 total (token cached)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("sends search terms as split words", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({ token: "t" }))
      .mockResolvedValueOnce(mockJsonResponse({ data: [] }));

    await searchHLTB("The Witcher 3");

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.searchTerms).toEqual(["The", "Witcher", "3"]);
  });

  it("returns empty array when response has no data field", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({ token: "t" }))
      .mockResolvedValueOnce(mockJsonResponse({}));

    const results = await searchHLTB("Game");
    expect(results).toEqual([]);
  });
});
