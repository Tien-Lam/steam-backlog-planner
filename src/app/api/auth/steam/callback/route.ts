import { NextRequest, NextResponse } from "next/server";
import { verifySteamLogin } from "@/lib/auth/steam-provider";
import { signIn } from "@/lib/auth";

interface SteamPlayer {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
}

async function getSteamProfile(steamId: string): Promise<SteamPlayer | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
  );
  const data = await res.json();
  return data.response?.players?.[0] ?? null;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const steamId = await verifySteamLogin(params);

  if (!steamId) {
    return NextResponse.redirect(new URL("/login?error=steam_auth_failed", req.nextUrl.origin));
  }

  const profile = await getSteamProfile(steamId);

  await signIn("steam", {
    steamId,
    username: profile?.personaname ?? steamId,
    avatarUrl: profile?.avatarfull ?? "",
    profileUrl: profile?.profileurl ?? "",
    redirect: false,
  });

  return NextResponse.redirect(new URL("/", req.nextUrl.origin));
}
