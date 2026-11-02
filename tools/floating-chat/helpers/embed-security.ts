// Keep the window bridge and the agent URL at explicit, validated boundaries.
export const isRecord = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function httpOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveParentOrigin(
  configured: unknown,
  referrer: string
): string | null {
  const supplied =
    configured !== undefined && configured !== null && configured !== '';
  const configuredOrigin = httpOrigin(configured);
  const referrerOrigin = httpOrigin(referrer);
  if (supplied && !configuredOrigin) return null;
  if (configuredOrigin && referrerOrigin && configuredOrigin !== referrerOrigin)
    return null;
  return configuredOrigin || referrerOrigin;
}

export function isTrustedParentMessage(
  message: any,
  expectedOrigin: string | null | undefined,
  win: Window
): boolean {
  return (
    !!expectedOrigin &&
    !!message &&
    win.parent !== win &&
    message.source === win.parent &&
    message.origin === expectedOrigin &&
    isRecord(message.data) &&
    typeof message.data.event === 'string'
  );
}

// Profile IDs occupy exactly one DNS label in the existing inHotel adapter.
// UUIDs and existing label-shaped IDs remain supported; URL syntax is rejected.
export const isValidAssistantProfileId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);

export function agentEndpoint(profileId: unknown): string {
  if (!isValidAssistantProfileId(profileId))
    throw new Error('Invalid assistant profile ID');
  return `https://${profileId}.agents.inhotel.io/`;
}
