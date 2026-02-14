import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isValidDiscordWebhookUrl, sendTestEmbed } from "@/lib/services/discord";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ webhookUrl: userPreferences.discordWebhookUrl })
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  const webhookUrl = rows[0]?.webhookUrl;
  if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
    return NextResponse.json(
      { error: "No valid Discord webhook URL configured" },
      { status: 400 }
    );
  }

  try {
    await sendTestEmbed(webhookUrl);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 502 }
    );
  }
}
