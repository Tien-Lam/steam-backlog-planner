import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isValidDiscordWebhookUrl } from "@/lib/services/discord";

const DEFAULTS = {
  weeklyHours: 10,
  sessionLengthMinutes: 60,
  timezone: "UTC",
  discordWebhookUrl: null as string | null,
  discordNotificationsEnabled: false,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  if (!rows.length) {
    return NextResponse.json(DEFAULTS);
  }

  return NextResponse.json({
    weeklyHours: rows[0].weeklyHours ?? DEFAULTS.weeklyHours,
    sessionLengthMinutes: rows[0].sessionLengthMinutes ?? DEFAULTS.sessionLengthMinutes,
    timezone: rows[0].timezone ?? DEFAULTS.timezone,
    discordWebhookUrl: rows[0].discordWebhookUrl ?? DEFAULTS.discordWebhookUrl,
    discordNotificationsEnabled: rows[0].discordNotificationsEnabled ?? DEFAULTS.discordNotificationsEnabled,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { weeklyHours, sessionLengthMinutes, timezone, discordWebhookUrl, discordNotificationsEnabled } = body as {
    weeklyHours?: number;
    sessionLengthMinutes?: number;
    timezone?: string;
    discordWebhookUrl?: string | null;
    discordNotificationsEnabled?: boolean;
  };

  if (weeklyHours !== undefined) {
    if (typeof weeklyHours !== "number" || weeklyHours < 0 || weeklyHours > 168) {
      return NextResponse.json({ error: "weeklyHours must be 0-168" }, { status: 400 });
    }
  }

  if (sessionLengthMinutes !== undefined) {
    if (typeof sessionLengthMinutes !== "number" || sessionLengthMinutes < 15 || sessionLengthMinutes > 480) {
      return NextResponse.json({ error: "sessionLengthMinutes must be 15-480" }, { status: 400 });
    }
  }

  if (timezone !== undefined) {
    if (typeof timezone !== "string" || timezone.trim() === "") {
      return NextResponse.json({ error: "timezone must be a non-empty string" }, { status: 400 });
    }
    const validTimezones = Intl.supportedValuesOf("timeZone");
    if (!validTimezones.includes(timezone)) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
  }

  if (discordWebhookUrl !== undefined && discordWebhookUrl !== null) {
    if (typeof discordWebhookUrl !== "string" || !isValidDiscordWebhookUrl(discordWebhookUrl)) {
      return NextResponse.json({ error: "Invalid Discord webhook URL" }, { status: 400 });
    }
  }

  if (discordNotificationsEnabled !== undefined) {
    if (typeof discordNotificationsEnabled !== "boolean") {
      return NextResponse.json({ error: "discordNotificationsEnabled must be a boolean" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (weeklyHours !== undefined) updates.weeklyHours = weeklyHours;
  if (sessionLengthMinutes !== undefined) updates.sessionLengthMinutes = sessionLengthMinutes;
  if (timezone !== undefined) updates.timezone = timezone;
  if (discordWebhookUrl !== undefined) {
    updates.discordWebhookUrl = discordWebhookUrl;
    if (discordWebhookUrl === null) {
      updates.discordNotificationsEnabled = false;
    }
  }
  if (discordNotificationsEnabled !== undefined) updates.discordNotificationsEnabled = discordNotificationsEnabled;

  await db
    .insert(userPreferences)
    .values({
      userId: session.user.id,
      ...updates,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: updates,
    });

  return NextResponse.json({ success: true });
}
