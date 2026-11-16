// An assistant's appearance profile: the model the chat draws from, the read,
// the blocks and the launcher. Nothing here contacts a hosted service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {bundledLauncherHandler} = require('./support/runtime.cjs');
const oldExtensions = new Map();
for (const ext of ['.ts', '.tsx']) {
  oldExtensions.set(ext, require.extensions[ext]);
  require.extensions[ext] = (module, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
    });
    module._compile(result.outputText, filename);
  };
}
oldExtensions.set('.css', require.extensions['.css']);
require.extensions['.css'] = (module) => {
  module.exports = {btn_up_down: 'btn_up_down'};
};
const {
  settingsAppearance,
  profileAppearance,
  resolveAppearance,
  pickProfile,
  isAssistantId,
  isProfileCode,
  localeTag,
  embedKeys,
} = require('../helpers/appearance.ts');
const {fetchAppearanceProfile} = require('../helpers/appearance-api.ts');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ChatWindow = require('../components/ChatWindow.tsx').default;
const Widget = require('../components/Widget.tsx').default;
for (const [ext, previous] of oldExtensions) {
  if (previous) require.extensions[ext] = previous;
  else delete require.extensions[ext];
}

const ASSISTANT = 'f1a4e101-533a-8355-80f0-f448ed950b76';
const CONFIRMATION =
  'Thank you for your message! Please expect our reply within 1 working day.';
const DEFAULT_MESSAGES = {
  assistantBubbleColor: '#F5F5F5',
  guestBubbleColor: null,
  hasAvatars: true,
  hasFeedback: true,
  hasTimestamps: true,
};

// What the public read answers for an assistant with a whole profile, asked
// in Czech: texts resolved, the library's defaults filled in.
const page = () => ({
  items: [
    {
      ui: 'floating_chat',
      code: 'default',
      is_default: true,
      elements: [
        {
          name: 'root',
          component: 'FloatingChat',
          values: {
            header: 'header',
            greeting: 'greeting',
            composer: 'composer',
            accent_color: '#465EA4',
            screen_side: 'right',
            contact: 'contact',
            branding: 'branding',
            messages: 'messages',
          },
        },
        {
          name: 'header',
          component: 'Header',
          values: {
            titles: 'Zeptejte se nás',
            subtitles: 'Hotel Example',
          },
        },
        {
          name: 'greeting',
          component: 'Greeting',
          values: {greetings: 'Dobrý den, jak vám mohu pomoci?'},
        },
        {
          name: 'composer',
          component: 'Composer',
          values: {input_placeholders: 'Zeptejte se na cokoli...'},
        },
        {
          name: 'contact',
          component: 'Contact',
          values: {
            has_form: true,
            form_titles: 'Contact Us',
            form_confirmations: CONFIRMATION,
          },
        },
        {name: 'branding', component: 'Branding', values: {}},
        {
          name: 'messages',
          component: 'Messages',
          values: {
            assistant_bubble_color: '#F5F5F5',
            has_avatars: true,
            has_feedback: true,
            has_timestamps: true,
          },
        },
      ],
      locale: 'cs',
      updated_at: '2026-11-16T07:27:08Z',
    },
  ],
  next_cursor: null,
  limit: 50,
});
// One profile of that page, after `change(item, element)` has had its way.
const profile = (change) => {
  const item = page().items[0];
  if (change)
    change(item, (name) => item.elements.find((e) => e.name === name));
  return item;
};

const tests = [];
const test = (name, run) => tests.push({name, run});
// Node has no `fetch` of its own here: each test supplies the network.
async function withFetch(fetcher, run) {
  const calls = [];
  global.fetch = (url, options) => {
    calls.push({url, options});
    return fetcher(url, options);
  };
  try {
    return await run(calls);
  } finally {
    delete global.fetch;
  }
}

test('without a profile the chat is as it is today', () => {
  assert.deepEqual(settingsAppearance({}), {
    source: 'settings',
    accentColor: undefined,
    header: {title: 'Welcome!', subtitle: 'How can we help you?'},
    greeting: null,
    composer: {placeholder: 'Start typing...'},
    contact: {
      hasForm: false,
      formTitle: 'Contact Us',
      formConfirmation: CONFIRMATION,
    },
    branding: true,
    messages: DEFAULT_MESSAGES,
  });
});

test('the settings give the chat its texts, colour and contact form', () => {
  const look = settingsAppearance({
    title: 'Ask us',
    subtitle: 'Any time',
    greeting: 'Hi',
    newMessagePlaceholder: 'Write here',
    primaryColor: '#112233',
    shouldShowContactForm: true,
  });
  assert.deepEqual(look.header, {title: 'Ask us', subtitle: 'Any time'});
  assert.deepEqual(look.greeting, {text: 'Hi'});
  assert.deepEqual(look.composer, {placeholder: 'Write here'});
  assert.equal(look.accentColor, '#112233');
  assert.equal(look.contact.hasForm, true);
});

test('a whole profile fills every block', () => {
  assert.deepEqual(profileAppearance(profile(), {}, []), {
    source: 'profile',
    accentColor: '#465EA4',
    header: {title: 'Zeptejte se nás', subtitle: 'Hotel Example'},
    greeting: {text: 'Dobrý den, jak vám mohu pomoci?'},
    composer: {placeholder: 'Zeptejte se na cokoli...'},
    contact: {
      hasForm: true,
      formTitle: 'Contact Us',
      formConfirmation: CONFIRMATION,
    },
    branding: true,
    messages: DEFAULT_MESSAGES,
  });
});

test('a block the profile leaves out is not drawn', () => {
  const look = profileAppearance(
    profile((item, element) => {
      element('root').values = {header: 'header', accent_color: '#0B6E4F'};
    }),
    {greeting: 'From the settings', shouldShowContactForm: true},
    []
  );
  assert.deepEqual(look.header, {
    title: 'Zeptejte se nás',
    subtitle: 'Hotel Example',
  });
  assert.equal(look.greeting, null);
  assert.equal(look.composer, null);
  assert.equal(look.contact, null);
  assert.equal(look.branding, false);
  assert.equal(look.accentColor, '#0B6E4F');
  assert.deepEqual(look.messages, DEFAULT_MESSAGES);
});

test('a profile the chat cannot start from leaves the settings in charge', () => {
  for (const broken of [
    profile((item) => {
      item.elements = item.elements.filter((e) => e.name !== 'root');
    }),
    profile((item, element) => {
      element('root').component = 'GuestDirectory';
    }),
    profile((item) => {
      item.elements = 'not a list';
    }),
  ]) {
    assert.equal(profileAppearance(broken, {}, []), null);
    const look = resolveAppearance(broken, {title: 'Ask us'}, []);
    assert.equal(look.source, 'settings');
    assert.equal(look.header.title, 'Ask us');
  }
  assert.equal(resolveAppearance(null, {}, []).source, 'settings');
  assert.equal(resolveAppearance(profile(), {}, []).source, 'profile');
});

test('what the embed sets itself stands in front of the profile', () => {
  const settings = {
    title: 'Embed title',
    subtitle: 'Settings subtitle',
    greeting: 'Embed greeting',
    newMessagePlaceholder: 'Embed hint',
    primaryColor: '#101010',
  };
  const look = profileAppearance(profile(), settings, [
    'title',
    'greeting',
    'newMessagePlaceholder',
    'primaryColor',
  ]);
  assert.equal(look.header.title, 'Embed title');
  assert.equal(look.header.subtitle, 'Hotel Example');
  assert.equal(look.greeting.text, 'Embed greeting');
  assert.equal(look.composer.placeholder, 'Embed hint');
  assert.equal(look.accentColor, '#101010');

  const plain = profileAppearance(profile(), settings, []);
  assert.equal(plain.header.title, 'Zeptejte se nás');
  assert.equal(plain.greeting.text, 'Dobrý den, jak vám mohu pomoci?');
  assert.equal(plain.accentColor, '#465EA4');
});

test('a value of the wrong shape gives way to the default', () => {
  const look = profileAppearance(
    profile((item, element) => {
      element('root').values.accent_color = 'red;background:url(//evil)';
      element('header').values.titles = {en: 'A locale map, not a text'};
      element('composer').values.input_placeholders = 42;
      element('contact').values.has_form = 'yes';
      element('contact').values.form_titles = '';
      element('messages').values.assistant_bubble_color = '#12345';
      element('messages').values.guest_bubble_color = 'javascript:alert(1)';
      element('messages').values.has_avatars = 0;
    }),
    {},
    []
  );
  assert.equal(look.accentColor, undefined);
  // The launcher has already resolved a colour for its button: the window
  // keeps to it, so the two are never of different colours.
  assert.equal(
    profileAppearance(
      profile((item, element) => {
        element('root').values.accent_color = 'red';
      }),
      {primaryColor: '#101010'},
      []
    ).accentColor,
    '#101010'
  );
  assert.equal(look.header.title, 'Welcome!');
  assert.equal(look.composer.placeholder, 'Start typing...');
  assert.equal(look.contact.hasForm, true);
  assert.equal(look.contact.formTitle, 'Contact Us');
  assert.deepEqual(look.messages, DEFAULT_MESSAGES);
});

test('a slot holds only its own kind of block', () => {
  const look = profileAppearance(
    profile((item, element) => {
      element('root').values.header = 'greeting';
      element('root').values.composer = 'missing';
      element('root').values.contact = 7;
    }),
    {},
    []
  );
  assert.equal(look.header, null);
  assert.equal(look.composer, null);
  assert.equal(look.contact, null);
  assert.deepEqual(look.greeting, {text: 'Dobrý den, jak vám mohu pomoci?'});
});

test('the message values a profile gives are taken, the rest are the defaults', () => {
  const none = profileAppearance(
    profile((item, element) => {
      delete element('root').values.messages;
    }),
    {},
    []
  );
  assert.deepEqual(none.messages, DEFAULT_MESSAGES);

  const styled = profileAppearance(
    profile((item, element) => {
      Object.assign(element('messages').values, {
        assistant_bubble_color: '#EEF2FF',
        guest_bubble_color: '#0B6E4F',
        has_avatars: false,
        has_feedback: false,
        has_timestamps: false,
      });
    }),
    {},
    []
  );
  assert.deepEqual(styled.messages, {
    assistantBubbleColor: '#EEF2FF',
    guestBubbleColor: '#0B6E4F',
    hasAvatars: false,
    hasFeedback: false,
    hasTimestamps: false,
  });
});

test('the chat takes the profile its embed names, else the default', () => {
  const both = page();
  both.items.push({...page().items[0], code: 'govisit', is_default: false});
  assert.equal(pickProfile(both, 'govisit').code, 'govisit');
  assert.equal(pickProfile(both, 'gone').code, 'default');
  assert.equal(pickProfile(both).code, 'default');

  both.items[0].is_default = false;
  assert.equal(pickProfile(both), null);
  assert.equal(pickProfile(both, 'govisit').code, 'govisit');

  const another = page();
  another.items[0].ui = 'guest_directory';
  assert.equal(pickProfile(another), null);
  for (const notAPage of [
    null,
    undefined,
    'page',
    {},
    {items: 'none'},
    {items: [null, 3, {ui: 'floating_chat', is_default: true}]},
  ]) {
    assert.equal(pickProfile(notAPage), null);
  }
});

test('only what the read can take is sent to it', () => {
  assert.equal(isAssistantId(ASSISTANT), true);
  assert.equal(isAssistantId(ASSISTANT.toUpperCase()), true);
  for (const no of [
    'hotel-paris',
    '',
    null,
    42,
    ASSISTANT + '/x',
    'f1a4e101-533a-8355-80f0',
  ]) {
    assert.equal(isAssistantId(no), false);
  }

  assert.equal(isProfileCode('govisit_2'), true);
  for (const no of ['Govisit', '2go', 'a b', '', null, 'a'.repeat(65)]) {
    assert.equal(isProfileCode(no), false);
  }

  assert.equal(localeTag('cs'), 'cs');
  assert.equal(localeTag('pt-BR'), 'pt-BR');
  assert.equal(localeTag(' en-GB '), 'en-GB');
  assert.equal(localeTag('zh-Hant-TW'), 'zh-Hant-TW');
  // The read takes a language and two more parts at most, and `_` is a
  // common slip for `-`.
  assert.equal(localeTag('de-Latn-DE-1996'), 'de-Latn-DE');
  assert.equal(localeTag('cs_CZ'), 'cs-CZ');
  // `all` asks the read for every language at once, which is not a text.
  for (const no of ['all', '<script>', '', null, 'e', 'x'.repeat(40)]) {
    assert.equal(localeTag(no), null);
  }

  assert.deepEqual(embedKeys('title,primaryColor,inbox,token'), [
    'title',
    'primaryColor',
  ]);
  assert.deepEqual(embedKeys(undefined), []);
});

test('a profile ID the read does not know is not asked for', async () => {
  await withFetch(
    async () => {
      throw new Error('no request expected');
    },
    async (calls) => {
      for (const assistantId of ['hotel-paris', '', undefined, 42]) {
        assert.equal(await fetchAppearanceProfile({assistantId}), null);
      }
      assert.equal(calls.length, 0);
    }
  );
});

test('the profile is read from the fixed service, for this UI and language', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => page()}),
    async (calls) => {
      const controller = new AbortController();
      const found = await fetchAppearanceProfile({
        assistantId: ASSISTANT.toUpperCase(),
        locale: 'cs',
        signal: controller.signal,
      });
      assert.equal(found.code, 'default');
      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&limit=200&locale=cs`
      );
      assert.equal(calls[0].options.credentials, 'omit');
      assert.equal(calls[0].options.signal, controller.signal);

      // A language the read cannot take is left out; its own default applies.
      await fetchAppearanceProfile({
        assistantId: ASSISTANT,
        locale: '<script>',
      });
      assert.equal(
        calls[1].url,
        `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&limit=200`
      );
    }
  );
});

test('the profile the embed names is the one read', async () => {
  const both = page();
  both.items.push({...page().items[0], code: 'govisit', is_default: false});
  await withFetch(
    async () => ({ok: true, json: async () => both}),
    async () => {
      const named = await fetchAppearanceProfile({
        assistantId: ASSISTANT,
        code: 'govisit',
      });
      assert.equal(named.code, 'govisit');
    }
  );
});

test('a read that fails leaves the chat as it is', async () => {
  for (const fetcher of [
    async () => ({ok: false, json: async () => page()}),
    async () => {
      throw new Error('offline');
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('not JSON');
      },
    }),
    async () => ({ok: true, json: async () => ({items: []})}),
  ]) {
    await withFetch(fetcher, async (calls) => {
      assert.equal(
        await fetchAppearanceProfile({assistantId: ASSISTANT}),
        null
      );
      assert.equal(calls.length, 1);
    });
  }
});

// The chat window itself, open, as the iframe draws it. `ChatWindow` still
// logs while it works; that is kept out of the test output.
const quietly = (run) => {
  const log = console.log;
  console.log = () => {};
  try {
    return run();
  } finally {
    console.log = log;
  }
};
function chat(props = {}, state = {}) {
  global.window = {
    document: {},
    addEventListener() {},
    removeEventListener() {},
  };
  global.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    documentElement: {style: {setProperty() {}}},
  };
  global.parent = {postMessage() {}};
  const instance = quietly(
    () =>
      new ChatWindow({
        accountId: '-1',
        inboxId: ASSISTANT,
        disableAnalyticsTracking: true,
        version: '1.2.0',
        ...props,
      })
  );
  instance.setState = (change, callback) => {
    instance.state = {
      ...instance.state,
      ...(typeof change === 'function'
        ? change(instance.state, instance.props)
        : change),
    };
    if (callback) callback();
  };
  Object.assign(instance.state, {isOpen: true}, state);
  return instance;
}
const html = (instance) =>
  quietly(() => renderToStaticMarkup(instance.render()));
const BLOCKS = ['Header', 'Messages', 'Composer', 'Contact', 'Branding'];
const blocksIn = (markup) =>
  BLOCKS.filter((name) => markup.includes(`data-component="${name}"`));
const count = (markup, pattern) => (markup.match(pattern) || []).length;
const whole = () => profileAppearance(profile(), {}, []);
const conversation = () => [
  {
    id: 'greeting',
    type: 'bot',
    body: 'Hello',
    created_at: '2026-11-16T07:00:00Z',
  },
  {
    id: 'user-1',
    type: 'customer',
    customer_id: 'customer',
    body: 'Is breakfast included?',
    created_at: '2026-11-16T07:01:00Z',
  },
  {
    id: 'assistant-1',
    type: 'agent',
    user_id: 1,
    body: 'Yes, every morning.',
    created_at: '2026-11-16T07:02:00Z',
  },
];

test('the chat draws the blocks its look lists, and only those', () => {
  assert.deepEqual(blocksIn(html(chat({appearance: whole()}))), BLOCKS);
  assert.deepEqual(
    blocksIn(html(chat({appearance: {...whole(), header: null}}))),
    ['Messages', 'Composer', 'Contact', 'Branding']
  );
  assert.deepEqual(
    blocksIn(
      html(
        chat({
          appearance: {
            ...whole(),
            composer: null,
            contact: null,
            branding: false,
          },
        })
      )
    ),
    ['Header', 'Messages']
  );
});

test('each block says what the look gives it', () => {
  const look = {
    ...whole(),
    contact: {
      hasForm: true,
      formTitle: 'Write to us',
      formConfirmation: 'We will answer today.',
    },
  };
  const markup = html(chat({appearance: look}));
  assert.match(markup, /<h2[^>]*>Zeptejte se nás<\/h2>/);
  assert.match(markup, />Hotel Example</);
  assert.match(markup, /placeholder="Zeptejte se na cokoli\.\.\."/);

  const hotelEmail = 'stay@hotel.example';
  const form = html(
    chat({appearance: look, hotelEmail}, {isMailIconClicked: true})
  );
  assert.match(form, />Write to us</);
  assert.doesNotMatch(form, />Contact Us</);

  const sent = html(
    chat(
      {appearance: look, hotelEmail},
      {
        isMailIconClicked: true,
        isContactFormSubmitted: true,
        statusMessageCF: null,
      }
    )
  );
  assert.match(sent, />We will answer today\.</);
  assert.doesNotMatch(sent, /Thank you for your message/);
});

test('the contact form is offered when the look has it and there is somewhere to send it', () => {
  const look = (hasForm) => ({
    ...whole(),
    contact: {...whole().contact, hasForm},
  });
  const envelope = /data-contact-form-control="true"/;
  const hotelEmail = 'stay@hotel.example';
  assert.match(html(chat({appearance: look(true), hotelEmail})), envelope);
  assert.doesNotMatch(
    html(chat({appearance: look(false), hotelEmail})),
    envelope
  );
  // The form is sent to the assistant's e-mail. Without one a profile's form
  // would be sent nowhere, so it is not offered, and cannot be open.
  assert.doesNotMatch(html(chat({appearance: look(true)})), envelope);
  const forced = html(
    chat({appearance: look(true)}, {isMailIconClicked: true})
  );
  assert.match(forced, /data-component="Messages"/);
  assert.doesNotMatch(forced, /name="firstName"/);

  // From the settings the flag alone decides, as it always has: the service
  // that gives the flag already knows whether there is an e-mail.
  assert.match(html(chat({shouldShowContactForm: true})), envelope);
  assert.doesNotMatch(html(chat()), envelope);
});

test('the contact form cannot stay open once the look has no contact line', () => {
  const markup = html(
    chat({appearance: {...whole(), contact: null}}, {isMailIconClicked: true})
  );
  assert.deepEqual(blocksIn(markup), [
    'Header',
    'Messages',
    'Composer',
    'Branding',
  ]);
  assert.doesNotMatch(markup, /name="firstName"/);
});

test('without a profile the chat looks as it always has', () => {
  const plain = html(chat());
  assert.match(plain, /<h2[^>]*>Welcome!<\/h2>/);
  assert.match(plain, />How can we help you\?</);
  assert.match(plain, /placeholder="Start typing\.\.\."/);
  // The branding waits for the subscription plan's word, as before.
  assert.deepEqual(blocksIn(plain), [
    'Header',
    'Messages',
    'Composer',
    'Contact',
  ]);
  assert.deepEqual(
    blocksIn(html(chat({}, {shouldDisplayBranding: true}))),
    BLOCKS
  );

  const set = html(
    chat({
      title: 'Ask us',
      subtitle: 'Any time',
      newMessagePlaceholder: 'Write here',
    })
  );
  assert.match(set, /<h2[^>]*>Ask us<\/h2>/);
  assert.match(set, />Any time</);
  assert.match(set, /placeholder="Write here"/);
});

test('a profile shows its branding without waiting for the plan', () => {
  const markup = html(chat({appearance: whole()}));
  assert.match(markup, /data-component="Branding"/);
  assert.match(markup, /Powered by/);
});

test('the chat can still be closed when the header is left out', () => {
  // A page may hide the launcher's button; the control in the window is then
  // the only way out, so it stays without the header around it.
  const look = {...whole(), header: null};
  const closeable = html(chat({appearance: look, isCloseable: true}));
  assert.match(closeable, /class="CloseIcon"/);
  assert.doesNotMatch(closeable, /<h2/);
  assert.doesNotMatch(closeable, /data-component="Header"/);

  assert.doesNotMatch(
    html(chat({appearance: look, isCloseable: false})),
    /class="CloseIcon"/
  );
});

test('the message list takes its colours and its parts from the look', () => {
  const plain = html(chat({appearance: whole()}, {messages: conversation()}));
  assert.match(plain, /data-avatar-state=/);
  assert.equal(count(plain, /class="btn_up_down"/g), 2);
  assert.equal(count(plain, /<time/g), 1);
  assert.match(plain, /background-color:#F5F5F5/);

  const styled = html(
    chat(
      {
        appearance: {
          ...whole(),
          messages: {
            assistantBubbleColor: '#EEF2FF',
            guestBubbleColor: '#0B6E4F',
            hasAvatars: false,
            hasFeedback: false,
            hasTimestamps: false,
          },
        },
      },
      {messages: conversation()}
    )
  );
  assert.doesNotMatch(styled, /data-avatar-state=/);
  assert.equal(count(styled, /class="btn_up_down"/g), 0);
  assert.equal(count(styled, /<time/g), 0);
  assert.match(styled, /background-color:#EEF2FF/);
  assert.match(styled, /background-color:#0B6E4F/);
  assert.doesNotMatch(styled, /background-color:#F5F5F5/);
});

test('a light bubble is written on in dark, a dark one in white', () => {
  const written = (messages) =>
    count(
      html(
        chat(
          {
            appearance: {
              ...whole(),
              messages: {...whole().messages, ...messages},
            },
          },
          {messages: conversation()}
        )
      ),
      /Text--white/g
    );
  // As today: white on the accent colour, dark on the grey.
  assert.equal(written({}), 1);
  assert.equal(written({guestBubbleColor: '#FFF4CC'}), 0);
  assert.equal(written({assistantBubbleColor: '#1F2937'}), 3);
});

test('the time under a message reads on its bubble', () => {
  // The time stands under the last message only.
  const time = (messages, last) =>
    html(
      chat(
        {
          appearance: {
            ...whole(),
            messages: {...whole().messages, ...messages},
          },
        },
        {messages: conversation().slice(0, last)}
      )
    ).match(/<time[^>]*>/)[0];
  // As today: light on the accent colour, dark on the grey.
  assert.match(time({}, 2), /data-mine="true"/);
  assert.doesNotMatch(time({}, 2), /data-on=/);
  assert.doesNotMatch(time({}, 3), /data-mine=|data-on=/);
  // On a colour the look sets, whichever of the two reads.
  assert.match(time({guestBubbleColor: '#FFF4CC'}, 2), /data-on="light"/);
  assert.doesNotMatch(time({guestBubbleColor: '#0B6E4F'}, 2), /data-on=/);
  assert.match(time({assistantBubbleColor: '#1F2937'}, 3), /data-on="dark"/);
  assert.doesNotMatch(time({assistantBubbleColor: '#EEF2FF'}, 3), /data-on=/);
});

test('the chat opens with the greeting of its look and follows it until the guest writes', async () => {
  await withFetch(
    async () => ({ok: false}),
    async () => {
      const instance = chat({
        appearance: settingsAppearance({greeting: 'From the settings'}),
      });
      const bodies = () => instance.state.messages.map((m) => m.body);
      const look = (appearance) => {
        const previous = instance.props;
        instance.props = {...previous, appearance};
        instance.componentDidUpdate(previous);
      };
      try {
        await instance.componentDidMount();
        assert.deepEqual(bodies(), ['From the settings']);

        // The profile arrives after the chat has loaded.
        look(whole());
        assert.deepEqual(bodies(), ['Dobrý den, jak vám mohu pomoci?']);
        assert.equal(instance.state.messages[0].type, 'bot');

        look({...whole(), greeting: null});
        assert.deepEqual(bodies(), []);

        look(whole());
        instance.state.messages = [
          ...instance.state.messages,
          {id: 'user-1', type: 'customer', customer_id: 'customer', body: 'Hi'},
        ];
        look({...whole(), greeting: {text: 'Another greeting'}});
        assert.deepEqual(bodies(), ['Dobrý den, jak vám mohu pomoci?', 'Hi']);
      } finally {
        instance.componentWillUnmount();
      }
    }
  );
});

// The wrapper around the chat window: it reads the configuration, and now the
// assistant's profile, and hands the window the look it resolves.
function widget(config) {
  chat(); // the page's globals
  const wrapper = new Widget({config: {token: '-1', ...config}});
  wrapper.setState = (change, callback) => {
    wrapper.state = {
      ...wrapper.state,
      ...(typeof change === 'function'
        ? change(wrapper.state, wrapper.props)
        : change),
    };
    if (callback) callback();
  };
  return wrapper;
}
// The look the wrapper hands the chat window.
const shown = (wrapper) =>
  quietly(() => wrapper.render()).props.children.props.appearance;
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};
const OTHER = 'f1a4e101-0000-8000-8000-000000000002';

test('a greeting changed in the settings alone leaves the conversation as it was', async () => {
  await withFetch(
    async () => ({ok: false}),
    async () => {
      const instance = chat({greeting: 'First'});
      try {
        await instance.componentDidMount();
        const previous = instance.props;
        instance.props = {...previous, greeting: 'Second'};
        instance.componentDidUpdate(previous);
        assert.deepEqual(
          instance.state.messages.map((m) => m.body),
          ['First']
        );
      } finally {
        instance.componentWillUnmount();
      }
    }
  );
});

test('a conversation brought back from the browser keeps its first message', async () => {
  await withFetch(
    async () => ({ok: false}),
    async () => {
      const instance = chat({
        appearance: settingsAppearance({greeting: 'Old'}),
      });
      global.localStorage = {
        getItem: (key) =>
          key.startsWith('inhotel_chat_history')
            ? JSON.stringify({
                messages: [
                  {
                    role: 'assistant',
                    type: 'bot',
                    content: 'Old',
                    timestamp: new Date().toISOString(),
                  },
                ],
                timestamp: Date.now(),
              })
            : null,
      };
      try {
        await instance.componentDidMount();
        const previous = instance.props;
        instance.props = {...previous, appearance: whole()};
        instance.componentDidUpdate(previous);
        assert.deepEqual(
          instance.state.messages.map((m) => m.body),
          ['Old']
        );
      } finally {
        instance.componentWillUnmount();
        delete global.localStorage;
      }
    }
  );
});

test('a greeting that goes away takes its preview with it', async () => {
  await withFetch(
    async () => ({ok: false}),
    async () => {
      const instance = chat(
        {appearance: settingsAppearance({greeting: 'From the settings'})},
        {isOpen: false}
      );
      const events = [];
      instance.emit = (event) => events.push(event);
      try {
        await instance.componentDidMount();
        // The launcher asks for the greeting to be shown above its button.
        instance.handleDisplayNotifications({
          shouldDisplayNotifications: true,
          popUpInitialMessage: true,
        });
        assert.equal(instance.getUnreadMessages().length, 1);
        events.length = 0;

        // The profile arrives, and it has no greeting. The launcher is told
        // there is nothing left to show, or it would hold an empty frame open.
        const previous = instance.props;
        instance.props = {
          ...previous,
          appearance: {...whole(), greeting: null},
        };
        instance.componentDidUpdate(previous);
        assert.deepEqual(instance.state.messages, []);
        assert.deepEqual(events, ['messages:seen']);
      } finally {
        instance.componentWillUnmount();
      }
    }
  );
});

test('the chat is drawn from the profile of its assistant', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => page()}),
    async (calls) => {
      const wrapper = widget({
        inbox: ASSISTANT,
        locale: 'cs',
        title: 'From the settings',
      });
      // Until the read answers, the chat is what its settings say.
      assert.equal(shown(wrapper).source, 'settings');
      assert.equal(shown(wrapper).header.title, 'From the settings');
      try {
        wrapper.componentDidMount();
        await settle();
        assert.equal(calls.length, 1);
        assert.equal(
          calls[0].url,
          `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&limit=200&locale=cs`
        );
        assert.equal(shown(wrapper).source, 'profile');
        assert.equal(shown(wrapper).header.title, 'Zeptejte se nás');
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('every setting reaches the look when there is no profile', () => {
  const wrapper = widget({
    inbox: 'hotel-paris',
    title: 'Ask us',
    subtitle: 'Any time',
    greeting: 'Hi',
    newMessagePlaceholder: 'Write here',
    primaryColor: '#112233',
    shouldShowContactForm: 'true',
  });
  assert.deepEqual(shown(wrapper), {
    source: 'settings',
    accentColor: '#112233',
    header: {title: 'Ask us', subtitle: 'Any time'},
    greeting: {text: 'Hi'},
    composer: {placeholder: 'Write here'},
    contact: {
      hasForm: true,
      formTitle: 'Contact Us',
      formConfirmation: CONFIRMATION,
    },
    branding: true,
    messages: DEFAULT_MESSAGES,
  });
  assert.equal(shown(widget({inbox: 'hotel-paris'})).contact.hasForm, false);
});

test('leaving the page cancels the read, and its late answer changes nothing', async () => {
  const answers = [];
  await withFetch(
    () => new Promise((resolve) => answers.push(resolve)),
    async (calls) => {
      const wrapper = widget({inbox: ASSISTANT});
      wrapper.componentDidMount();
      wrapper.componentWillUnmount();
      assert.equal(calls[0].options.signal.aborted, true);
      let updates = 0;
      const setState = wrapper.setState;
      wrapper.setState = (...args) => {
        updates++;
        return setState(...args);
      };
      answers[0]({ok: true, json: async () => page()});
      await settle();
      assert.equal(updates, 0);
    }
  );
});

test('a new language, and a newly named profile, are read again', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => page()}),
    async (calls) => {
      const wrapper = widget({inbox: ASSISTANT, locale: 'en'});
      const update = (change) => {
        const previous = wrapper.state;
        wrapper.handleConfigUpdate(change);
        wrapper.componentDidUpdate(wrapper.props, previous);
      };
      try {
        wrapper.componentDidMount();
        await settle();
        update({locale: 'cs'});
        await settle();
        update({appearanceProfile: 'govisit'});
        await settle();
        update({title: 'Only a title'});
        await settle();
        assert.deepEqual(
          calls.map((call) => call.url.split('?')[1]),
          [
            'ui=floating_chat&limit=200&locale=en',
            'ui=floating_chat&limit=200&locale=cs',
            'ui=floating_chat&limit=200&locale=cs',
          ]
        );
        // The same assistant keeps its profile while it is read again.
        assert.equal(shown(wrapper).source, 'profile');
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('the profile the embed names, and what the embed sets itself, reach the look', async () => {
  const both = page();
  const named = page().items[0];
  named.code = 'govisit';
  named.is_default = false;
  named.elements[0].values.accent_color = '#0B6E4F';
  both.items.push(named);
  await withFetch(
    async () => ({ok: true, json: async () => both}),
    async () => {
      const wrapper = widget({
        inbox: ASSISTANT,
        appearanceProfile: 'govisit',
        embedKeys: 'title',
        title: 'Embed title',
        subtitle: 'Settings subtitle',
      });
      try {
        wrapper.componentDidMount();
        await settle();
        const look = shown(wrapper);
        assert.equal(look.accentColor, '#0B6E4F');
        assert.equal(look.header.title, 'Embed title');
        assert.equal(look.header.subtitle, 'Hotel Example');
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('a profile ID that is not an Assistant ID is drawn from its settings, with no read', async () => {
  await withFetch(
    async () => {
      throw new Error('no request expected');
    },
    async (calls) => {
      const wrapper = widget({inbox: 'hotel-paris', title: 'Ask us'});
      try {
        wrapper.componentDidMount();
        await settle();
        assert.equal(calls.length, 0);
        assert.equal(shown(wrapper).source, 'settings');
        assert.equal(shown(wrapper).header.title, 'Ask us');
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('one assistant is never shown in the look of another', async () => {
  const answers = [];
  await withFetch(
    () => new Promise((resolve) => answers.push(resolve)),
    async (calls) => {
      const wrapper = widget({inbox: ASSISTANT});
      const answer = (index, body) =>
        answers[index]({ok: true, json: async () => body});
      try {
        wrapper.componentDidMount();
        answer(0, page());
        await settle();
        assert.equal(shown(wrapper).source, 'profile');

        // The page switches the launcher to another assistant.
        const previous = wrapper.state;
        wrapper.handleConfigUpdate({inbox: OTHER});
        assert.equal(shown(wrapper).source, 'settings');
        wrapper.componentDidUpdate(wrapper.props, previous);
        assert.equal(calls.length, 2);
        assert.match(calls[1].url, new RegExp(`/assistants/${OTHER}/`));

        // And back, before the second read has answered: its late answer is
        // not the current assistant's.
        const between = wrapper.state;
        wrapper.handleConfigUpdate({inbox: ASSISTANT});
        wrapper.componentDidUpdate(wrapper.props, between);
        assert.equal(calls.length, 3);
        assert.equal(calls[1].options.signal.aborted, true);
        const late = page();
        late.items[0].elements[1].values.titles = 'The other assistant';
        answer(1, late);
        await settle();
        assert.equal(shown(wrapper).source, 'settings');

        answer(2, page());
        await settle();
        assert.equal(shown(wrapper).header.title, 'Zeptejte se nás');
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('a read that does not answer in time leaves the chat as it is', async () => {
  const realSetTimeout = global.setTimeout;
  const timers = [];
  const answers = [];
  await withFetch(
    () => new Promise((resolve) => answers.push(resolve)),
    async (calls) => {
      const wrapper = widget({inbox: ASSISTANT, title: 'Ask us'});
      global.setTimeout = (run, ms) => {
        timers.push({run, ms});
        return timers.length;
      };
      try {
        wrapper.componentDidMount();
      } finally {
        global.setTimeout = realSetTimeout;
      }
      try {
        assert.equal(calls.length, 1);
        assert.deepEqual(
          timers.map((timer) => timer.ms),
          [3000]
        );
        timers[0].run();
        assert.equal(calls[0].options.signal.aborted, true);
        // An answer that comes after the limit is too late to be drawn.
        answers[0]({ok: true, json: async () => page()});
        await settle();
        assert.equal(shown(wrapper).source, 'settings');
        assert.equal(shown(wrapper).header.title, 'Ask us');
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

// The launcher, `public/widget.js`: a committed bundle, so its functions are
// taken out of the served file itself.
const launcher = fs.readFileSync(
  path.join(__dirname, '../public/widget.js'),
  'utf8'
);
// A page of the read with a second profile, `govisit`, green and on the left.
const twoProfiles = () => {
  const both = page();
  const named = page().items[0];
  named.code = 'govisit';
  named.is_default = false;
  named.elements[0].values.accent_color = '#0B6E4F';
  named.elements[0].values.screen_side = 'left';
  both.items.push(named);
  return both;
};

test('the launcher takes its colour and side from the profile', () => {
  const overlay = bundledLauncherHandler('appearanceOverlay', {});
  const of = (...args) => ({...overlay(...args)});
  assert.deepEqual(of(page()), {color: '#465EA4', position: 'right'});
  assert.deepEqual(of(twoProfiles(), 'govisit'), {
    color: '#0B6E4F',
    position: 'left',
  });
  assert.deepEqual(of(twoProfiles(), 'gone'), {
    color: '#465EA4',
    position: 'right',
  });

  // A value the launcher cannot draw is left to the settings.
  const odd = page();
  odd.items[0].elements[0].values.accent_color = 'url(//evil)';
  assert.deepEqual(of(odd), {position: 'right'});
  odd.items[0].elements[0].values.screen_side = 'top';
  assert.deepEqual(of(odd), {});

  const anotherUi = page();
  anotherUi.items[0].ui = 'guest_directory';
  const noRoot = page();
  noRoot.items[0].elements.shift();
  const noDefault = page();
  noDefault.items[0].is_default = false;
  for (const nothing of [
    null,
    undefined,
    {},
    {items: 'none'},
    {items: []},
    anotherUi,
    noRoot,
    noDefault,
  ]) {
    assert.deepEqual(of(nothing), {});
  }
});

test('the launcher reads the profile for an Assistant ID only, and waits three seconds at most', async () => {
  const calls = [];
  const timers = [];
  const reader = (fetcher) =>
    bundledLauncherHandler(
      'fetchAppearanceOverlay',
      {},
      {
        fetch: (url, options) => {
          calls.push({url, options});
          return fetcher(url, options);
        },
        AbortController,
        setTimeout: (run, ms) => {
          timers.push({run, ms});
          return timers.length;
        },
        clearTimeout: () => {},
        Mq: 'https://backend.inhotel.io',
        cd: {
          appearanceOverlay: bundledLauncherHandler('appearanceOverlay', {}),
        },
      }
    );
  const answer = async (fetcher, ...args) => ({
    ...(await reader(fetcher)(...args)),
  });
  const profiles = async () => ({ok: true, json: async () => twoProfiles()});

  assert.deepEqual(await answer(profiles, 'hotel-paris'), {});
  assert.deepEqual(await answer(profiles, undefined), {});
  assert.equal(calls.length, 0);

  assert.deepEqual(await answer(profiles, ASSISTANT.toUpperCase()), {
    color: '#465EA4',
    position: 'right',
  });
  assert.equal(
    calls[0].url,
    `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&limit=200`
  );
  assert.equal(calls[0].options.credentials, 'omit');
  assert.deepEqual(await answer(profiles, ASSISTANT, 'govisit'), {
    color: '#0B6E4F',
    position: 'left',
  });

  for (const failing of [
    async () => ({ok: false, json: async () => twoProfiles()}),
    async () => {
      throw new Error('offline');
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('not JSON');
      },
    }),
  ]) {
    assert.deepEqual(await answer(failing, ASSISTANT), {});
  }

  // A page may have replaced `fetch` with something that throws.
  assert.deepEqual(
    await answer(() => {
      throw new Error('patched');
    }, ASSISTANT),
    {}
  );

  timers.length = 0;
  calls.length = 0;
  const slow = reader(() => new Promise(() => {}))(ASSISTANT);
  assert.deepEqual(
    timers.map((timer) => timer.ms),
    [3000]
  );
  timers[0].run();
  assert.deepEqual({...(await slow)}, {});
  assert.equal(calls[0].options.signal.aborted, true);
});

test('the launcher tells the iframe the page language and what the embed set itself', () => {
  const language = bundledLauncherHandler('pageLanguage', {});
  assert.equal(
    language({documentElement: {lang: 'cs'}}, {language: 'en-US'}),
    'cs'
  );
  assert.equal(
    language({documentElement: {lang: ''}}, {language: 'en-US'}),
    'en-US'
  );
  assert.equal(language({}, {}), '');
  assert.equal(language({documentElement: {lang: '"><script>'}}, {}), '');
  // A tag the read cannot take gives way to the browser's language.
  assert.equal(
    language({documentElement: {lang: '"><script>'}}, {language: 'en-US'}),
    'en-US'
  );
  assert.equal(language({documentElement: {lang: 'cs_CZ'}}, {}), 'cs-CZ');
  assert.equal(
    language({documentElement: {lang: 'de-Latn-DE-1996'}}, {}),
    'de-Latn-DE'
  );

  const keys = bundledLauncherHandler('embedKeysOf', {});
  assert.equal(
    keys({
      title: 'Ask our team',
      subtitle: '',
      primaryColor: '#465EA4',
      position: 'left',
      greeting: undefined,
      newMessagePlaceholder: null,
    }),
    'title,primaryColor'
  );
  assert.equal(keys({}), '');
  // The launcher sends a setting on only when it is truthy, so only then is
  // it the embed's own.
  assert.equal(
    keys({title: 0, greeting: false, subtitle: 'Any time'}),
    'subtitle'
  );
});

// The launcher's own code, run as it is in the served file. Each piece is
// taken out by the lines that open and close it, so an edit that moves one of
// those lines fails here loudly.
const launcherLines = launcher.split('\n');
const lineOf = (pattern) => {
  const index = launcherLines.findIndex((line) => pattern.test(line));
  if (index < 0) throw new Error('Launcher code not found: ' + pattern);
  return index;
};
const piece = (from, to, last = 0) =>
  launcherLines.slice(lineOf(from), lineOf(to) + last).join('\n');
// The settings read: the bundle's async helpers, `Pq` and the `cd.*` helpers.
const settingsRead = () =>
  piece(/^    var Nq =$/, /cd\.updateWidgetSettingsMetadata = Qq;/, 1);
// A legacy settings service and a profile read, as the launcher sees them.
const launcherWorld = ({legacy, profiles, queries = [], reads = []}) => ({
  cd: {},
  Mq: 'https://backend.inhotel.io',
  za: (module) => ({d: module}),
  Jj: {
    get: (url) => ({
      query: (query) => {
        queries.push({url, query});
        return legacy
          ? Promise.resolve({body: {data: JSON.parse(JSON.stringify(legacy))}})
          : Promise.reject(new Error('404'));
      },
    }),
  },
  fetch: async (url) => {
    reads.push(url);
    return profiles ? {ok: true, json: async () => profiles} : {ok: false};
  },
  AbortController,
  setTimeout,
  clearTimeout,
});

test('the launcher bundle is a script a browser can run', () => {
  assert.doesNotThrow(() => new vm.Script(launcher, {filename: 'widget.js'}));
});

test('the launcher lays the profile over the legacy settings, and one failed read leaves the other', async () => {
  const legacy = {title: 'Legacy title', color: '#111111', position: 'left'};
  const read = async (world, query) => {
    const context = launcherWorld(world);
    vm.runInNewContext(settingsRead() + '\n;this.Pq = Pq;', context);
    return {
      ...(await context.Pq({account_id: -1, inbox_id: ASSISTANT, ...query})),
    };
  };

  const queries = [];
  const reads = [];
  assert.deepEqual(
    await read({legacy, profiles: twoProfiles(), queries, reads}),
    {
      title: 'Legacy title',
      color: '#465EA4',
      position: 'right',
    }
  );
  // The legacy service is asked what it always was, and nothing more.
  assert.deepEqual(JSON.parse(JSON.stringify(queries)), [
    {
      url: 'https://backend.inhotel.io/public/get_widget_settings',
      query: {account_id: -1, inbox_id: ASSISTANT},
    },
  ]);
  assert.equal(reads.length, 1);

  assert.deepEqual(
    await read(
      {legacy, profiles: twoProfiles()},
      {appearance_profile: 'govisit'}
    ),
    {title: 'Legacy title', color: '#0B6E4F', position: 'left'}
  );
  assert.deepEqual(await read({legacy, profiles: null}), legacy);
  assert.deepEqual(await read({legacy: null, profiles: twoProfiles()}), {
    color: '#465EA4',
    position: 'right',
  });
  assert.deepEqual(await read({legacy: null, profiles: null}), {});
});

test('the launcher hands the iframe the colour, the side and what it needs to read the profile', async () => {
  // The launcher component's real mount step and its settings call.
  const helpers =
    'var ' + piece(/^      fd =$/, /^      Wq =$/).replace(/,\s*$/, '') + ';';
  const positions =
    'var ' +
    piece(/^      fg = 20,$/, /^      Zq = function \(t\) \{$/).replace(
      /,\s*$/,
      ''
    ) +
    ';';
  const mount = piece(
    /\(t\.prototype\.componentDidMount = function \(\) \{/,
    /\(t\.prototype\.componentWillUnmount = function \(\) \{/
  )
    .replace(/^\s*\(t\.prototype\.componentDidMount = /, 'componentDidMount = ')
    .replace(/\),\s*$/, ';');
  const settingsCall = piece(
    /\(n\.fetchWidgetSettings = function \(\) \{/,
    /\(n\.updateWidgetSettingsMetadata = function \(\) \{/
  )
    .replace(/^\s*\(n\.fetchWidgetSettings = /, 'fetchWidgetSettings = ')
    .replace(/\),\s*$/, ';');

  const handed = async ({props = {}, legacy, profiles, lang = ''}) => {
    const state = {};
    const context = {
      ...launcherWorld({legacy, profiles}),
      // Names the mount step reads from the rest of the bundle.
      ob: {},
      di: {},
      yc: {stringify: () => ''},
      console: {log() {}, warn() {}, error() {}},
      document: {documentElement: {lang}},
      navigator: {language: 'en-US'},
      window: {location: {origin: 'https://hotel.example'}},
      Uq: function () {},
      yD: () => () => {},
      zD: () => () => {},
      Tq: () => ({getCustomerId: () => null}),
      Qj: () => ({}),
      Bb: Object.assign,
      xe: Object.assign,
    };
    vm.runInNewContext(
      [
        settingsRead(),
        helpers,
        positions,
        'var componentDidMount, fetchWidgetSettings, n;',
        'this.make = function (component) { n = component; ' +
          settingsCall +
          mount +
          ' return {componentDidMount: componentDidMount, fetchWidgetSettings: fetchWidgetSettings}; };',
      ].join('\n'),
      context
    );
    const component = {
      props: {
        canToggle: true,
        baseUrl: 'https://backend.inhotel.io',
        token: -1,
        inbox: ASSISTANT,
        position: 'right',
        ...props,
      },
      setState: (change) => Object.assign(state, change),
      postMessageHandlers() {},
      customEventHandlers() {},
      EVENTS: [],
      getDefaultTitle(settings) {
        return Promise.resolve(this.props.title || settings.title);
      },
      getDefaultSubtitle(settings) {
        return Promise.resolve(this.props.subtitle || settings.subtitle);
      },
      getDefaultGreeting(settings) {
        return Promise.resolve(this.props.greeting || settings.greeting);
      },
      updateWidgetSettingsMetadata: () => Promise.resolve(),
    };
    const made = context.make(component);
    component.fetchWidgetSettings = made.fetchWidgetSettings;
    await made.componentDidMount.call(component);
    const {
      primaryColor,
      position,
      title,
      appearanceProfile,
      locale,
      embedKeys,
    } = state.config;
    return {
      primaryColor,
      position,
      title,
      appearanceProfile,
      locale,
      embedKeys,
    };
  };
  const legacy = {title: 'Legacy title', color: '#111111', position: 'left'};

  // Without a profile: the legacy settings, as before, and the page language.
  assert.deepEqual(await handed({legacy, profiles: null, lang: 'cs'}), {
    primaryColor: '#111111',
    position: 'left',
    title: 'Legacy title',
    appearanceProfile: undefined,
    locale: 'cs',
    embedKeys: '',
  });
  // The profile's colour and side stand in front of the legacy ones.
  assert.deepEqual(await handed({legacy, profiles: twoProfiles()}), {
    primaryColor: '#465EA4',
    position: 'right',
    title: 'Legacy title',
    appearanceProfile: undefined,
    locale: 'en-US',
    embedKeys: '',
  });
  // What the page set in its own embed stands in front of both, and is named.
  assert.deepEqual(
    await handed({
      legacy,
      profiles: twoProfiles(),
      props: {
        primaryColor: '#ff0000',
        title: 'Embed title',
        appearanceProfile: 'govisit',
      },
    }),
    {
      primaryColor: '#ff0000',
      position: 'left',
      title: 'Embed title',
      appearanceProfile: 'govisit',
      locale: 'en-US',
      embedKeys: 'title,primaryColor',
    }
  );
});

test('the embed can name the profile to draw', () => {
  const bootstrap = launcher.slice(
    launcher.indexOf('    var ye = function () {},'),
    launcher.indexOf('    var sr = document.createElement')
  );
  const named = ({attribute, config} = {}) =>
    vm.runInNewContext(bootstrap + '\n({code: appearanceProfile});', {
      window: {
        FloatingChatWindow: {
          config: {
            agent_card_url: `https://${ASSISTANT}.agents.inhotel.io/.well-known/agent-card.json`,
            ...config,
          },
        },
      },
      document: {
        currentScript: {
          getAttribute: (name) =>
            name === 'data-appearance-profile' ? attribute : null,
        },
      },
      ACCOUNT_ID: -1,
    }).code;
  assert.equal(named({attribute: 'govisit'}), 'govisit');
  assert.equal(named({config: {appearance_profile: 'summer'}}), 'summer');
  assert.equal(
    named({attribute: 'govisit', config: {appearance_profile: 'summer'}}),
    'govisit'
  );
  assert.equal(named(), undefined);
});

test('the launcher wires the profile into its settings and the iframe configuration', () => {
  for (const wiring of [
    // The bootstrap hands the named profile to the launcher component,
    /appearanceProfile: appearanceProfile,/,
    // which asks for it together with the legacy settings,
    /appearance_profile: e\.appearanceProfile/,
    /cd\.fetchAppearanceOverlay\(t\.inbox_id, t\.appearance_profile\)/,
    // and tells the iframe what it needs to read the profile itself.
    /T\.appearanceProfile = this\.props\.appearanceProfile/,
    /T\.locale = cd\.pageLanguage\(document, navigator\)/,
    /T\.embedKeys = cd\.embedKeysOf\(this\.props\)/,
  ]) {
    assert.match(launcher, wiring);
  }
});

(async () => {
  let failed = 0;
  for (const {name, run} of tests) {
    try {
      await run();
      console.log('PASS ' + name);
    } catch (error) {
      failed++;
      console.error('FAIL ' + name + '\n' + error.stack);
    }
  }
  console.log(
    `${tests.length - failed}/${tests.length} appearance checks passed`
  );
  if (failed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
