const HLTB_BASE = "https://howlongtobeat.com";
const HLTB_FINDER_URL = `${HLTB_BASE}/api/finder`;
const HLTB_INIT_URL = `${HLTB_FINDER_URL}/init`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let cachedToken: string | null = null;
let tokenExpiry = 0;
const TOKEN_TTL_MS = 5 * 60 * 1000;

export interface HLTBSearchResult {
  game_id: number;
  game_name: string;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
  comp_all: number;
}

async function getAuthToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const res = await fetch(`${HLTB_INIT_URL}?t=${Date.now()}`, {
    headers: { "User-Agent": UA, Referer: HLTB_BASE },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string };
  cachedToken = data.token ?? null;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;
  return cachedToken;
}

export async function searchHLTB(
  gameName: string
): Promise<HLTBSearchResult[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const body = {
    searchType: "games",
    searchTerms: gameName.split(" ").filter((t) => t.length > 0),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: "",
        sortCategory: "popular",
        rangeCategory: "main",
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
        rangeYear: { min: "", max: "" },
        modifier: "",
      },
      users: { sortCategory: "postcount" },
      lists: { sortCategory: "follows" },
      filter: "",
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };

  const res = await fetch(HLTB_FINDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      Referer: HLTB_BASE,
      "x-auth-token": token,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const json = (await res.json()) as { data?: HLTBSearchResult[] };
  return json.data ?? [];
}

export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}
