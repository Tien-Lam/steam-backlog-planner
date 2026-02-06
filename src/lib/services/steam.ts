const STEAM_API_BASE = "https://api.steampowered.com";

function apiKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error("STEAM_API_KEY is not set");
  return key;
}

export interface SteamPlayer {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatarfull: string;
  loccountrycode?: string;
  timecreated?: number;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url: string;
  rtime_last_played?: number;
  has_community_visible_stats?: boolean;
}

export interface SteamAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
  name?: string;
  description?: string;
}

export interface AchievementSchema {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  icongray: string;
}

export async function getPlayerSummary(
  steamId: string
): Promise<SteamPlayer | null> {
  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey()}&steamids=${steamId}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.response?.players?.[0] ?? null;
}

export async function getOwnedGames(
  steamId: string
): Promise<SteamGame[]> {
  const params = new URLSearchParams({
    key: apiKey(),
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    format: "json",
  });

  const res = await fetch(
    `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/?${params}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.response?.games ?? [];
}

export async function getPlayerAchievements(
  steamId: string,
  appId: number
): Promise<{ achievements: SteamAchievement[]; gameName: string } | null> {
  const params = new URLSearchParams({
    key: apiKey(),
    steamid: steamId,
    appid: appId.toString(),
    format: "json",
  });

  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/?${params}`
  );

  if (!res.ok) return null;

  const data = await res.json();
  const stats = data.playerstats;

  if (!stats?.success) return null;

  return {
    achievements: stats.achievements ?? [],
    gameName: stats.gameName ?? "",
  };
}

export async function getSchemaForGame(
  appId: number
): Promise<AchievementSchema[]> {
  const params = new URLSearchParams({
    key: apiKey(),
    appid: appId.toString(),
    format: "json",
  });

  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v0002/?${params}`
  );

  if (!res.ok) return [];

  const data = await res.json();
  return data.game?.availableGameStats?.achievements ?? [];
}

export function getGameHeaderUrl(appId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

export function getGameCapsuleUrl(appId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`;
}

export function getStorePage(appId: number): string {
  return `https://store.steampowered.com/app/${appId}`;
}
