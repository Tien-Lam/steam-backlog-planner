const DISCORD_WEBHOOK_PATTERN =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

const EMBED_COLOR = 0x1b2838; // Steam dark blue

export function isValidDiscordWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (
      parsed.hostname !== "discord.com" &&
      parsed.hostname !== "discordapp.com"
    )
      return false;
    return DISCORD_WEBHOOK_PATTERN.test(url);
  } catch {
    return false;
  }
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

async function postToWebhook(
  webhookUrl: string,
  embeds: DiscordEmbed[]
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}

export async function sendSessionCreatedEmbed(
  webhookUrl: string,
  data: {
    gameName: string;
    headerImageUrl: string | null;
    startTime: Date;
    endTime: Date;
  }
): Promise<void> {
  const embed: DiscordEmbed = {
    title: "Session Scheduled",
    description: data.gameName.slice(0, 256),
    color: EMBED_COLOR,
    fields: [
      {
        name: "Start",
        value: data.startTime.toISOString(),
        inline: true,
      },
      {
        name: "End",
        value: data.endTime.toISOString(),
        inline: true,
      },
    ],
  };
  if (data.headerImageUrl) {
    embed.thumbnail = { url: data.headerImageUrl };
  }
  await postToWebhook(webhookUrl, [embed]);
}

export async function sendAutoGenerateEmbed(
  webhookUrl: string,
  data: {
    sessionCount: number;
    games: string[];
    startDate: string;
    weeks: number;
  }
): Promise<void> {
  const embed: DiscordEmbed = {
    title: "Sessions Auto-Generated",
    description: `${data.sessionCount} sessions created for ${data.weeks} week${data.weeks > 1 ? "s" : ""}`,
    color: EMBED_COLOR,
    fields: [
      { name: "Start Date", value: data.startDate, inline: true },
      {
        name: "Games",
        value: (data.games.slice(0, 10).join(", ") || "None").slice(0, 1024),
      },
    ],
  };
  await postToWebhook(webhookUrl, [embed]);
}

export async function sendSessionCompletedEmbed(
  webhookUrl: string,
  data: {
    gameName: string;
    headerImageUrl: string | null;
  }
): Promise<void> {
  const embed: DiscordEmbed = {
    title: "Session Completed",
    description: data.gameName.slice(0, 256),
    color: EMBED_COLOR,
  };
  if (data.headerImageUrl) {
    embed.thumbnail = { url: data.headerImageUrl };
  }
  await postToWebhook(webhookUrl, [embed]);
}

export async function sendTestEmbed(webhookUrl: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: "Steam Backlog Planner",
    description: "Webhook connected successfully!",
    color: EMBED_COLOR,
    footer: { text: "Test notification" },
  };
  await postToWebhook(webhookUrl, [embed]);
}
