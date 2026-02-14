import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  sendSessionCreatedEmbed,
  sendAutoGenerateEmbed,
  sendSessionCompletedEmbed,
} from "./discord";

async function getDiscordConfig(userId: string) {
  const rows = await db
    .select({
      webhookUrl: userPreferences.discordWebhookUrl,
      enabled: userPreferences.discordNotificationsEnabled,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (!rows.length) return null;
  const { webhookUrl, enabled } = rows[0];
  if (!enabled || !webhookUrl) return null;
  return webhookUrl;
}

export async function notifySessionCreated(
  userId: string,
  data: {
    gameName: string;
    headerImageUrl: string | null;
    startTime: Date;
    endTime: Date;
  }
): Promise<void> {
  const webhookUrl = await getDiscordConfig(userId);
  if (!webhookUrl) return;
  await sendSessionCreatedEmbed(webhookUrl, data);
}

export async function notifyAutoGenerate(
  userId: string,
  data: {
    sessionCount: number;
    games: string[];
    startDate: string;
    weeks: number;
  }
): Promise<void> {
  const webhookUrl = await getDiscordConfig(userId);
  if (!webhookUrl) return;
  await sendAutoGenerateEmbed(webhookUrl, data);
}

export async function notifySessionCompleted(
  userId: string,
  data: {
    gameName: string;
    headerImageUrl: string | null;
  }
): Promise<void> {
  const webhookUrl = await getDiscordConfig(userId);
  if (!webhookUrl) return;
  await sendSessionCompletedEmbed(webhookUrl, data);
}
