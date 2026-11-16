import {DEFAULT_BASE_URL} from './config';
import {
  AppearanceProfile,
  FLOATING_CHAT_UI,
  isAssistantId,
  localeTag,
  pickProfile,
} from './appearance';

// The most profiles the read gives at once. The named or the default profile
// is picked out of one page, so the page is as large as the read allows.
const PAGE_LIMIT = 200;

// Where an assistant's profiles for this UI are read. The service is fixed,
// like the agent's address: nothing in a frame's configuration moves it.
export function appearanceProfilesUrl(
  assistantId: string,
  locale: string | null
): string {
  const language = locale ? `&locale=${encodeURIComponent(locale)}` : '';

  return `${DEFAULT_BASE_URL}/api/v2/assistants/${assistantId.toLowerCase()}/appearance-profiles?ui=${FLOATING_CHAT_UI}&limit=${PAGE_LIMIT}${language}`;
}

// The profile the chat draws for this assistant: the one the embed names, else
// its default. Null when it has neither, or when the read does not answer; the
// chat then keeps the look its settings give it.
export async function fetchAppearanceProfile({
  assistantId,
  code,
  locale,
  signal,
}: {
  assistantId: unknown;
  code?: unknown;
  locale?: unknown;
  signal?: AbortSignal;
}): Promise<AppearanceProfile | null> {
  if (!isAssistantId(assistantId)) return null;
  try {
    const response = await fetch(
      appearanceProfilesUrl(assistantId, localeTag(locale)),
      {credentials: 'omit', signal}
    );
    if (!response.ok) return null;
    return pickProfile(await response.json(), code);
  } catch {
    return null;
  }
}
