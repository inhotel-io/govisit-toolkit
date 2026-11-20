// Try every option of the floating chat's appearance, and see the chat change
// as you do. The controls are drawn from the UI's library,
// `appearance-library.json`, so a prop added there shows here by itself.
//
// The chat beside them is the real one, the page the launcher frames. Its
// read of the assistant's profile is answered with your draft, so it draws
// the draft as it draws a profile from the database. Nothing is written to
// the database, and what the chat would send from here, a message or the
// contact form, is stopped in the frame.
//
// The page can start from an inHotel assistant's profile, read from the public
// API, or from the look an agent's card publishes. It runs on a local server
// only.
import React, {useEffect, useRef, useState} from 'react';
import Head from 'next/head';
import library from '../appearance-library.json';
import {DEFAULT_BASE_URL, isDev} from '../helpers/config';
import {GOVISIT_BLUE_600} from '../helpers/theme';
import {guardedFetch} from '../helpers/playground';
import {
  APPEARANCE_EXTENSION,
  inhotelCardUrl,
  isAgentCardUrl,
  readAgentCard,
} from '../helpers/agent-card';
import {
  FLOATING_CHAT_UI,
  embedProfile,
  isAssistantId,
  launcherAppearance,
} from '../helpers/appearance';

type Values = {[prop: string]: any};
type Element = {name: string; component: string; values: Values};
type Draft = {code: string; elements: Element[]};
type Stored = {
  ui: string;
  code: string;
  is_default?: boolean;
  updated_at?: string;
  elements: Element[];
};
type Prop = {
  name: string;
  type: string;
  description?: string;
  child_component?: string;
  options?: string[];
  default?: any;
  length_max?: number;
  value_min?: number;
  value_max?: number;
};
type Component = {
  name: string;
  kind: string;
  is_root?: boolean;
  description?: string;
  props: Prop[];
};

const COMPONENTS: Component[] = library.components;
const componentNamed = (name: string) =>
  COMPONENTS.find((component) => component.name === name);
const ROOT = COMPONENTS.find((component) => component.is_root);

// The chat in the frame is no assistant's: its ID is no one's, so it has no
// agent to talk to and no history but the sample one.
const PREVIEW_INBOX = '00000000-0000-4000-8000-000000000000';
// The questions the preview's card gives, when no card was read.
const SAMPLE_QUESTIONS = [
  'When is breakfast?',
  'Is there parking?',
  'What is there to see nearby?',
];
const HISTORY_KEY = `inhotel_chat_history_${PREVIEW_INBOX}`;
// The version the launcher passes. Older ones are drawn without the close
// control.
const CHAT_VERSION = '1.2.0';
const DEV_BADGE_HIDDEN =
  '#__next-prerender-indicator { display: none !important; }';

const isTextMap = (value: unknown): value is {[locale: string]: string} =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// `first_name` as a label: "First name".
const labelOf = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');

// A text in one language, falling back to English and then to any, as the
// API's read does.
const textIn = (map: unknown, locale: string): string => {
  if (typeof map === 'string') return map;
  if (!isTextMap(map)) return '';
  const candidates = [map[locale], map[locale.split('-')[0]], map.en].concat(
    Object.keys(map).map((key) => map[key])
  );
  return candidates.find((value) => typeof value === 'string' && !!value) || '';
};

const named = (draft: Draft, name: unknown): Element | undefined =>
  typeof name === 'string'
    ? draft.elements.find((element) => element.name === name)
    : undefined;

// The element a slot holds, when it is one the slot takes.
const heldBy = (draft: Draft, element: Element, prop: Prop) => {
  const child = named(draft, element.values[prop.name]);
  return child &&
    child.name !== element.name &&
    (!prop.child_component || child.component === prop.child_component)
    ? child
    : undefined;
};

// The elements the root reaches, in the order the chat reads them: what the
// profile holds once it is saved.
const reached = (draft: Draft): Element[] => {
  const out: Element[] = [];
  const visit = (element?: Element) => {
    if (!element || out.indexOf(element) >= 0) return;
    out.push(element);
    const component = componentNamed(element.component);
    if (!component) return;
    component.props
      .filter((prop) => prop.type === 'element')
      .forEach((prop) => visit(heldBy(draft, element, prop)));
  };
  visit(named(draft, 'root'));
  return out;
};

// A new element for a slot, with one for each slot of its own, so a part
// that is switched on comes whole.
const grow = (draft: Draft, slot: string, componentName: string): Element => {
  let name = slot;
  for (let n = 2; named(draft, name); n++) name = `${slot}_${n}`;
  const element: Element = {name, component: componentName, values: {}};
  draft.elements.push(element);
  const component = componentNamed(componentName);
  (component ? component.props : [])
    .filter((prop) => prop.type === 'element' && prop.child_component)
    .forEach((prop) => {
      element.values[prop.name] = grow(
        draft,
        prop.name,
        prop.child_component
      ).name;
    });
  return element;
};

// For an assistant with no profile for this UI: every part, as the library's
// defaults draw it.
const blankDraft = (): Draft => {
  const draft: Draft = {code: 'default', elements: []};
  grow(draft, 'root', ROOT.name);
  return draft;
};

// A profile as the public read gives it, without the values that are only
// the library's defaults filled in: the draft then holds what was really set.
const withoutDefaults = (elements: Element[]): Element[] =>
  elements.map((element) => {
    const component = componentNamed(element.component);
    const values: Values = {};
    Object.keys(element.values || {}).forEach((name) => {
      const prop = component && component.props.find((p) => p.name === name);
      const value = element.values[name];
      if (value === null || value === undefined) return;
      if (prop && prop.default !== undefined && same(value, prop.default))
        return;
      values[name] = value;
    });
    return {name: element.name, component: element.component, values};
  });

const sampleHistory = (greeting: string) => {
  const ago = (minutes: number) =>
    new Date(Date.now() - minutes * 60000).toISOString();
  const messages = [];
  if (greeting)
    messages.push({
      role: 'assistant',
      type: 'bot',
      content: greeting,
      timestamp: ago(3),
    });
  messages.push(
    {
      role: 'user',
      type: 'customer',
      content: 'Is there parking at the hotel?',
      timestamp: ago(2),
    },
    {
      role: 'assistant',
      type: 'agent',
      content:
        'Yes, there is parking for guests. You can book a place at the reception.',
      timestamp: ago(1),
    }
  );
  return {messages, sessionId: 'appearance-playground', timestamp: Date.now()};
};

// The guard goes in front of the frame's own `fetch`, once for each time the
// frame loads.
function guardFrame(
  win: any,
  answer: (url: string) => unknown,
  card: (url: string) => unknown
) {
  if (!win || !win.fetch || win.__appearancePlayground) return;
  win.__appearancePlayground = true;
  // The dev server's badge would sit on the contact line.
  const style = win.document.createElement('style');
  style.textContent = DEV_BADGE_HIDDEN;
  win.document.head.appendChild(style);
  win.fetch = guardedFetch(win, answer, card);
}

export default function AppearancePlayground() {
  const [isLocal, setLocal] = useState(true);
  const [assistantId, setAssistantId] = useState('');
  const [profiles, setProfiles] = useState<Stored[]>([]);
  const [stored, setStored] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('');
  const [locale, setLocale] = useState('en');
  const [newLocale, setNewLocale] = useState('');
  const [sample, setSample] = useState(true);
  const [hotelEmail, setHotelEmail] = useState('hotel@example.com');
  const [hotelPhone, setHotelPhone] = useState('+1 555 0100');
  // The questions of the card the playground started from, for the preview.
  const [questions, setQuestions] = useState<string[]>(SAMPLE_QUESTIONS);
  const [isOpen, setOpen] = useState(true);
  // A frame keeps the address it was made with: a new address would load it
  // again. Later languages reach it by message.
  const [frame, setFrame] = useState({key: 0, ready: false, locale: 'en'});
  // What the frame that is loaded now was loaded with: see `conversation`.
  const [loadedWith, setLoadedWith] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const parked = useRef<{[slot: string]: string}>({});
  // Each change of the draft is read by the chat under a new profile code.
  const turn = useRef(0);
  // The frame that is loaded now, and the timer that shows it.
  const frameKey = useRef(0);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  frameKey.current = frame.key;

  // The profile as it is saved and as the chat is given it: the elements in
  // use, each with the values it was given.
  const profile = draft ? {elements: reached(draft)} : null;
  const look = profile
    ? launcherAppearance(embedProfile(profile, locale))
    : null;
  const accent = (look && look.accentColor) || GOVISIT_BLUE_600;
  const side = look && look.side === 'left' ? 'left' : 'right';
  const button = look ? look.button : null;
  const wantsPreview = !!button && button.hasGreetingPreview;

  // What the frame is told is read from `live`, so a handler set up once
  // still tells it the current values.
  const live = useRef({
    isOpen,
    locale,
    hotelEmail,
    hotelPhone,
    profile,
    questions,
  });
  live.current = {isOpen, locale, hotelEmail, hotelPhone, profile, questions};

  const start = (from: Draft, said: string) => {
    parked.current = {};
    setStored(from);
    setDraft(JSON.parse(JSON.stringify(from)));
    setStatus(said);
  };

  // Start from the look an agent's card publishes.
  const loadCard = (address: string) => {
    setStatus('Reading the card…');
    readAgentCard(address).then((card) => {
      if (!card) {
        setStatus('The card could not be read.');
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('assistant', address);
      window.history.replaceState(null, '', url.toString());
      setProfiles([]);
      setQuestions(card.examples.length ? card.examples : SAMPLE_QUESTIONS);
      const given = card.appearance as any;
      const elements =
        given && Array.isArray(given.elements) ? given.elements : null;
      const name = card.name || 'this agent';
      if (!elements || !elements.length) {
        start(
          blankDraft(),
          `The card of ${name} publishes no look, so this starts from the library’s defaults.`
        );
        return;
      }
      start(
        {code: 'card', elements: JSON.parse(JSON.stringify(elements))},
        `The look the card of ${name} publishes.`
      );
    });
  };

  const load = (id: string, code?: string) => {
    const given = id.trim();
    if (isAgentCardUrl(given)) {
      loadCard(given);
      return;
    }
    const assistant = given.toLowerCase();
    if (!isAssistantId(assistant)) {
      setStatus('Give an Assistant ID, or the address of an agent card.');
      return;
    }
    setQuestions(SAMPLE_QUESTIONS);
    setStatus('Reading the profile…');
    fetch(
      `${DEFAULT_BASE_URL}/api/v2/assistants/${assistant}/appearance-profiles?ui=${FLOATING_CHAT_UI}&locale=all&limit=200`,
      {credentials: 'omit'}
    )
      .then((response) => {
        if (!response.ok)
          throw new Error(`the read answered ${response.status}`);
        return response.json();
      })
      .then((page) => {
        const items: Stored[] = (page && Array.isArray(page.items)
          ? page.items
          : []
        ).filter(
          (item: any) =>
            item && item.ui === FLOATING_CHAT_UI && Array.isArray(item.elements)
        );
        const chosen =
          items.find((item) => item.code === code) ||
          items.find((item) => item.is_default === true) ||
          items[0];
        const url = new URL(window.location.href);
        url.searchParams.set('assistant', assistant);
        window.history.replaceState(null, '', url.toString());
        setProfiles(items);
        if (!chosen) {
          start(
            blankDraft(),
            'This assistant has no profile for the floating chat, so this starts from the library’s defaults.'
          );
          return;
        }
        start(
          {code: chosen.code, elements: withoutDefaults(chosen.elements)},
          `Profile “${chosen.code}” as the database has it${
            chosen.updated_at
              ? `, last changed ${chosen.updated_at
                  .replace('T', ' ')
                  .replace('Z', ' UTC')}`
              : ''
          }.`
        );
      })
      .catch((error) =>
        setStatus(`Could not read the profile: ${error.message}.`)
      );
  };

  useEffect(() => {
    if (!isDev(window)) {
      setLocal(false);
      return;
    }
    const id = new URLSearchParams(window.location.search).get('assistant');
    if (id) {
      setAssistantId(id);
      load(id);
    } else {
      start(
        blankDraft(),
        'Every part, as the library’s defaults draw it. Give an Assistant ID, or an agent card’s address, to start from its look.'
      );
    }
  }, []);

  // Changes, each on a copy of the draft.
  const change = (mutate: (next: Draft) => void) =>
    setDraft((current) => {
      if (!current) return current;
      const next: Draft = JSON.parse(JSON.stringify(current));
      mutate(next);
      return next;
    });

  // `undefined` takes the value away, and the library's default applies.
  const setValue = (name: string, prop: string, value: unknown) =>
    change((next) => {
      const element = named(next, name);
      if (!element) return;
      if (value === undefined) delete element.values[prop];
      else element.values[prop] = value;
    });

  const setText = (name: string, prop: string, text: string) =>
    change((next) => {
      const element = named(next, name);
      if (!element) return;
      const map = isTextMap(element.values[prop]) ? element.values[prop] : {};
      if (text) map[locale] = text;
      else delete map[locale];
      if (Object.keys(map).length) element.values[prop] = map;
      else delete element.values[prop];
    });

  // A slot switched off keeps its element aside, so switching it on again
  // brings the same one back.
  const setSlot = (name: string, prop: Prop, on: boolean) =>
    change((next) => {
      const element = named(next, name);
      if (!element) return;
      const key = `${name}.${prop.name}`;
      if (!on) {
        const held = heldBy(next, element, prop);
        if (held) parked.current[key] = held.name;
        delete element.values[prop.name];
        return;
      }
      const back = named(next, parked.current[key]);
      element.values[prop.name] =
        back && back.component === prop.child_component
          ? back.name
          : grow(next, prop.name, prop.child_component).name;
    });

  // The frame.
  const post = (event: string, payload: unknown) => {
    const win = frameRef.current && frameRef.current.contentWindow;
    if (win) win.postMessage({event, payload}, window.location.origin);
  };

  // The chat reads its profile again when the code it is told changes, and
  // the read is answered with the draft, in the language the chat asks for.
  const push = () => {
    turn.current += 1;
    const {locale, hotelEmail, hotelPhone} = live.current;
    post('config:update', {
      appearanceProfile: `draft${turn.current}`,
      locale,
      hotelEmail,
      hotelPhone,
    });
  };

  const guard = () =>
    guardFrame(
      frameRef.current && frameRef.current.contentWindow,
      (url) => {
        const asked = new URL(url).searchParams.get('locale') || 'en';
        const read = embedProfile(live.current.profile, asked);
        return {
          items: read ? [{...read, code: `draft${turn.current}`}] : [],
          next_cursor: null,
          limit: 200,
        };
      },
      // The chat reads its agent's card for the questions it offers.
      (url) =>
        url === inhotelCardUrl(PREVIEW_INBOX)
          ? {
              name: 'Preview',
              skills: [{id: 'preview', examples: live.current.questions}],
            }
          : undefined
    );

  // The chat says when it has loaded; until then it hears nothing. It is
  // shown a moment later, drawn from the draft, if it is still the frame that
  // is loaded then.
  const onChatLoaded = () => {
    guard();
    push();
    const loaded = frameKey.current;
    if (readyTimer.current) clearTimeout(readyTimer.current);
    readyTimer.current = setTimeout(
      () =>
        setFrame((current) =>
          current.key === loaded ? {...current, ready: true} : current
        ),
      300
    );
  };

  useEffect(() => {
    if (frame.ready) push();
  }, [draft, locale, hotelEmail, hotelPhone, frame.ready]);

  // Open, the chat shows its window. Closed, it shows the greeting above the
  // button when the profile's button asks for that.
  useEffect(() => {
    if (!frame.ready) return;
    post('inhotel:toggle', {isOpen});
    post('notifications:display', {
      shouldDisplayNotifications: !isOpen && wantsPreview,
      popUpInitialMessage: !isOpen && wantsPreview,
    });
  }, [isOpen, wantsPreview, frame.ready]);

  useEffect(() => {
    const onMessage = (message: MessageEvent) => {
      const win = frameRef.current && frameRef.current.contentWindow;
      if (!win || message.source !== win || !message.data) return;
      if (message.data.event === 'chat:loaded') onChatLoaded();
      if (message.data.event === 'inhotel:close') setOpen(false);
      if (message.data.event === 'inhotel:open') setOpen(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The sample conversation is history the chat restores when it loads, so a
  // change to it, or to the greeting it starts with, loads the chat again.
  const root = draft ? named(draft, 'root') : undefined;
  const greetingProp = ROOT.props.find((prop) => prop.name === 'greeting');
  const greetingElement =
    draft && root && greetingProp
      ? heldBy(draft, root, greetingProp)
      : undefined;
  const greeting = greetingElement
    ? textIn(greetingElement.values.greetings, locale)
    : '';
  // What the chat is loaded with. Without the sample, nothing of it matters.
  const conversation = draft
    ? JSON.stringify(sample ? [greeting, locale] : null)
    : null;
  useEffect(() => {
    if (conversation === null || conversation === loadedWith) return;
    // One frame loads at a time. A frame taken away while it is still
    // loading can bring the whole page down, so one that is loading is left
    // to finish, and the chat is loaded again after it.
    if (frame.key > 0 && !frame.ready) return;
    const timer = setTimeout(
      () => {
        try {
          if (sample)
            localStorage.setItem(
              HISTORY_KEY,
              JSON.stringify(sampleHistory(greeting))
            );
          else localStorage.removeItem(HISTORY_KEY);
        } catch (e) {
          // Without storage the chat starts from its greeting.
        }
        if (readyTimer.current) clearTimeout(readyTimer.current);
        setLoadedWith(conversation);
        setFrame((current) => ({
          key: current.key + 1,
          ready: false,
          locale: live.current.locale,
        }));
      },
      frame.key === 0 ? 0 : 400
    );
    return () => clearTimeout(timer);
  }, [conversation, loadedWith, frame.key, frame.ready]);

  // A chat that never says it has loaded is shown as it is after a while, so
  // it cannot hold the next load back for good.
  useEffect(() => {
    if (frame.key === 0 || frame.ready) return;
    const loading = frame.key;
    const timer = setTimeout(
      () =>
        setFrame((current) =>
          current.key === loading ? {...current, ready: true} : current
        ),
      10000
    );
    return () => clearTimeout(timer);
  }, [frame.key, frame.ready]);

  if (!isLocal) {
    return (
      <div style={styles.panel}>This page runs only on a local server.</div>
    );
  }

  const locales = draft
    ? draft.elements
        .reduce(
          (all, element) =>
            all.concat(
              Object.keys(element.values)
                .map((prop) => element.values[prop])
                .filter(isTextMap)
                .reduce((keys, map) => keys.concat(Object.keys(map)), [])
            ),
          ['en', locale]
        )
        .filter((tag, index, all) => all.indexOf(tag) === index)
        .sort()
    : ['en'];
  const json = profile ? JSON.stringify(profile, null, 2) : '';
  const isChanged =
    !!draft && !!stored && !same(reached(draft), reached(stored));

  // Fields. Plain functions, not components, so an input keeps its focus.
  const hint = (prop: Prop) =>
    prop.description ? (
      <span style={styles.hint}>{prop.description}</span>
    ) : null;

  const textsField = (element: Element, prop: Prop) => {
    const map = element.values[prop.name];
    const own =
      isTextMap(map) && typeof map[locale] === 'string' ? map[locale] : '';
    const other = own ? '' : textIn(map, locale);
    const byDefault = textIn(prop.default, locale);
    const field = {
      name: `${element.name}.${prop.name}`,
      value: own,
      maxLength: prop.length_max || 1000,
      placeholder: other
        ? `Not set in ${locale}, so: ${other}`
        : byDefault
        ? `Default: ${byDefault}`
        : 'Not set',
      onChange: (event: any) =>
        setText(element.name, prop.name, event.target.value),
      style: styles.input,
    };
    return (
      <label style={styles.row} key={prop.name}>
        <span style={styles.label}>
          {labelOf(prop.name)} <span style={styles.tag}>{locale}</span>
        </span>
        {(prop.length_max || 1000) > 100 ? (
          <textarea rows={2} {...field} />
        ) : (
          <input {...field} />
        )}
        {hint(prop)}
      </label>
    );
  };

  const textField = (element: Element, prop: Prop) => (
    <label style={styles.row} key={prop.name}>
      <span style={styles.label}>{labelOf(prop.name)}</span>
      <input
        name={`${element.name}.${prop.name}`}
        value={
          typeof element.values[prop.name] === 'string'
            ? element.values[prop.name]
            : ''
        }
        maxLength={prop.length_max || 1000}
        placeholder={prop.default ? `Default: ${prop.default}` : 'Not set'}
        onChange={(event) =>
          setValue(element.name, prop.name, event.target.value || undefined)
        }
        spellCheck={false}
        style={styles.input}
      />
      {hint(prop)}
    </label>
  );

  const colorField = (element: Element, prop: Prop) => {
    const given = element.values[prop.name];
    const shown = isColor(given)
      ? given
      : isColor(prop.default)
      ? prop.default
      : '#000000';
    return (
      <div style={styles.row} key={prop.name}>
        <span style={styles.label}>
          {labelOf(prop.name)}{' '}
          {given === undefined && (
            <span style={styles.tag}>
              {prop.default ? 'default' : 'not set'}
            </span>
          )}
        </span>
        <span style={styles.pair}>
          <input
            type="color"
            aria-label={`${labelOf(prop.name)}, picker`}
            value={shown.toLowerCase()}
            onChange={(event) =>
              setValue(
                element.name,
                prop.name,
                event.target.value.toUpperCase()
              )
            }
            style={styles.swatch}
          />
          <input
            aria-label={labelOf(prop.name)}
            name={`${element.name}.${prop.name}`}
            value={typeof given === 'string' ? given : ''}
            placeholder={prop.default ? `Default: ${prop.default}` : 'Not set'}
            onChange={(event) =>
              setValue(element.name, prop.name, event.target.value || undefined)
            }
            spellCheck={false}
            style={styles.input}
          />
          {given !== undefined && (
            <button
              type="button"
              title="Back to the default"
              onClick={() => setValue(element.name, prop.name, undefined)}
              style={styles.clear}
            >
              ×
            </button>
          )}
        </span>
        {hint(prop)}
      </div>
    );
  };

  const booleanField = (element: Element, prop: Prop) => {
    const given = element.values[prop.name];
    return (
      <div style={styles.row} key={prop.name}>
        <label style={styles.check}>
          <input
            type="checkbox"
            name={`${element.name}.${prop.name}`}
            checked={typeof given === 'boolean' ? given : !!prop.default}
            onChange={(event) =>
              setValue(element.name, prop.name, event.target.checked)
            }
          />
          {labelOf(prop.name)}
        </label>
        {hint(prop)}
      </div>
    );
  };

  const numberField = (element: Element, prop: Prop) => {
    const given = element.values[prop.name];
    return (
      <label style={styles.row} key={prop.name}>
        <span style={styles.label}>{labelOf(prop.name)}</span>
        <input
          type="number"
          name={`${element.name}.${prop.name}`}
          min={typeof prop.value_min === 'number' ? prop.value_min : undefined}
          max={typeof prop.value_max === 'number' ? prop.value_max : undefined}
          value={typeof given === 'number' ? given : ''}
          placeholder={
            prop.default !== undefined ? `Default: ${prop.default}` : 'Not set'
          }
          onChange={(event) =>
            setValue(
              element.name,
              prop.name,
              event.target.value === '' ? undefined : Number(event.target.value)
            )
          }
          style={styles.input}
        />
        {hint(prop)}
      </label>
    );
  };

  const optionField = (element: Element, prop: Prop) => {
    const given = element.values[prop.name];
    const chosen =
      (prop.options || []).indexOf(given) >= 0 ? given : prop.default;
    return (
      <div style={styles.row} key={prop.name}>
        <span style={styles.label}>{labelOf(prop.name)}</span>
        <span style={styles.inline}>
          {(prop.options || []).map((option) => (
            <label key={option} style={styles.check}>
              <input
                type="radio"
                name={`${element.name}.${prop.name}`}
                checked={chosen === option}
                onChange={() => setValue(element.name, prop.name, option)}
              />
              {option}
            </label>
          ))}
        </span>
        {hint(prop)}
      </div>
    );
  };

  // Every prop of an element's component, in the library's order. A slot is
  // a switch, with the element it holds drawn under it.
  const controls = (element: Element): React.ReactNode => {
    const component = componentNamed(element.component);
    if (!component || !draft) return null;
    return component.props.map((prop) => {
      switch (prop.type) {
        case 'element': {
          const held = heldBy(draft, element, prop);
          return (
            <div style={styles.slot} key={prop.name}>
              <label style={{...styles.check, ...styles.title}}>
                <input
                  type="checkbox"
                  name={`${element.name}.${prop.name}`}
                  checked={!!held}
                  onChange={(event) =>
                    setSlot(element.name, prop, event.target.checked)
                  }
                />
                {labelOf(prop.name)}
                <span style={styles.tag}>{prop.child_component}</span>
              </label>
              {hint(prop)}
              {held && <div style={styles.nested}>{controls(held)}</div>}
            </div>
          );
        }
        case 'texts':
          return textsField(element, prop);
        case 'text':
          return textField(element, prop);
        case 'color':
          return colorField(element, prop);
        case 'boolean':
          return booleanField(element, prop);
        case 'option':
          return optionField(element, prop);
        case 'number':
          return numberField(element, prop);
        default:
          return null;
      }
    });
  };

  const isPreview = !isOpen && wantsPreview;

  return (
    <div style={styles.page}>
      <Head>
        <title>Appearance playground</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <style>{DEV_BADGE_HIDDEN}</style>
      </Head>

      <aside style={styles.panel}>
        <h1 style={styles.h1}>Appearance playground</h1>
        <p style={styles.note}>
          Change a value and the chat redraws. Nothing here is saved to the
          database.
        </p>

        <form
          style={styles.pair}
          onSubmit={(event) => {
            event.preventDefault();
            load(assistantId);
          }}
        >
          <input
            value={assistantId}
            onChange={(event) => setAssistantId(event.target.value)}
            placeholder="Assistant ID, or an agent card’s address"
            aria-label="Assistant ID"
            spellCheck={false}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            Read
          </button>
        </form>
        {profiles.length > 1 && (
          <label style={{...styles.row, marginTop: 8}}>
            <span style={styles.label}>Profile</span>
            <select
              value={draft ? draft.code : ''}
              onChange={(event) => load(assistantId, event.target.value)}
              style={styles.input}
            >
              {profiles.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code}
                  {item.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <p style={{...styles.note, marginTop: 8}}>{status}</p>

        {draft && root && (
          <>
            <section style={styles.section}>
              <div style={styles.title}>Preview</div>
              <div style={styles.row}>
                <span style={styles.label}>Language of the texts</span>
                <span style={styles.pair}>
                  <select
                    aria-label="Language of the texts"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    style={styles.input}
                  >
                    {locales.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Another language"
                    value={newLocale}
                    onChange={(event) => setNewLocale(event.target.value)}
                    placeholder="add, e.g. de"
                    spellCheck={false}
                    style={{...styles.input, width: 120}}
                  />
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => {
                      const tag = newLocale.trim();
                      if (/^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/i.test(tag)) {
                        setLocale(tag);
                        setNewLocale('');
                      }
                    }}
                  >
                    Add
                  </button>
                </span>
              </div>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={sample}
                  onChange={(event) => setSample(event.target.checked)}
                />
                A sample conversation
              </label>
              <p style={styles.note}>
                The assistant’s own e-mail and phone come from its settings, not
                from the profile. The contact form is offered only when the
                assistant has an e-mail.
              </p>
              <label style={styles.row}>
                <span style={styles.label}>Assistant’s e-mail</span>
                <input
                  value={hotelEmail}
                  onChange={(event) => setHotelEmail(event.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.row}>
                <span style={styles.label}>Assistant’s phone</span>
                <input
                  value={hotelPhone}
                  onChange={(event) => setHotelPhone(event.target.value)}
                  style={styles.input}
                />
              </label>
            </section>

            <section style={styles.section}>
              <div style={styles.title}>
                {ROOT.name}{' '}
                <span style={styles.tag}>{COMPONENTS.length} components</span>
              </div>
              {controls(root)}
            </section>

            <section style={styles.section}>
              <div style={{...styles.title, ...styles.inline}}>
                <span>The profile</span>
                <span style={styles.tag}>
                  {isChanged ? 'changed here, not saved' : 'as it started'}
                </span>
              </div>
              <p style={styles.note}>
                What the admin API takes as a profile’s <code>elements</code>,
                what a page gives as <code>appearance</code> in its embed, and
                what an agent card publishes as the <code>params</code> of the
                extension <code>{APPEARANCE_EXTENSION}</code>.
              </p>
              <div style={{...styles.inline, marginBottom: 8}}>
                <button
                  type="button"
                  style={styles.button}
                  onClick={() => {
                    navigator.clipboard.writeText(json).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  style={styles.button}
                  onClick={() =>
                    stored && start(stored, 'Back to where it started.')
                  }
                >
                  Start again
                </button>
              </div>
              <pre style={styles.pre}>{json}</pre>
            </section>
          </>
        )}
      </aside>

      <main style={styles.stage}>
        <p style={styles.stageNote}>
          The chat is the real one. The round button stands in for the
          launcher’s.
          {draft && !button && (
            <>
              {' '}
              This profile has no round button: a page then opens the chat
              itself.{' '}
              <button
                type="button"
                style={styles.link}
                onClick={() => setOpen(!isOpen)}
              >
                {isOpen ? 'Close the chat' : 'Open the chat'}
              </button>
            </>
          )}
          {isPreview && sample && (
            <>
              {' '}
              The greeting shows above the button once the sample conversation
              is off.
            </>
          )}
        </p>
        {frame.key > 0 && (
          <iframe
            key={frame.key}
            ref={frameRef}
            title="Floating chat"
            src={`/?token=-1&inbox=${PREVIEW_INBOX}&version=${CHAT_VERSION}&disableAnalyticsTracking=1&parentOrigin=${encodeURIComponent(
              window.location.origin
            )}&locale=${encodeURIComponent(frame.locale)}`}
            onLoad={guard}
            style={{
              ...(isPreview ? styles.preview : styles.frame),
              [side]: 20,
              visibility:
                frame.ready && (isOpen || isPreview) ? 'visible' : 'hidden',
            }}
          />
        )}
        {draft && button && (
          <button
            type="button"
            aria-label={isOpen ? 'Close the chat' : 'Open the chat'}
            onClick={() => setOpen(!isOpen)}
            style={{...styles.launcher, background: accent, [side]: 20}}
          >
            {isOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M5 5l14 14M19 5L5 19"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M4 5h16v11H9l-5 4V5z"
                  fill={button.icon === 'filled' ? '#fff' : 'none'}
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
      </main>
    </div>
  );
}

const styles: {[name: string]: React.CSSProperties} = {
  page: {
    display: 'flex',
    width: '100%',
    height: '100vh',
    fontSize: 14,
    color: '#1f2933',
    background: '#fff',
  },
  panel: {
    width: 420,
    flexShrink: 0,
    height: '100vh',
    overflowY: 'auto',
    borderRight: '1px solid #e4e7eb',
    padding: '20px 20px 40px',
  },
  h1: {fontSize: 18, fontWeight: 600, margin: '0 0 4px'},
  note: {color: '#616e7c', fontSize: 12, lineHeight: 1.5, margin: '0 0 10px'},
  section: {borderTop: '1px solid #e4e7eb', padding: '12px 0 4px'},
  title: {fontWeight: 600, marginBottom: 8},
  slot: {borderTop: '1px solid #eef0f3', padding: '10px 0 2px'},
  nested: {
    borderLeft: '2px solid #e4e7eb',
    margin: '8px 0 6px 6px',
    paddingLeft: 12,
  },
  row: {display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10},
  label: {fontSize: 12, color: '#52606d'},
  hint: {fontSize: 11, lineHeight: 1.4, color: '#9aa5b1', fontWeight: 400},
  tag: {
    fontSize: 11,
    fontWeight: 400,
    color: '#9aa5b1',
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #cbd2d9',
    borderRadius: 6,
    font: 'inherit',
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    cursor: 'pointer',
  },
  pair: {display: 'flex', gap: 6, alignItems: 'center'},
  inline: {display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center'},
  swatch: {
    width: 40,
    height: 32,
    flexShrink: 0,
    padding: 2,
    border: '1px solid #cbd2d9',
    borderRadius: 6,
    background: '#fff',
  },
  button: {
    padding: '6px 12px',
    border: '1px solid #cbd2d9',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    font: 'inherit',
    whiteSpace: 'nowrap',
  },
  clear: {
    width: 28,
    height: 32,
    flexShrink: 0,
    border: '1px solid #cbd2d9',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    font: 'inherit',
  },
  link: {
    border: 0,
    padding: 0,
    background: 'none',
    color: '#465ea4',
    textDecoration: 'underline',
    cursor: 'pointer',
    font: 'inherit',
  },
  pre: {
    background: '#f5f7fa',
    border: '1px solid #e4e7eb',
    borderRadius: 6,
    padding: 10,
    fontSize: 11,
    lineHeight: 1.45,
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
  stage: {
    flex: 1,
    position: 'relative',
    height: '100vh',
    minHeight: 740,
    overflow: 'hidden',
    background: 'linear-gradient(#f5f7fa, #e4e7eb)',
  },
  stageNote: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    margin: 0,
    color: '#7b8794',
    fontSize: 12,
  },
  frame: {
    position: 'absolute',
    bottom: 100,
    width: 450,
    height: 600,
    maxWidth: 'calc(100% - 40px)',
    maxHeight: 'calc(100% - 140px)',
    border: 0,
    borderRadius: 16,
    boxShadow: 'rgba(0, 0, 0, 0.16) 0px 5px 40px',
    background: '#fff',
  },
  // The greeting above the button, as the launcher frames it.
  preview: {
    position: 'absolute',
    bottom: 80,
    width: 300,
    height: 200,
    maxWidth: 'calc(100% - 40px)',
    border: 0,
    background: 'transparent',
  },
  launcher: {
    position: 'absolute',
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: '50%',
    border: 0,
    boxShadow: 'rgba(0, 0, 0, 0.2) 0px 4px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
