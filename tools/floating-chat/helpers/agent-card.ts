export const AVATAR_LOAD_TIMEOUT_MS = 3000;

export async function fetchAgentAvatar(
  profileId: string,
  signal?: AbortSignal
): Promise<string | null> {
  // The profile occupies one DNS label; never accept a URL fragment as an ID.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(profileId)) return null;
  const cardUrl = `https://${profileId}.agents.inhotel.io/.well-known/agent-card.json`;
  try {
    const response = await fetch(cardUrl, {credentials: 'omit', signal});
    if (!response.ok) return null;
    const card = await response.json();
    if (!card || typeof card.iconUrl !== 'string' || !card.iconUrl.trim())
      return null;
    const url = new URL(card.iconUrl, response.url || cardUrl);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
