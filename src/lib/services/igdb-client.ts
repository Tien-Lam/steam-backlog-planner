const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API_URL = "https://api.igdb.com/v4";
const FETCH_TIMEOUT = 10000;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET required");
  }

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!res.ok) {
    throw new Error(`Twitch token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

async function igdbPost<T>(endpoint: string, body: string): Promise<T> {
  const token = await getAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;

  const res = await fetch(`${IGDB_API_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!res.ok) {
    throw new Error(`IGDB API error: ${res.status}`);
  }

  return res.json();
}

interface ExternalGame {
  game: number;
}

export async function findGameBySteamAppId(
  steamAppId: number
): Promise<number | null> {
  const results = await igdbPost<ExternalGame[]>(
    "external_games",
    `fields game; where category = 1 & uid = "${steamAppId}"; limit 1;`
  );

  return results.length > 0 ? results[0].game : null;
}

export interface IGDBGameDetails {
  id: number;
  genres?: { name: string }[];
  aggregated_rating?: number;
  summary?: string;
  cover?: { url: string };
  first_release_date?: number;
}

export async function getGameDetails(
  igdbId: number
): Promise<IGDBGameDetails | null> {
  const results = await igdbPost<IGDBGameDetails[]>(
    "games",
    `fields genres.name, aggregated_rating, summary, cover.url, first_release_date; where id = ${igdbId}; limit 1;`
  );

  return results.length > 0 ? results[0] : null;
}

export function clearTokenCache(): void {
  cachedToken = null;
}
