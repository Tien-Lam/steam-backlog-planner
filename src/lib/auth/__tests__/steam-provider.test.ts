import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSteamLoginUrl, verifySteamLogin } from "../steam-provider";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getSteamLoginUrl", () => {
  it("returns URL starting with Steam OpenID endpoint", () => {
    const url = getSteamLoginUrl("http://localhost:3000/api/auth/steam/callback");
    expect(url).toContain("https://steamcommunity.com/openid/login");
  });

  it("includes return_to parameter", () => {
    const returnTo = "http://localhost:3000/api/auth/steam/callback";
    const url = getSteamLoginUrl(returnTo);
    expect(url).toContain(encodeURIComponent(returnTo));
  });

  it("includes required OpenID parameters", () => {
    const url = getSteamLoginUrl("http://localhost:3000/callback");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("openid.ns")).toBe("http://specs.openid.net/auth/2.0");
    expect(parsed.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(parsed.searchParams.get("openid.identity")).toBe(
      "http://specs.openid.net/auth/2.0/identifier_select"
    );
  });

  it("sets realm to origin of returnTo", () => {
    const url = getSteamLoginUrl("http://localhost:3000/api/auth/steam/callback");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("openid.realm")).toBe("http://localhost:3000");
  });
});

describe("verifySteamLogin", () => {
  it("returns steam ID on valid response", async () => {
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"),
    });
    const params = new URLSearchParams({
      "openid.mode": "id_res",
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198000000001",
    });
    const result = await verifySteamLogin(params);
    expect(result).toBe("76561198000000001");
  });

  it("returns null when validation fails", async () => {
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n"),
    });
    const params = new URLSearchParams({ "openid.mode": "id_res" });
    expect(await verifySteamLogin(params)).toBeNull();
  });

  it("returns null when claimed_id is missing", async () => {
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve("is_valid:true"),
    });
    const params = new URLSearchParams({ "openid.mode": "id_res" });
    expect(await verifySteamLogin(params)).toBeNull();
  });

  it("returns null when claimed_id format is invalid", async () => {
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve("is_valid:true"),
    });
    const params = new URLSearchParams({
      "openid.mode": "id_res",
      "openid.claimed_id": "https://steamcommunity.com/openid/invalid",
    });
    expect(await verifySteamLogin(params)).toBeNull();
  });

  it("sends POST with check_authentication mode", async () => {
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve("is_valid:true"),
    });
    const params = new URLSearchParams({
      "openid.mode": "id_res",
      "openid.claimed_id": "https://steamcommunity.com/openid/id/123",
    });
    await verifySteamLogin(params);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://steamcommunity.com/openid/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
    const body = mockFetch.mock.calls[0][1].body;
    expect(body).toContain("openid.mode=check_authentication");
  });
});
