import { NextRequest, NextResponse } from "next/server";
import { getSteamLoginUrl } from "@/lib/auth/steam-provider";

export async function GET(req: NextRequest) {
  const returnTo = new URL("/api/auth/steam/callback", req.nextUrl.origin).toString();
  const steamUrl = getSteamLoginUrl(returnTo);
  return NextResponse.redirect(steamUrl);
}
