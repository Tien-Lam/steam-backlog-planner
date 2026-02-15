import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userPreferences, scheduledSessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revokeToken } from "@/lib/services/google-calendar";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      accessToken: userPreferences.googleAccessToken,
      refreshToken: userPreferences.googleRefreshToken,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  if (rows[0]?.accessToken) {
    await revokeToken(rows[0].accessToken).catch(() => {});
  }
  if (rows[0]?.refreshToken) {
    await revokeToken(rows[0].refreshToken).catch(() => {});
  }

  await db
    .update(userPreferences)
    .set({
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleEmail: null,
      googleCalendarId: null,
      googleCalendarSyncEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(userPreferences.userId, session.user.id));

  await db
    .update(scheduledSessions)
    .set({ googleCalendarEventId: null })
    .where(eq(scheduledSessions.userId, session.user.id));

  return NextResponse.json({ success: true });
}
