import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userPreferences } from "@/lib/db";
import { redis } from "@/lib/services/cache";
import {
  exchangeCodeForTokens,
  getUserEmail,
  createCalendar,
} from "@/lib/services/google-calendar";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/settings?googleError=consent_denied", req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?googleError=missing_params", req.url));
  }

  const stateKey = `sbp:google-oauth-state:${session.user.id}`;
  const storedState = await redis.get<string>(stateKey);
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/settings?googleError=invalid_state", req.url));
  }

  // Delete state immediately after validation to prevent reuse (CR-025)
  await redis.del(stateKey);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/settings?googleError=config_missing", req.url));
  }

  const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
  if (!tokens) {
    return NextResponse.redirect(new URL("/settings?googleError=token_exchange", req.url));
  }

  const email = await getUserEmail(tokens.accessToken);

  const calendar = await createCalendar(tokens.accessToken);
  if (!calendar) {
    return NextResponse.redirect(new URL("/settings?googleError=calendar_create", req.url));
  }

  const expiry = new Date(Date.now() + tokens.expiresIn * 1000);

  await db
    .insert(userPreferences)
    .values({
      userId: session.user.id,
      googleAccessToken: tokens.accessToken,
      googleRefreshToken: tokens.refreshToken,
      googleTokenExpiry: expiry,
      googleEmail: email,
      googleCalendarId: calendar.calendarId,
      googleCalendarSyncEnabled: true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken,
        googleTokenExpiry: expiry,
        googleEmail: email,
        googleCalendarId: calendar.calendarId,
        googleCalendarSyncEnabled: true,
        updatedAt: new Date(),
      },
    });

  return NextResponse.redirect(new URL("/settings?googleConnected=true", req.url));
}
