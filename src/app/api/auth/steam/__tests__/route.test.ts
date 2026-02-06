import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/steam-provider", () => ({
  getSteamLoginUrl: vi.fn(
    () => "https://steamcommunity.com/openid/login?openid.mode=checkid_setup"
  ),
}));

import { GET } from "../route";

describe("GET /api/auth/steam", () => {
  it("redirects to Steam login URL", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/steam");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("steamcommunity.com/openid/login");
  });

  it("builds callback URL from request origin", async () => {
    const { getSteamLoginUrl } = await import("@/lib/auth/steam-provider");
    const req = new NextRequest("http://localhost:3000/api/auth/steam");
    await GET(req);
    expect(getSteamLoginUrl).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/steam/callback"
    );
  });
});
