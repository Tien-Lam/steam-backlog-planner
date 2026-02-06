import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifySteamLogin = vi.fn();
const mockSignIn = vi.fn();
const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/auth/steam-provider", () => ({
  verifySteamLogin: (...args: unknown[]) => mockVerifySteamLogin(...args),
}));

vi.mock("@/lib/auth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

import { GET } from "../route";

beforeEach(() => {
  mockVerifySteamLogin.mockReset();
  mockSignIn.mockReset();
  mockFetch.mockReset();
});

describe("GET /api/auth/steam/callback", () => {
  it("redirects to login with error when verification fails", async () => {
    mockVerifySteamLogin.mockResolvedValue(null);
    const req = new NextRequest(
      "http://localhost:3000/api/auth/steam/callback?openid.mode=id_res"
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=steam_auth_failed");
  });

  it("fetches Steam profile after successful verification", async () => {
    mockVerifySteamLogin.mockResolvedValue("76561198000000001");
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          response: {
            players: [
              {
                steamid: "76561198000000001",
                personaname: "TestUser",
                avatarfull: "https://avatar.url",
                profileurl: "https://profile.url",
              },
            ],
          },
        }),
    });
    mockSignIn.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost:3000/api/auth/steam/callback?openid.mode=id_res"
    );
    const res = await GET(req);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("GetPlayerSummaries")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("calls signIn with steam credentials", async () => {
    mockVerifySteamLogin.mockResolvedValue("123");
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          response: {
            players: [
              {
                steamid: "123",
                personaname: "Player",
                avatarfull: "https://av.url",
                profileurl: "https://pr.url",
              },
            ],
          },
        }),
    });
    mockSignIn.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost:3000/api/auth/steam/callback?openid.mode=id_res"
    );
    await GET(req);
    expect(mockSignIn).toHaveBeenCalledWith("steam", {
      steamId: "123",
      username: "Player",
      avatarUrl: "https://av.url",
      profileUrl: "https://pr.url",
      redirect: false,
    });
  });

  it("handles missing profile gracefully", async () => {
    mockVerifySteamLogin.mockResolvedValue("123");
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: { players: [] } }),
    });
    mockSignIn.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost:3000/api/auth/steam/callback?openid.mode=id_res"
    );
    const res = await GET(req);
    expect(mockSignIn).toHaveBeenCalledWith("steam", {
      steamId: "123",
      username: "123",
      avatarUrl: "",
      profileUrl: "",
      redirect: false,
    });
    expect(res.status).toBe(307);
  });

  it("handles null API key gracefully", async () => {
    const origKey = process.env.STEAM_API_KEY;
    delete process.env.STEAM_API_KEY;

    mockVerifySteamLogin.mockResolvedValue("123");
    mockSignIn.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost:3000/api/auth/steam/callback?openid.mode=id_res"
    );
    const res = await GET(req);
    expect(mockSignIn).toHaveBeenCalledWith("steam", expect.objectContaining({
      steamId: "123",
      username: "123",
    }));
    expect(res.status).toBe(307);

    process.env.STEAM_API_KEY = origKey;
  });
});
