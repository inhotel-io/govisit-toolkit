// The agent the chat talks to, as its A2A agent card describes it.
//
// The card is the one input the chat needs: it says where messages go, what
// the agent is called, its picture, whether it streams its replies, and the
// questions it gives as examples. It can also carry the look of the chat, in
// an extension of its own.
//
// Everything in a card comes from whoever publishes it, so every value is
// checked before the chat uses it.
import {isRecord, isValidAssistantProfileId} from './embed-security';

export const AVATAR_LOAD_TIMEOUT_MS = 3000;
export const CARD_LOAD_TIMEOUT_MS = 5000;

// The A2A extension an agent publishes the look of its chat with. Its
// `params` is a profile: `{elements: [...]}`, as a page gives one.
export const APPEARANCE_EXTENSION =
  'https://floating-chat.govisit.ai/extensions/appearance/v1';

const TEXT_MAX = 255;
const DESCRIPTION_MAX = 1000;
const EXAMPLE_MAX = 200;
const EXAMPLES_MAX = 6;

export type AgentCard = {
  // The card's own address: the agent the chat is talking to.
  url: string;
  // Where messages are sent: the card's JSON-RPC address, or null when it has
  // none the chat may call.
  endpoint: string | null;
  name: string | null;
  description: string | null;
  iconUrl: string | null;
  // Whether the agent streams its replies.
  streaming: boolean;
  // The questions the card gives as examples of what to ask, six at most.
  examples: string[];
  // The look the card publishes, as it gives it: checked when it is read.
  appearance: unknown;
};

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

// A web address the chat may call: https, or http on this computer. A
// relative address is read against `base`.
export function webAddress(value: unknown, base?: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    const isWeb =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOOPBACK.test(url.hostname));
    return isWeb && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export const isAgentCardUrl = (value: unknown): boolean =>
  webAddress(value) !== null;

// Private, loopback and link-local IPv4 addresses, and 0.0.0.0/8.
const LOCAL_IPV4 = /^(0|10|127)\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./;

// Whether a host is on the guest's own computer or network: loopback,
// private and link-local addresses, and names only a local network resolves.
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || /\.(localhost|local)$/.test(host)) return true;
  if (LOCAL_IPV4.test(host)) return true;
  if (!host.startsWith('[')) return false;
  const ip = host.slice(1, -1);
  return (
    ip === '::1' ||
    ip === '::' ||
    /^f[cd]/.test(ip) ||
    /^fe[89ab]/.test(ip) ||
    ip.startsWith('::ffff:')
  );
}

// An address a card names. One on the guest's own computer or network is
// taken only from a card that is there itself: a card on the web cannot send
// the chat there.
const addressInCard = (value: unknown, cardUrl: string): string | null => {
  const address = webAddress(value, cardUrl);
  if (!address) return null;
  return isLocalHost(new URL(address).hostname) &&
    !isLocalHost(new URL(cardUrl).hostname)
    ? null
    : address;
};

// The inHotel profile ID an inHotel agent card's address names. Only the
// exact address is one: the inHotel backend is used for nothing else.
const INHOTEL_CARD = /^https:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.agents\.inhotel\.io\/\.well-known\/agent-card\.json$/i;

// The address of an inHotel agent's card.
export const inhotelCardUrl = (profileId: string): string =>
  `https://${profileId}.agents.inhotel.io/.well-known/agent-card.json`;

export function inhotelProfileOf(cardUrl: unknown): string | null {
  const match = typeof cardUrl === 'string' ? INHOTEL_CARD.exec(cardUrl) : null;
  return match && isValidAssistantProfileId(match[1]) ? match[1] : null;
}

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

// The card's JSON-RPC address: its own `url` when that is JSON-RPC, which it
// is when no other transport is named, else the JSON-RPC interface it lists.
const jsonRpcEndpoint = (
  card: Record<string, any>,
  cardUrl: string
): string | null => {
  const transport = card.preferredTransport;
  if (transport === undefined || transport === 'JSONRPC') {
    const own = addressInCard(card.url, cardUrl);
    if (own) return own;
  }
  const others = Array.isArray(card.additionalInterfaces)
    ? card.additionalInterfaces
    : [];
  const other = others.find(
    (item: unknown) => isRecord(item) && item.transport === 'JSONRPC'
  );
  return other ? addressInCard(other.url, cardUrl) : null;
};

const examplesOf = (skills: unknown): string[] => {
  const found: string[] = [];
  (Array.isArray(skills) ? skills : []).forEach((skill) => {
    const examples =
      isRecord(skill) && Array.isArray(skill.examples) ? skill.examples : [];
    examples.forEach((example: unknown) => {
      const question = text(example, EXAMPLE_MAX);
      if (question && found.indexOf(question) < 0) found.push(question);
    });
  });
  return found.slice(0, EXAMPLES_MAX);
};

const appearanceOf = (capabilities: unknown): unknown => {
  const extensions =
    isRecord(capabilities) && Array.isArray(capabilities.extensions)
      ? capabilities.extensions
      : [];
  const extension = extensions.find(
    (item: unknown) => isRecord(item) && item.uri === APPEARANCE_EXTENSION
  );
  return extension && extension.params !== undefined ? extension.params : null;
};

// What the chat takes of a card, or null when it is not one.
export function parseAgentCard(
  card: unknown,
  cardUrl: string
): AgentCard | null {
  if (!isRecord(card)) return null;
  const capabilities = isRecord(card.capabilities) ? card.capabilities : {};

  return {
    url: cardUrl,
    endpoint: jsonRpcEndpoint(card, cardUrl),
    name: text(card.name, TEXT_MAX),
    description: text(card.description, DESCRIPTION_MAX),
    iconUrl: addressInCard(card.iconUrl, cardUrl),
    streaming: capabilities.streaming === true,
    examples: examplesOf(card.skills),
    appearance: appearanceOf(card.capabilities),
  };
}

// Read a card from its address, without credentials. Null when the address
// is not one, or the card does not answer, or is not a card.
export async function readAgentCard(
  cardUrl: unknown,
  signal?: AbortSignal
): Promise<AgentCard | null> {
  const address = webAddress(cardUrl);
  if (!address) return null;
  try {
    const response = await fetch(address, {credentials: 'omit', signal});
    if (!response.ok) return null;
    return parseAgentCard(await response.json(), address);
  } catch {
    return null;
  }
}

// The picture of an inHotel agent, from the card at its fixed address.
export async function fetchAgentAvatar(
  profileId: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (!isValidAssistantProfileId(profileId)) return null;
  const cardUrl = inhotelCardUrl(profileId);
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
