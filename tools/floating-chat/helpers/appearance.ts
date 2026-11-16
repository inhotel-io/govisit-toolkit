// What the chat looks like, as one model its components draw from.
//
// The model comes from the assistant's appearance profile for this UI when it
// has one, and otherwise from the flat settings the launcher passes, which is
// how the chat has always been drawn.
//
// A profile is a list of elements. `root` is a `FloatingChat`, and each of its
// slots names another element. A slot the profile leaves empty is a block the
// chat does not draw. The `Messages` values are a plain group, not a block:
// what a profile leaves out of it keeps its default.
import {isRecord} from './embed-security';

export const FLOATING_CHAT_UI = 'floating_chat';
const ROOT_ELEMENT = 'root';
const ROOT_COMPONENT = 'FloatingChat';

export const APPEARANCE_LOAD_TIMEOUT_MS = 3000;

export const DEFAULT_TITLE = 'Welcome!';
export const DEFAULT_SUBTITLE = 'How can we help you?';
export const DEFAULT_PLACEHOLDER = 'Start typing...';
export const DEFAULT_FORM_TITLE = 'Contact Us';
export const DEFAULT_FORM_CONFIRMATION =
  'Thank you for your message! Please expect our reply within 1 working day.';
export const DEFAULT_ASSISTANT_BUBBLE_COLOR = '#F5F5F5';

export type MessagesAppearance = {
  assistantBubbleColor: string;
  // null: the accent colour.
  guestBubbleColor: string | null;
  hasAvatars: boolean;
  hasFeedback: boolean;
  hasTimestamps: boolean;
};

export type Appearance = {
  source: 'profile' | 'settings';
  accentColor?: string;
  // Each block is null, or false, when the chat does not draw it.
  header: {title: string; subtitle: string} | null;
  greeting: {text: string} | null;
  composer: {placeholder: string} | null;
  contact: {
    hasForm: boolean;
    formTitle: string;
    formConfirmation: string;
  } | null;
  branding: boolean;
  messages: MessagesAppearance;
};

// The flat settings, as the launcher resolves them from the embed's own
// configuration and the assistant's legacy widget settings.
export type AppearanceSettings = {
  title?: string;
  subtitle?: string;
  greeting?: string;
  newMessagePlaceholder?: string;
  primaryColor?: string;
  shouldShowContactForm?: boolean;
};

export type ProfileElement = {
  name: string;
  component: string;
  values: {[prop: string]: unknown};
};

// One item of `GET /api/v2/assistants/{id}/appearance-profiles`.
export type AppearanceProfile = {
  ui: string;
  code: string;
  is_default: boolean;
  elements: ProfileElement[];
};

const DEFAULT_MESSAGES: MessagesAppearance = {
  assistantBubbleColor: DEFAULT_ASSISTANT_BUBBLE_COLOR,
  guestBubbleColor: null,
  hasAvatars: true,
  hasFeedback: true,
  hasTimestamps: true,
};

// An Assistant ID is a UUID. Older profile IDs are plain labels, and the read
// knows none of them.
export const isAssistantId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const isProfileCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value);

// A language tag the read resolves texts to. `all` asks it for every language
// at once, which the chat cannot draw.
export const localeTag = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const tag = value.trim();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/i.test(tag) &&
    tag.toLowerCase() !== 'all'
    ? tag
    : null;
};

// The settings a page may put in its own embed. The launcher names the ones
// the page really set, and those stand in front of the profile.
const EMBED_KEYS = [
  'title',
  'subtitle',
  'greeting',
  'newMessagePlaceholder',
  'primaryColor',
];

export const embedKeys = (value: unknown): string[] =>
  typeof value === 'string'
    ? value.split(',').filter((key) => EMBED_KEYS.includes(key))
    : [];

// Every value of a profile comes over the network, so each is checked for the
// shape its prop has before the chat draws it.
const color = (value: unknown): string | null =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.slice(0, 1000) : null;

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const elementsOf = (profile: unknown): ProfileElement[] =>
  isRecord(profile) && Array.isArray(profile.elements)
    ? profile.elements
        .filter(
          (element) =>
            isRecord(element) &&
            typeof element.name === 'string' &&
            typeof element.component === 'string'
        )
        .map((element) => ({
          name: element.name,
          component: element.component,
          values: isRecord(element.values) ? element.values : {},
        }))
    : [];

export function settingsAppearance(settings: AppearanceSettings): Appearance {
  const {
    title = DEFAULT_TITLE,
    subtitle = DEFAULT_SUBTITLE,
    newMessagePlaceholder = DEFAULT_PLACEHOLDER,
  } = settings;

  return {
    source: 'settings',
    accentColor: settings.primaryColor,
    header: {title, subtitle},
    greeting: settings.greeting ? {text: settings.greeting} : null,
    composer: {placeholder: newMessagePlaceholder},
    contact: {
      hasForm: !!settings.shouldShowContactForm,
      formTitle: DEFAULT_FORM_TITLE,
      formConfirmation: DEFAULT_FORM_CONFIRMATION,
    },
    // Whether it shows is still the subscription plan's word.
    branding: true,
    messages: {...DEFAULT_MESSAGES},
  };
}

// The model a profile describes, or null when the chat cannot start from it:
// no `root`, or a root that is not this UI's.
export function profileAppearance(
  profile: AppearanceProfile,
  settings: AppearanceSettings,
  explicit: string[]
): Appearance | null {
  const elements = elementsOf(profile);
  const named = (name: unknown) =>
    typeof name === 'string'
      ? elements.find((element) => element.name === name)
      : undefined;
  const root = named(ROOT_ELEMENT);
  if (!root || root.component !== ROOT_COMPONENT) return null;

  // A slot takes one component; an element of another is not what it names.
  const slot = (prop: string, component: string) => {
    const element = named(root.values[prop]);
    return element && element.component === component ? element : null;
  };
  // What the page set in its own embed, when the launcher says it did.
  const own = (key: keyof AppearanceSettings): string | null => {
    const value = settings[key];
    return explicit.includes(key) && typeof value === 'string' && value
      ? value
      : null;
  };

  const header = slot('header', 'Header');
  const greeting = slot('greeting', 'Greeting');
  const composer = slot('composer', 'Composer');
  const contact = slot('contact', 'Contact');
  const messages = slot('messages', 'Messages');
  const look = messages ? messages.values : {};
  const greetingText =
    greeting && (own('greeting') || text(greeting.values.greetings));

  return {
    source: 'profile',
    accentColor:
      own('primaryColor') || color(root.values.accent_color) || undefined,
    header: header && {
      title: own('title') || text(header.values.titles) || DEFAULT_TITLE,
      subtitle:
        own('subtitle') || text(header.values.subtitles) || DEFAULT_SUBTITLE,
    },
    greeting: greetingText ? {text: greetingText} : null,
    composer: composer && {
      placeholder:
        own('newMessagePlaceholder') ||
        text(composer.values.input_placeholders) ||
        DEFAULT_PLACEHOLDER,
    },
    contact: contact && {
      hasForm: flag(contact.values.has_form, true),
      formTitle: text(contact.values.form_titles) || DEFAULT_FORM_TITLE,
      formConfirmation:
        text(contact.values.form_confirmations) || DEFAULT_FORM_CONFIRMATION,
    },
    branding: !!slot('branding', 'Branding'),
    messages: {
      assistantBubbleColor:
        color(look.assistant_bubble_color) || DEFAULT_ASSISTANT_BUBBLE_COLOR,
      guestBubbleColor: color(look.guest_bubble_color),
      hasAvatars: flag(look.has_avatars, true),
      hasFeedback: flag(look.has_feedback, true),
      hasTimestamps: flag(look.has_timestamps, true),
    },
  };
}

// The profile this UI draws, out of a page of the public read: the one the
// embed names, else the assistant's default. With neither the chat keeps its
// own look.
export function pickProfile(
  page: unknown,
  code?: unknown
): AppearanceProfile | null {
  const items: unknown[] =
    isRecord(page) && Array.isArray(page.items) ? page.items : [];
  const ours = items.filter(
    (item): item is AppearanceProfile =>
      isRecord(item) &&
      item.ui === FLOATING_CHAT_UI &&
      Array.isArray(item.elements)
  );

  return (
    (isProfileCode(code) && ours.find((item) => item.code === code)) ||
    ours.find((item) => item.is_default === true) ||
    null
  );
}

export function resolveAppearance(
  profile: AppearanceProfile | null,
  settings: AppearanceSettings,
  explicit: string[]
): Appearance {
  return (
    (profile && profileAppearance(profile, settings, explicit)) ||
    settingsAppearance(settings)
  );
}
