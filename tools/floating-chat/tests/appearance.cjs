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
