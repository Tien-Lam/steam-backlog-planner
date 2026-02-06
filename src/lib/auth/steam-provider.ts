const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";

export function getSteamLoginUrl(returnTo: string): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": new URL(returnTo).origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

export async function verifySteamLogin(
  params: URLSearchParams
): Promise<string | null> {
  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });

  const text = await response.text();
  if (!text.includes("is_valid:true")) {
    return null;
  }

  const claimedId = params.get("openid.claimed_id");
  if (!claimedId) return null;

  const match = claimedId.match(/\/id\/(\d+)$/);
  return match ? match[1] : null;
}
