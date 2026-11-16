// An assistant's appearance profile: the model the chat draws from, the read,
// the blocks and the launcher. Nothing here contacts a hosted service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
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
            titles: 'Zeptejte se nÃ¡s',
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
    header: {title: 'Zeptejte se nÃ¡s', subtitle: 'Hotel Example'},
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
    title: 'Zeptejte se nÃ¡s',
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
  assert.equal(plain.header.title, 'Zeptejte se nÃ¡s');
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
  // `all` asks the read for every language at once, which is not a text.
  for (const no of ['en_US', 'all', '<script>', '', null, 'x'.repeat(40)]) {
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
        `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&locale=cs`
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
        `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat`
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
  assert.match(markup, /<h2[^>]*>Zeptejte se nÃ¡s<\/h2>/);
  assert.match(markup, />Hotel Example</);
  assert.match(markup, /placeholder="Zeptejte se na cokoli\.\.\."/);

  const form = html(chat({appearance: look}, {isMailIconClicked: true}));
  assert.match(form, />Write to us</);
  assert.doesNotMatch(form, />Contact Us</);

  const sent = html(
    chat(
      {appearance: look},
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

test('the envelope is there only when the look has the contact form', () => {
  const look = (hasForm) => ({
    ...whole(),
    contact: {...whole().contact, hasForm},
  });
  const envelope = /data-contact-form-control="true"/;
  assert.match(html(chat({appearance: look(true)})), envelope);
  assert.doesNotMatch(html(chat({appearance: look(false)})), envelope);
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

test('on a phone the close control stays when the header is left out', () => {
  const look = {...whole(), header: null};
  const phone = html(
    chat({appearance: look, isMobile: true, isCloseable: true})
  );
  assert.match(phone, /class="CloseIcon"/);
  assert.doesNotMatch(phone, /<h2/);

  const desktop = html(chat({appearance: look, isCloseable: true}));
  assert.doesNotMatch(desktop, /class="CloseIcon"/);
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
