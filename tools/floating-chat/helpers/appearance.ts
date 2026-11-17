// What the chat looks like, as one model its components draw from.
//
// The model comes from the assistant's appearance profile for this UI when it
// has one, and otherwise from the flat settings the launcher passes, which is
// how the chat has always been drawn.
//
// A profile is a list of elements. `root` is a `FloatingChat`, and each of its
// slots names another element, which may have slots of its own. A slot the
// profile leaves empty is a part the chat does not draw. `Messages` is a plain
// group of values, not a part: what a profile leaves out of it keeps its
// default.
//
// What a profile can hold is the UI's library, `appearance-library.json`:
// every component, what it takes, and each default. A profile is read against
// it here, so every value is checked for the shape its prop has before the
// chat draws it.
import library from '../appearance-library.json';
import {isRecord} from './embed-security';

type LibraryProp = {
  name: string;
  type: string;
  child_component?: string | null;
  options?: string[];
  length_max?: number | null;
  value_min?: number | null;
  value_max?: number | null;
  default?: unknown;
};

type LibraryComponent = {
  name: string;
  kind: string;
  is_root?: boolean;
  props: LibraryProp[];
};

const COMPONENTS: LibraryComponent[] = library.components;
const componentNamed = (
  name: string,
  components: LibraryComponent[] = COMPONENTS
) => components.find((component) => component.name === name);

export const FLOATING_CHAT_UI: string = library.ui;
const ROOT_ELEMENT = 'root';

export const APPEARANCE_LOAD_TIMEOUT_MS = 3000;

// The most characters of a text the chat draws, when its prop sets no limit.
const TEXT_MAX = 1000;
// The most elements taken from a profile a page gives in its own embed.
const EMBED_ELEMENTS_MAX = 50;

export type MessagesAppearance = {
  assistantBubbleColor: string;
  // null: the accent colour.
  guestBubbleColor: string | null;
  hasAvatars: boolean;
  hasFeedback: boolean;
  hasTimestamps: boolean;
};

export type FormFieldAppearance = {label: string; isRequired: boolean};

export type ContactFormAppearance = {
  // Whether the contact line offers the form.
  isOffered: boolean;
  title: string;
  // Each field is null when the form does not have it.
  firstName: FormFieldAppearance | null;
  lastName: FormFieldAppearance | null;
  email: FormFieldAppearance | null;
  message: FormFieldAppearance | null;
  sendLabel: string;
  sendingLabel: string;
  discardLabel: string;
  // What the three controls of the form say on hover.
  openHint: string;
  sendHint: string;
  discardHint: string;
  confirmation: string;
};

export type ContactAppearance = {
  // null: the assistant's own, from its settings.
  phone: string | null;
  email: string | null;
  // What the phone and the e-mail say on hover, before a copy and after one.
  firstCopyHint: string;
  copyHint: string;
  copiedNote: string;
  copyFailedNote: string;
  form: ContactFormAppearance | null;
};

export type BrandingAppearance = {
  text: string;
  name: string;
  // null: the name is not a link.
  linkUrl: string | null;
};

export type Appearance = {
  source: 'profile' | 'settings';
  accentColor?: string;
  // Each part is null when the chat does not draw it.
  header: {title: string; subtitle: string} | null;
  greeting: {text: string} | null;
  composer: {placeholder: string} | null;
  contact: ContactAppearance | null;
  branding: BrandingAppearance | null;
  // The example questions of the agent's card, offered before the guest
  // writes: how many at most.
  suggestions: {limit: number} | null;
  messages: MessagesAppearance;
};

// What the launcher draws of a profile. The launcher reads this in its own
// bundle; it is here for a page of this app that stands in for the launcher.
export type LauncherAppearance = {
  accentColor: string | null;
  side: 'left' | 'right';
  // null: the profile has no round button.
  button: {icon: 'outlined' | 'filled'; hasGreetingPreview: boolean} | null;
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
  // Whether the look offers the card's example questions. A card's chat
  // does; an inHotel chat drawn from its settings does not.
  suggestions?: boolean;
  // A card's name and description: the header's title and subtitle when
  // neither the page nor a profile gives them.
  agentName?: string;
  agentDescription?: string;
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

// An Assistant ID is a UUID. Older profile IDs are plain labels, and the read
// knows none of them.
export const isAssistantId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const isProfileCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value);

// A language tag the read resolves texts to. It takes a language and two more
// parts at most, so a longer tag is cut to that, and `_` is read as the `-` it
// stands for. `all` asks for every language at once, which the chat cannot
// draw.
export const localeTag = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const tag = value.trim().replace(/_/g, '-').split('-').slice(0, 3).join('-');
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/i.test(tag) &&
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

// Every value of a profile comes over the network, or from a page, so each is
// checked for the shape its prop has before the chat draws it.
const color = (value: unknown): string | null =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;

// Words in a language, cut to what their prop takes.
const words = (value: unknown, max?: number | null): string | null =>
  typeof value === 'string' && value.trim()
    ? value.slice(0, max || TEXT_MAX)
    : null;

// One value for every language: a number, an address, a name. Cut, it would
// be another one, so a value that is too long is not taken.
const single = (value: unknown, max?: number | null): string | null =>
  typeof value === 'string' && value.trim() && value.length <= (max || TEXT_MAX)
    ? value
    : null;

// Only an address of the web is a link, so no value can make the chat run a
// script when the guest follows it.
const webAddress = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null;
  try {
    return /^https?:$/.test(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
};

// The value a prop takes of what it is given, or null when that has not the
// shape of the prop's type.
const checked = (prop: LibraryProp, value: unknown): any => {
  switch (prop.type) {
    case 'text':
      return single(value, prop.length_max);
    case 'texts':
      return words(value, prop.length_max);
    case 'color':
      return color(value);
    case 'boolean':
      return typeof value === 'boolean' ? value : null;
    case 'number':
      return typeof value === 'number' &&
        isFinite(value) &&
        (typeof prop.value_min !== 'number' || value >= prop.value_min) &&
        (typeof prop.value_max !== 'number' || value <= prop.value_max)
        ? value
        : null;
    case 'option':
      return typeof value === 'string' && (prop.options || []).includes(value)
        ? value
        : null;
    default:
      return null;
  }
};

// The library's default for a prop. A default text is the English one.
const defaultOf = (prop: LibraryProp): any =>
  checked(
    prop,
    prop.type === 'texts' && isRecord(prop.default)
      ? prop.default.en
      : prop.default
  );

// The defaults of one component, by prop name. A slot has none.
const defaults = (name: string): {[prop: string]: any} =>
  componentNamed(name).props.reduce(
    (values, prop) => ({
      ...values,
      [prop.name]: prop.type === 'element' ? null : defaultOf(prop),
    }),
    {}
  );

const HEADER = defaults('Header');
const SUGGESTIONS = defaults('Suggestions');
const CONTACT = defaults('Contact');
const FORM = defaults('ContactForm');
const BRANDING = defaults('Branding');

export const DEFAULT_TITLE: string = HEADER.titles;
export const DEFAULT_SUBTITLE: string = HEADER.subtitles;
export const DEFAULT_PLACEHOLDER: string = defaults('Composer')
  .input_placeholders;
export const DEFAULT_FORM_TITLE: string = FORM.titles;
export const DEFAULT_FORM_CONFIRMATION: string = FORM.confirmations;
export const DEFAULT_ASSISTANT_BUBBLE_COLOR: string = defaults('Messages')
  .assistant_bubble_color;

// What a field of the contact form says when its element gives it no words:
// the field's own name, by the slot of the form it sits in.
const FIELD_NAMES = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  message: 'Message',
};

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

// One element as the chat reads it. `values` holds every prop of its
// component: what the profile gives when it has the prop's shape, else the
// library's default, else null. A slot holds the element it names, read the
// same way, or null. `given` holds only what the profile itself gave.
type Read = {
  component: string;
  values: {[prop: string]: any};
  given: {[prop: string]: any};
};

// The `root` of a profile read against a library, this UI's unless another is
// given, or null when the chat cannot start from it: no `root`, or a root
// that is not the library's.
export function readProfile(
  profile: unknown,
  components: LibraryComponent[] = COMPONENTS
): Read | null {
  const elements = elementsOf(profile);
  const named = (name: unknown) =>
    typeof name === 'string'
      ? elements.find((element) => element.name === name)
      : undefined;

  // `above` lists the elements this one sits in: none holds itself.
  const read = (element: ProfileElement, above: string[]): Read | null => {
    const component = componentNamed(element.component, components);
    if (!component) return null;
    const values = {};
    const given = {};

    component.props.forEach((prop) => {
      if (prop.type !== 'element') {
        given[prop.name] = checked(prop, element.values[prop.name]);
        values[prop.name] =
          given[prop.name] === null ? defaultOf(prop) : given[prop.name];
        return;
      }
      // A slot takes one component, or any when its prop names none; an
      // element of another is not what it names.
      const child = named(element.values[prop.name]);
      const fits =
        child &&
        above.indexOf(child.name) < 0 &&
        (!prop.child_component || child.component === prop.child_component);
      given[prop.name] = fits ? read(child, above.concat(child.name)) : null;
      values[prop.name] = given[prop.name];
    });

    return {component: component.name, values, given};
  };

  const root = named(ROOT_ELEMENT);
  const start = components.find((component) => component.is_root);
  return root && start && root.component === start.name
    ? read(root, [ROOT_ELEMENT])
    : null;
}

const messagesOf = (values: {[prop: string]: any}): MessagesAppearance => ({
  assistantBubbleColor: values.assistant_bubble_color,
  guestBubbleColor: values.guest_bubble_color,
  hasAvatars: values.has_avatars,
  hasFeedback: values.has_feedback,
  hasTimestamps: values.has_timestamps,
});

const brandingOf = (values: {[prop: string]: any}): BrandingAppearance => ({
  text: values.texts,
  name: values.name,
  linkUrl: webAddress(values.link_url),
});

export function settingsAppearance(settings: AppearanceSettings): Appearance {
  const {newMessagePlaceholder = DEFAULT_PLACEHOLDER} = settings;
  // A title the settings give is kept, even an empty one, as it always was.
  const title =
    settings.title !== undefined
      ? settings.title
      : settings.agentName || DEFAULT_TITLE;
  const subtitle =
    settings.subtitle !== undefined
      ? settings.subtitle
      : settings.agentDescription || DEFAULT_SUBTITLE;
  const field = (label: string): FormFieldAppearance => ({
    label,
    isRequired: true,
  });

  return {
    source: 'settings',
    accentColor: settings.primaryColor,
    header: {title, subtitle},
    greeting: settings.greeting ? {text: settings.greeting} : null,
    composer: {placeholder: newMessagePlaceholder},
    contact: {
      phone: null,
      email: null,
      // The line's first hint has always differed from the one after a copy,
      // and two of the form's hints from the words beside their buttons.
      firstCopyHint: 'Copy to clipboard',
      copyHint: CONTACT.copy_hints,
      copiedNote: CONTACT.copied_notes,
      copyFailedNote: CONTACT.copy_failed_notes,
      form: {
        isOffered: !!settings.shouldShowContactForm,
        title: DEFAULT_FORM_TITLE,
        firstName: field(FIELD_NAMES.first_name),
        lastName: field(FIELD_NAMES.last_name),
        email: field(FIELD_NAMES.email),
        message: field(FIELD_NAMES.message),
        sendLabel: FORM.send_labels,
        sendingLabel: FORM.sending_labels,
        discardLabel: FORM.discard_labels,
        openHint: DEFAULT_FORM_TITLE,
        sendHint: 'Send as email',
        discardHint: 'Discard message',
        confirmation: DEFAULT_FORM_CONFIRMATION,
      },
    },
    // Whether it shows is still the subscription plan's word.
    branding: brandingOf(BRANDING),
    suggestions: settings.suggestions ? {limit: SUGGESTIONS.limit} : null,
    messages: messagesOf(defaults('Messages')),
  };
}

// The contact form a profile describes, or null when it has no field: there
// would be nothing to send.
const formOf = (form: Read | null): ContactFormAppearance | null => {
  if (!form) return null;
  const field = (
    slot: keyof typeof FIELD_NAMES
  ): FormFieldAppearance | null => {
    const element: Read | null = form.values[slot];
    return (
      element && {
        label: element.values.labels || FIELD_NAMES[slot],
        isRequired: element.values.is_required,
      }
    );
  };
  const firstName = field('first_name');
  const lastName = field('last_name');
  const email = field('email');
  const message = field('message');
  if (!firstName && !lastName && !email && !message) return null;

  return {
    isOffered: true,
    title: form.values.titles,
    firstName,
    lastName,
    email,
    message,
    sendLabel: form.values.send_labels,
    sendingLabel: form.values.sending_labels,
    discardLabel: form.values.discard_labels,
    // What a control says on hover follows the words the profile gives it.
    openHint: form.values.titles,
    sendHint: form.values.send_labels,
    discardHint: form.values.discard_labels,
    confirmation: form.values.confirmations,
  };
};

// The model a profile describes, or null when the chat cannot start from it:
// no `root`, or a root that is not this UI's. It is the same for the
// assistant's own profile and for one a page gives in its embed: either lists
// every part, the branding line too, or leaves it out.
export function profileAppearance(
  profile: AppearanceProfile,
  settings: AppearanceSettings,
  explicit: string[]
): Appearance | null {
  const root = readProfile(profile);
  if (!root) return null;

  // What the page set in its own embed, when the launcher says it did.
  const own = (key: keyof AppearanceSettings): string | null => {
    const value = settings[key];
    return explicit.includes(key) && typeof value === 'string' && value
      ? value
      : null;
  };
  const header: Read | null = root.values.header;
  const greeting: Read | null = root.values.greeting;
  const composer: Read | null = root.values.composer;
  const contact: Read | null = root.values.contact;
  const branding: Read | null = root.values.branding;
  const suggestions: Read | null = root.values.suggestions;
  const messages: Read | null = root.values.messages;
  const greetingText =
    greeting && (own('greeting') || greeting.values.greetings);

  return {
    source: 'profile',
    // The last of the three is the colour the launcher resolved for its
    // button, so the window and the button are never of different colours.
    accentColor:
      own('primaryColor') || root.given.accent_color || settings.primaryColor,
    header: header && {
      title:
        own('title') ||
        header.given.titles ||
        settings.agentName ||
        header.values.titles,
      subtitle:
        own('subtitle') ||
        header.given.subtitles ||
        settings.agentDescription ||
        header.values.subtitles,
    },
    greeting: greetingText ? {text: greetingText} : null,
    composer: composer && {
      placeholder:
        own('newMessagePlaceholder') || composer.values.input_placeholders,
    },
    contact: contact && {
      phone: contact.values.phone,
      email: contact.values.email,
      firstCopyHint: contact.values.copy_hints,
      copyHint: contact.values.copy_hints,
      copiedNote: contact.values.copied_notes,
      copyFailedNote: contact.values.copy_failed_notes,
      form: formOf(contact.values.form),
    },
    branding: branding && brandingOf(branding.values),
    suggestions: suggestions && {limit: suggestions.values.limit},
    messages: messagesOf(messages ? messages.values : defaults('Messages')),
  };
}

// What the launcher draws of a profile, or null when the chat cannot start
// from it.
export function launcherAppearance(
  profile: AppearanceProfile
): LauncherAppearance | null {
  const root = readProfile(profile);
  if (!root) return null;
  const launcher: Read | null = root.values.launcher;

  return {
    accentColor: root.given.accent_color,
    side: root.values.screen_side,
    button: launcher && {
      icon: launcher.values.icon,
      hasGreetingPreview: launcher.values.has_greeting_preview,
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

// A text of a profile a page gives in its embed: one string for every
// language, or a map of languages. A map is read for the page's language,
// then its base language, then English, then any, as the API reads the texts
// of a profile it holds.
const textFor = (value: unknown, locale: string): unknown => {
  if (!isRecord(value)) return value;
  // A tag is matched whatever its case, and `_` is read as the `-` it
  // stands for.
  const plain = (tag: string) => tag.replace(/_/g, '-').toLowerCase();
  const tags = Object.keys(value);
  const wanted = [locale, locale.split('-')[0], 'en'].map(plain);
  const found = wanted
    .map((tag) => tags.find((key) => plain(key) === tag))
    .concat(tags)
    .find((key) => key !== undefined && words(value[key]) !== null);

  return found === undefined ? undefined : value[found];
};

// The profile a page gives in its own embed, as one the chat can draw: its
// texts read for the page's language. Null when it is not a profile. The page
// is trusted no more than the network: every value is still checked when the
// profile is read.
export function embedProfile(
  value: unknown,
  locale: unknown
): AppearanceProfile | null {
  const elements = elementsOf(value).slice(0, EMBED_ELEMENTS_MAX);
  if (!elements.length) return null;
  const language = localeTag(locale) || 'en';

  return {
    ui: FLOATING_CHAT_UI,
    code: 'embed',
    is_default: true,
    elements: elements.map((element) => {
      const component = componentNamed(element.component);
      const texts = component
        ? component.props.filter((prop) => prop.type === 'texts')
        : [];
      const values = {...element.values};
      texts.forEach((prop) => {
        if (prop.name in values)
          values[prop.name] = textFor(values[prop.name], language);
      });

      return {...element, values};
    }),
  };
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
