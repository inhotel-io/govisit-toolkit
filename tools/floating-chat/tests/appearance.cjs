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
// A hover text is not in static markup. A stand-in for the tooltip writes it
// on the element it belongs to, where a check can read it.
const tooltip = require.resolve('@tippyjs/react');
require.cache[tooltip] = {
  id: tooltip,
  filename: tooltip,
  loaded: true,
  exports: {
    __esModule: true,
    default: ({content, children}) =>
      require('react').cloneElement(children, {'data-hint': content}),
  },
};
const appearanceModel = require('../helpers/appearance.ts');
const {
  settingsAppearance,
  profileAppearance,
  resolveAppearance,
  pickProfile,
  embedProfile,
  isAssistantId,
  isProfileCode,
  localeTag,
  embedKeys,
  launcherAppearance,
  readProfile,
} = appearanceModel;
const {guardedFetch} = require('../helpers/playground.ts');
const library = require('../appearance-library.json');
const {fetchAppearanceProfile} = require('../helpers/appearance-api.ts');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ChatWindow = require('../components/ChatWindow.tsx').default;
const ContactForm = require('../components/ContactForm.tsx').default;
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
const BRANDING = {
  text: 'Powered by',
  name: 'inHotel',
  linkUrl: 'https://www.inhotel.io',
};
// The contact line and its form as the chat has always had them.
const SETTINGS_CONTACT = {
  phone: null,
  email: null,
  firstCopyHint: 'Copy to clipboard',
  copyHint: 'Click to copy',
  copiedNote: 'Copied!',
  copyFailedNote: 'Failed to copy',
  form: {
    isOffered: false,
    title: 'Contact Us',
    firstName: {label: 'First Name', isRequired: true},
    lastName: {label: 'Last Name', isRequired: true},
    email: {label: 'Email', isRequired: true},
    message: {label: 'Message', isRequired: true},
    sendLabel: 'Send',
    sendingLabel: 'Sending',
    discardLabel: 'Discard',
    openHint: 'Contact Us',
    sendHint: 'Send as email',
    discardHint: 'Discard message',
    confirmation: CONFIRMATION,
  },
};
// The same two as the profile below describes them.
const PROFILE_CONTACT = {
  phone: null,
  email: null,
  firstCopyHint: 'Click to copy',
  copyHint: 'Click to copy',
  copiedNote: 'Copied!',
  copyFailedNote: 'Failed to copy',
  form: {
    isOffered: true,
    title: 'Contact Us',
    firstName: {label: 'Jméno', isRequired: true},
    lastName: {label: 'Příjmení', isRequired: false},
    email: {label: 'E-mail', isRequired: true},
    message: {label: 'Zpráva', isRequired: true},
    sendLabel: 'Send',
    sendingLabel: 'Sending',
    discardLabel: 'Discard',
    openHint: 'Contact Us',
    sendHint: 'Send',
    discardHint: 'Discard',
    confirmation: CONFIRMATION,
  },
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
            launcher: 'launcher',
            suggestions: 'suggestions',
          },
        },
        {
          name: 'launcher',
          component: 'Launcher',
          values: {icon: 'outlined', has_greeting_preview: false},
        },
        {name: 'suggestions', component: 'Suggestions', values: {limit: 3}},
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
            form: 'form',
            copy_hints: 'Click to copy',
            copied_notes: 'Copied!',
            copy_failed_notes: 'Failed to copy',
          },
        },
        {
          name: 'form',
          component: 'ContactForm',
          values: {
            titles: 'Contact Us',
            first_name: 'first_name',
            last_name: 'last_name',
            email: 'email',
            message: 'message',
            send_labels: 'Send',
            sending_labels: 'Sending',
            discard_labels: 'Discard',
            confirmations: CONFIRMATION,
          },
        },
        {
          name: 'first_name',
          component: 'FormField',
          values: {labels: 'Jméno', is_required: true},
        },
        {
          name: 'last_name',
          component: 'FormField',
          values: {labels: 'Příjmení', is_required: false},
        },
        {
          name: 'email',
          component: 'FormField',
          values: {labels: 'E-mail', is_required: true},
        },
        {
          name: 'message',
          component: 'FormField',
          values: {labels: 'Zpráva', is_required: true},
        },
        {
          name: 'branding',
          component: 'Branding',
          values: {
            texts: 'Powered by',
            name: 'inHotel',
            link_url: 'https://www.inhotel.io',
          },
        },
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
    contact: SETTINGS_CONTACT,
    branding: BRANDING,
    suggestions: null,
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
  assert.equal(look.contact.form.isOffered, true);
});

test('a whole profile fills every block', () => {
  assert.deepEqual(profileAppearance(profile(), {}, []), {
    source: 'profile',
    accentColor: '#465EA4',
    header: {title: 'Zeptejte se nás', subtitle: 'Hotel Example'},
    greeting: {text: 'Dobrý den, jak vám mohu pomoci?'},
    composer: {placeholder: 'Zeptejte se na cokoli...'},
    contact: PROFILE_CONTACT,
    branding: BRANDING,
    suggestions: {limit: 3},
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
  assert.equal(look.branding, null);
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
      element('contact').values.phone = 420224000000;
      element('contact').values.copy_hints = ['Click'];
      element('form').values.titles = '';
      element('form').values.send_labels = null;
      element('email').values.labels = {cs: 'E-mail'};
      element('email').values.is_required = 'yes';
      element('branding').values.name = '   ';
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
  assert.equal(look.contact.phone, null);
  assert.equal(look.contact.copyHint, 'Click to copy');
  assert.equal(look.contact.form.title, 'Contact Us');
  assert.equal(look.contact.form.sendLabel, 'Send');
  assert.deepEqual(look.contact.form.email, {label: 'Email', isRequired: true});
  assert.equal(look.branding.name, 'inHotel');
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

test('the contact form has the fields its profile lists, each with its own words', () => {
  const form = profileAppearance(
    profile((item, element) => {
      delete element('form').values.last_name;
      element('first_name').values.labels = 'Your name';
      Object.assign(element('form').values, {
        titles: 'Write to us',
        send_labels: 'Send it',
        sending_labels: 'On its way',
        discard_labels: 'Close',
        confirmations: 'We will answer today.',
      });
    }),
    {},
    []
  ).contact.form;
  assert.deepEqual(form, {
    isOffered: true,
    title: 'Write to us',
    firstName: {label: 'Your name', isRequired: true},
    lastName: null,
    email: {label: 'E-mail', isRequired: true},
    message: {label: 'Zpráva', isRequired: true},
    sendLabel: 'Send it',
    sendingLabel: 'On its way',
    discardLabel: 'Close',
    // What the controls say on hover follows their words.
    openHint: 'Write to us',
    sendHint: 'Send it',
    discardHint: 'Close',
    confirmation: 'We will answer today.',
  });
});

test('a field with no words of its own takes its name', () => {
  const form = profileAppearance(
    profile((item, element) => {
      for (const name of ['first_name', 'last_name', 'email', 'message'])
        element(name).values = {};
    }),
    {},
    []
  ).contact.form;
  assert.deepEqual(
    [form.firstName, form.lastName, form.email, form.message],
    ['First Name', 'Last Name', 'Email', 'Message'].map((label) => ({
      label,
      isRequired: true,
    }))
  );
});

test('a contact line without a form, or with a form of no fields, offers none', () => {
  const without = profileAppearance(
    profile((item, element) => {
      delete element('contact').values.form;
    }),
    {},
    []
  );
  assert.equal(without.contact.form, null);
  assert.equal(without.contact.copyHint, 'Click to copy');

  const empty = profileAppearance(
    profile((item, element) => {
      element('form').values = {titles: 'Write to us'};
    }),
    {},
    []
  );
  assert.equal(empty.contact.form, null);

  // A slot of the form holds a field and nothing else.
  const wrong = profileAppearance(
    profile((item, element) => {
      element('form').values.email = 'header';
      element('form').values.message = 'missing';
    }),
    {},
    []
  ).contact.form;
  assert.equal(wrong.email, null);
  assert.equal(wrong.message, null);
  assert.deepEqual(wrong.firstName, {label: 'Jméno', isRequired: true});
});

test('the contact line shows the phone and the e-mail its profile gives', () => {
  const look = profileAppearance(
    profile((item, element) => {
      Object.assign(element('contact').values, {
        phone: '+420 224 000 000',
        email: 'stay@hotel.example',
        copy_hints: 'Kliknutím zkopírujete',
        copied_notes: 'Zkopírováno',
        copy_failed_notes: 'Nepodařilo se',
      });
    }),
    {},
    []
  ).contact;
  assert.equal(look.phone, '+420 224 000 000');
  assert.equal(look.email, 'stay@hotel.example');
  // A profile has one hint, before a copy and after it.
  assert.equal(look.firstCopyHint, 'Kliknutím zkopírujete');
  assert.equal(look.copyHint, 'Kliknutím zkopírujete');
  assert.equal(look.copiedNote, 'Zkopírováno');
  assert.equal(look.copyFailedNote, 'Nepodařilo se');
});

test('the branding line says what its profile gives it, and only a web address is a link', () => {
  const branding = (values) =>
    profileAppearance(
      profile((item, element) => {
        element('branding').values = values;
      }),
      {},
      []
    ).branding;
  assert.deepEqual(branding({}), BRANDING);
  assert.deepEqual(
    branding({
      texts: 'Provozuje',
      name: 'Example Chat',
      link_url: 'https://chat.example/about',
    }),
    {
      text: 'Provozuje',
      name: 'Example Chat',
      linkUrl: 'https://chat.example/about',
    }
  );
  for (const address of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//chat.example',
    'chat.example',
    ' https://chat.example',
  ]) {
    assert.equal(branding({link_url: address}).linkUrl, null, address);
  }
});

test('an element that holds itself is not followed', () => {
  // This UI's library gives every slot one component, so no profile of it can
  // go round. A library may leave a slot open to any component; then one can.
  const open = [
    {
      name: 'Box',
      kind: 'component',
      is_root: true,
      props: [
        {name: 'inside', type: 'element', child_component: null},
        {name: 'words', type: 'text'},
      ],
    },
  ];
  const round = {
    elements: [
      {name: 'root', component: 'Box', values: {inside: 'a', words: 'root'}},
      {name: 'a', component: 'Box', values: {inside: 'b', words: 'a'}},
      {name: 'b', component: 'Box', values: {inside: 'a', words: 'b'}},
    ],
  };
  const root = readProfile(round, open);
  assert.equal(root.values.words, 'root');
  assert.equal(root.values.inside.values.words, 'a');
  assert.equal(root.values.inside.values.inside.values.words, 'b');
  // `b` names `a`, which it sits in.
  assert.equal(root.values.inside.values.inside.values.inside, null);

  const self = {
    elements: [{name: 'root', component: 'Box', values: {inside: 'root'}}],
  };
  assert.equal(readProfile(self, open).values.inside, null);
});

test('a text that is one value for every language is not cut: too long, it is not taken', () => {
  const look = (values) =>
    profileAppearance(
      profile((item, element) => {
        Object.assign(element('branding').values, values);
        Object.assign(element('contact').values, values);
      }),
      {},
      []
    );
  const address = 'https://chat.example/' + 'a'.repeat(250);
  assert.equal(address.length > 255, true);
  // A cut address would lead somewhere else, and a cut number would ring
  // someone else.
  assert.equal(look({link_url: address}).branding.linkUrl, BRANDING.linkUrl);
  assert.equal(look({phone: '+420 ' + '1'.repeat(40)}).contact.phone, null);
  assert.equal(look({name: 'N'.repeat(101)}).branding.name, 'inHotel');
  assert.equal(look({name: 'N'.repeat(100)}).branding.name, 'N'.repeat(100));
  // Words in a language are cut to what their prop takes.
  assert.equal(
    profileAppearance(
      profile((item, element) => {
        element('header').values.titles = 'T'.repeat(300);
      }),
      {},
      []
    ).header.title,
    'T'.repeat(255)
  );
});

test('a profile the page gives itself decides the branding line too', () => {
  const given = (branding) => ({
    elements: [
      {
        name: 'root',
        component: 'FloatingChat',
        values: {header: 'header', ...(branding ? {branding: 'branding'} : {})},
      },
      {name: 'header', component: 'Header', values: {}},
      ...(branding
        ? [{name: 'branding', component: 'Branding', values: branding}]
        : []),
    ],
  });
  const look = (branding) =>
    resolveAppearance(embedProfile(given(branding), 'cs'), {}, []);
  // Left out, the chat has no branding line.
  assert.equal(look(null).source, 'profile');
  assert.equal(look(null).branding, null);
  // Named with nothing of its own, it is the chat's own line.
  assert.deepEqual(look({}).branding, BRANDING);
  // In the page's words, and in the page's language.
  assert.deepEqual(
    look({
      texts: {en: 'Chat by', cs: 'Provozuje'},
      name: 'Example Chat',
      link_url: 'https://chat.example',
    }).branding,
    {text: 'Provozuje', name: 'Example Chat', linkUrl: 'https://chat.example'}
  );
});

// Every prop of the library, with a value that is not its default.
const otherValue = (prop) => {
  switch (prop.type) {
    case 'text':
      return prop.name === 'link_url' ? 'https://chat.example/x' : 'Other';
    case 'texts':
      return 'Other words';
    case 'color':
      return '#123456';
    case 'boolean':
      return !prop.default;
    case 'option':
      return prop.options.find((option) => option !== prop.default);
    case 'number':
      return prop.default === prop.value_max ? prop.value_min : prop.value_max;
    default:
      return undefined;
  }
};

test('the chat has a default for what the library gives one, and the same one', () => {
  const byName = (name) =>
    library.components.find((component) => component.name === name);
  const defaultOf = (component, prop) => {
    const value = byName(component).props.find((p) => p.name === prop).default;
    return value && typeof value === 'object' ? value.en : value;
  };
  const look = settingsAppearance({});
  assert.equal(look.header.title, defaultOf('Header', 'titles'));
  assert.equal(look.header.subtitle, defaultOf('Header', 'subtitles'));
  assert.equal(
    look.composer.placeholder,
    defaultOf('Composer', 'input_placeholders')
  );
  assert.equal(look.contact.form.title, defaultOf('ContactForm', 'titles'));
  assert.equal(
    look.contact.form.confirmation,
    defaultOf('ContactForm', 'confirmations')
  );
  assert.equal(look.contact.copyHint, defaultOf('Contact', 'copy_hints'));
  assert.equal(look.branding.name, defaultOf('Branding', 'name'));
  assert.equal(
    look.messages.assistantBubbleColor,
    defaultOf('Messages', 'assistant_bubble_color')
  );
  // The library is this UI's, with one root to start from.
  assert.equal(library.ui, 'floating_chat');
  assert.deepEqual(
    library.components.filter((c) => c.is_root).map((c) => c.name),
    ['FloatingChat']
  );
});

test('the README lists the library as the file has it', () => {
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  const listed = readme
    .slice(
      readme.indexOf('<!-- library:start -->'),
      readme.indexOf('<!-- library:end -->')
    )
    .split('\n')
    .filter((line) => line.startsWith('| `'));
  assert.deepEqual(
    listed,
    library.components.map(
      (component) =>
        '| `' +
        component.name +
        '` | ' +
        component.description +
        (component.kind === 'object' ? ' A group of values, not a part.' : '') +
        ' | ' +
        component.props.map((prop) => '`' + prop.name + '`').join(', ') +
        ' |'
    )
  );
});

test('every prop of the library changes what the chat draws', () => {
  // The launcher draws the button and the side itself; its own checks are
  // further down.
  const drawnByLauncher = (component, prop) =>
    component.name === 'Launcher' ||
    (component.is_root && ['screen_side', 'launcher'].includes(prop.name));
  // A profile in which no value is its default, so that taking any one prop
  // away shows.
  const full = () =>
    profile((item) => {
      for (const element of item.elements) {
        const component = library.components.find(
          (c) => c.name === element.component
        );
        for (const prop of component.props) {
          if (prop.type !== 'element')
            element.values[prop.name] = otherValue(prop);
        }
      }
    });
  const before = JSON.stringify(profileAppearance(full(), {}, []));
  let read = 0;
  for (const component of library.components) {
    for (const prop of component.props) {
      if (drawnByLauncher(component, prop)) continue;
      const without = full();
      for (const element of without.elements) {
        if (element.component === component.name)
          delete element.values[prop.name];
      }
      assert.notEqual(
        JSON.stringify(profileAppearance(without, {}, [])),
        before,
        `${component.name}.${prop.name} is not read`
      );
      read++;
    }
  }
  // 42 props in all: the launcher's two, and the two of the root it draws.
  assert.equal(read, 38);
});

test('a profile the page gives in its embed is read in the page’s language', () => {
  const given = {
    elements: [
      {
        name: 'root',
        component: 'FloatingChat',
        values: {header: 'header', accent_color: '#0B6E4F', contact: 'contact'},
      },
      {
        name: 'header',
        component: 'Header',
        values: {
          titles: {en: 'Ask us', cs: 'Zeptejte se', 'pt-BR': 'Pergunte'},
          subtitles: 'One text for every language',
        },
      },
      {name: 'contact', component: 'Contact', values: {phone: '+1 555 0100'}},
    ],
  };
  const title = (locale) =>
    profileAppearance(embedProfile(given, locale), {}, []).header.title;
  assert.equal(title('cs'), 'Zeptejte se');
  assert.equal(title('cs-CZ'), 'Zeptejte se');
  assert.equal(title('pt-BR'), 'Pergunte');
  assert.equal(title('pt_br'), 'Pergunte');
  given.elements[1].values.titles = {
    en: 'Ask us',
    cs: 'Zeptejte se',
    pt_BR: 'Pergunte',
  };
  assert.equal(title('pt-BR'), 'Pergunte');
  given.elements[1].values.titles = {
    en: 'Ask us',
    cs: 'Zeptejte se',
    'pt-BR': 'Pergunte',
  };
  // A language the profile does not have falls back to English, then to any.
  assert.equal(title('de'), 'Ask us');
  assert.equal(title(undefined), 'Ask us');
  delete given.elements[1].values.titles.en;
  assert.equal(title('de'), 'Zeptejte se');

  const look = profileAppearance(embedProfile(given, 'cs'), {}, []);
  assert.equal(look.source, 'profile');
  assert.equal(look.header.subtitle, 'One text for every language');
  assert.equal(look.accentColor, '#0B6E4F');
  assert.equal(look.contact.phone, '+1 555 0100');
  assert.equal(look.composer, null);

  // It is this UI's profile, and the one to draw.
  const read = embedProfile(given, 'cs');
  assert.equal(read.ui, 'floating_chat');
  assert.equal(read.is_default, true);
  assert.equal(pickProfile({items: [read]}), read);
});

test('what is not a profile is not taken from the embed', () => {
  for (const value of [
    undefined,
    null,
    'root = FloatingChat()',
    42,
    [],
    {},
    {elements: 'none'},
    {elements: []},
    {elements: [{name: 'root'}]},
  ]) {
    assert.equal(embedProfile(value, 'en'), null);
  }
  // No more elements than a chat can have are kept.
  const many = {
    elements: Array.from({length: 500}, (_, index) => ({
      name: index ? `field_${index}` : 'root',
      component: index ? 'FormField' : 'FloatingChat',
      values: {},
    })),
  };
  assert.equal(embedProfile(many, 'en').elements.length, 50);
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
  // The assistant's phone gives the contact line something to show.
  const phone = {hotelPhone: '+420 111 111 111'};
  assert.deepEqual(
    blocksIn(html(chat({...phone, appearance: whole()}))),
    BLOCKS
  );
  assert.deepEqual(
    blocksIn(html(chat({...phone, appearance: {...whole(), header: null}}))),
    ['Messages', 'Composer', 'Contact', 'Branding']
  );
  assert.deepEqual(
    blocksIn(
      html(
        chat({
          ...phone,
          appearance: {
            ...whole(),
            composer: null,
            contact: null,
            branding: null,
          },
        })
      )
    ),
    ['Header', 'Messages']
  );
  // A contact line with no phone, no e-mail and no form to offer is not
  // drawn, although the profile lists it.
  assert.deepEqual(blocksIn(html(chat({appearance: whole()}))), [
    'Header',
    'Messages',
    'Composer',
    'Branding',
  ]);
});

test('each block says what the look gives it', () => {
  const look = {
    ...whole(),
    contact: {
      ...whole().contact,
      form: {
        ...whole().contact.form,
        title: 'Write to us',
        confirmation: 'We will answer today.',
      },
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
    contact: {
      ...whole().contact,
      form: hasForm ? whole().contact.form : null,
    },
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

// The contact form of a look, open, for an assistant with an e-mail to send
// it to.
const HOTEL_EMAIL = 'stay@hotel.example';
const withForm = (form = {}, contact = {}) => ({
  ...whole(),
  contact: {
    ...whole().contact,
    ...contact,
    form: {...whole().contact.form, ...form},
  },
});
const openForm = (look, state = {}) =>
  chat(
    {appearance: look, hotelEmail: HOTEL_EMAIL},
    {isMailIconClicked: true, ...state}
  );
const placeholders = (markup) =>
  [...markup.matchAll(/<(?:input|textarea)[^>]*>/g)].map((field) => [
    /name="([^"]*)"/.exec(field[0])[1],
    /placeholder="([^"]*)"/.exec(field[0])[1],
  ]);

test('the contact form draws the fields of its look, each with its own words', () => {
  assert.deepEqual(placeholders(html(openForm(withForm()))), [
    ['firstName', 'Jméno'],
    ['lastName', 'Příjmení'],
    ['email', 'E-mail'],
    ['message', 'Zpráva'],
  ]);
  assert.deepEqual(
    placeholders(
      html(
        openForm(
          withForm({
            lastName: null,
            email: {label: 'Where we can answer you', isRequired: true},
          })
        )
      )
    ),
    [
      ['firstName', 'Jméno'],
      ['email', 'Where we can answer you'],
      ['message', 'Zpráva'],
    ]
  );
  assert.deepEqual(
    placeholders(
      html(openForm(withForm({firstName: null, lastName: null, email: null})))
    ),
    [['message', 'Zpráva']]
  );
});

test('the buttons of the contact form say what the look gives them', () => {
  const look = withForm({
    sendLabel: 'Odeslat',
    sendingLabel: 'Odesílá se',
    discardLabel: 'Zahodit',
  });
  const open = html(openForm(look));
  assert.match(open, />Odeslat</);
  assert.match(open, />Zahodit</);
  assert.doesNotMatch(open, />Send</);
  assert.doesNotMatch(open, />Discard</);

  const sending = html(openForm(look, {isLoading: true}));
  assert.match(sending, />Odesílá se</);
  assert.doesNotMatch(sending, />Sending</);

  // Without a profile they say what they always have.
  const plain = html(
    chat({shouldShowContactForm: true}, {isMailIconClicked: true})
  );
  assert.match(plain, />Send</);
  assert.match(plain, />Discard</);
  assert.deepEqual(placeholders(plain), [
    ['firstName', 'First Name'],
    ['lastName', 'Last Name'],
    ['email', 'Email'],
    ['message', 'Message'],
  ]);
});

// What the chat sends of the contact form, or null when it sends nothing.
async function sentForm(look, filled) {
  let body = null;
  await withFetch(
    (url, options) => {
      body = JSON.parse(options.body);
      return Promise.resolve({ok: true, json: async () => ({status: 1})});
    },
    async () => {
      const instance = openForm(look, filled);
      quietly(() => instance.handleSubmitCF());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  );
  return body;
}

test('the contact form is sent once the fields it requires are filled', async () => {
  const filled = {
    firstName: 'Ada',
    lastName: null,
    email: 'ada@guest.example',
    message: 'Is breakfast included?',
  };
  // The fixture's last name is not required.
  assert.deepEqual(await sentForm(withForm(), filled), {
    firstname: 'Ada',
    lastname: '',
    email: 'ada@guest.example',
    message: 'Is breakfast included?',
    inbox_id: ASSISTANT,
  });
  assert.equal(await sentForm(withForm(), {...filled, email: null}), null);
  assert.equal(
    await sentForm(
      withForm({lastName: {label: 'Příjmení', isRequired: true}}),
      filled
    ),
    null
  );
});

test('a field the form does not have is sent empty, whatever was typed before', async () => {
  const body = await sentForm(withForm({firstName: null, lastName: null}), {
    firstName: 'Left from another look',
    lastName: null,
    email: 'ada@guest.example',
    message: 'Hello',
  });
  assert.equal(body.firstname, '');
  assert.equal(body.lastname, '');
  assert.equal(body.email, 'ada@guest.example');
});

test('only a field the form requires is marked when it is left empty', () => {
  const marked = (look) =>
    count(
      html(openForm(look, {clickedSubmit: true, firstName: 'Ada'})),
      /border-color:red/g
    );
  // First name is filled, last name is not required: e-mail and message.
  assert.equal(marked(withForm()), 2);
  assert.equal(
    marked(withForm({message: {label: 'Zpráva', isRequired: false}})),
    1
  );
  assert.equal(marked(withForm({email: null, message: null})), 0);
});

test('the contact line shows the phone and e-mail of its look, else the assistant’s own', () => {
  const own = {hotelEmail: HOTEL_EMAIL, hotelPhone: '+420 111 111 111'};
  const assistants = html(chat({appearance: whole(), ...own}));
  assert.match(assistants, />stay@hotel\.example</);
  assert.match(assistants, />\+420 111 111 111</);

  const profiles = html(
    chat({
      appearance: withForm(
        {},
        {phone: '+420 222 222 222', email: 'front@hotel.example'}
      ),
      ...own,
    })
  );
  assert.match(profiles, />front@hotel\.example</);
  assert.match(profiles, />\+420 222 222 222</);
  assert.doesNotMatch(profiles, /stay@hotel\.example/);
  assert.doesNotMatch(profiles, /111 111 111/);
});

test('the branding line says what its look gives it', () => {
  // The words of the line, without the styles the markup carries beside them.
  const branding = (look) =>
    /<div[^>]*data-component="Branding"[^>]*>(.*?)<\/div>/.exec(
      html(chat({appearance: look})).replace(/<style[^>]*>[^<]*<\/style>/g, '')
    )[1];
  assert.match(
    branding(whole()),
    /^Powered by <a[^>]*href="https:\/\/www\.inhotel\.io"[^>]*>inHotel<\/a>$/
  );
  assert.match(
    branding({
      ...whole(),
      branding: {
        text: 'Provozuje',
        name: 'Example Chat',
        linkUrl: 'https://chat.example/about',
      },
    }),
    /^Provozuje <a[^>]*href="https:\/\/chat\.example\/about"[^>]*>Example Chat<\/a>$/
  );
  // A name with nowhere to lead is written, not linked.
  assert.equal(
    branding({
      ...whole(),
      branding: {text: 'Provozuje', name: 'Example Chat', linkUrl: null},
    }),
    'Provozuje Example Chat'
  );
});

test('a profile’s branding line is drawn as the profile has it, with no wait for the plan', () => {
  const own = (branding) =>
    resolveAppearance(
      embedProfile(
        {
          elements: [
            {
              name: 'root',
              component: 'FloatingChat',
              values: branding ? {branding: 'branding'} : {},
            },
            ...(branding
              ? [{name: 'branding', component: 'Branding', values: branding}]
              : []),
          ],
        },
        'en'
      ),
      {},
      []
    );
  // The page's own profile leaves the line out: it is not drawn, whatever
  // the subscription plan says.
  assert.doesNotMatch(
    html(chat({appearance: own(null)}, {shouldDisplayBranding: true})),
    /data-component="Branding"/
  );
  // It names the line, in its own words: drawn at once.
  const named = html(chat({appearance: own({name: 'Example Chat'})}));
  assert.match(named, /data-component="Branding"/);
  assert.match(named, />Example Chat</);
  // The assistant's own profile does the same.
  assert.match(html(chat({appearance: whole()})), /data-component="Branding"/);
  // Without a profile the plan decides, as it always has.
  assert.doesNotMatch(html(chat()), /data-component="Branding"/);
  assert.match(
    html(chat({}, {shouldDisplayBranding: true})),
    /data-component="Branding"/
  );
});

test('the contact form is never sent by the browser itself', () => {
  // A form with one single-line field is submitted by the browser on Enter,
  // which would open the chat's address with what the guest wrote in it.
  for (const form of [
    whole().contact.form,
    withForm({firstName: null, lastName: null}).contact.form,
    settingsAppearance({}).contact.form,
  ]) {
    const element = ContactForm({
      handleChange() {},
      handleSubmit() {},
      firstName: '',
      lastName: '',
      email: '',
      message: '',
      clickedSubmit: false,
      shouldSummarize: false,
      primaryColor: '#465EA4',
      form,
    });
    assert.equal(element.props.as, 'form');
    let prevented = 0;
    element.props.onSubmit({preventDefault: () => prevented++});
    assert.equal(prevented, 1);
  }
});

const hints = (markup) =>
  [...markup.matchAll(/data-hint="([^"]*)"/g)].map((hint) => hint[1]);

test('what the contact line and its form say on hover is the look’s', () => {
  const own = {hotelEmail: HOTEL_EMAIL, hotelPhone: '+420 111 111 111'};
  const look = withForm(
    {openHint: 'Napište nám', sendHint: 'Odeslat', discardHint: 'Zahodit'},
    {firstCopyHint: 'Kliknutím zkopírujete'}
  );
  // The phone, the e-mail and the control that opens the form.
  assert.deepEqual(hints(html(chat({appearance: look, ...own}))), [
    'Kliknutím zkopírujete',
    'Kliknutím zkopírujete',
    'Napište nám',
  ]);
  // Open, the form's two buttons come first.
  assert.deepEqual(hints(html(openForm(look))).slice(0, 2), [
    'Zahodit',
    'Odeslat',
  ]);
  // Without a profile they say what they always have.
  assert.deepEqual(
    hints(
      html(
        chat({shouldShowContactForm: true, ...own}, {isMailIconClicked: true})
      )
    ),
    [
      'Discard message',
      'Send as email',
      'Copy to clipboard',
      'Copy to clipboard',
      'Contact Us',
    ]
  );
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

// A closed chat the launcher has asked to show its greeting above the button.
async function previewed(props) {
  const instance = chat(props, {isOpen: false});
  const events = [];
  instance.emit = (event) => events.push(event);
  await instance.componentDidMount();
  // What it says from here on is what it tells the launcher of the preview.
  events.length = 0;
  instance.handleDisplayNotifications({
    shouldDisplayNotifications: true,
    popUpInitialMessage: true,
  });
  const becomes = (next) => {
    const previous = instance.props;
    instance.props = {...previous, ...next};
    instance.componentDidUpdate(previous);
  };
  return {instance, events, becomes};
}

test('a greeting only the profile has is shown above the button once the profile is read', async () => {
  await withFetch(
    async () => ({ok: false}),
    async () => {
      const {instance, events, becomes} = await previewed({
        appearance: settingsAppearance({}),
        isAppearancePending: true,
      });
      try {
        // There is nothing to show yet, and the look is still being read:
        // the launcher is not told there is nothing, or it would stop.
        assert.equal(instance.getUnreadMessages().length, 0);
        assert.deepEqual(events, []);

        becomes({appearance: whole(), isAppearancePending: false});
        assert.equal(instance.getUnreadMessages().length, 1);
        assert.match(html(instance), /Dobrý den, jak vám mohu pomoci\?/);
        assert.deepEqual(events, []);
      } finally {
        instance.componentWillUnmount();
      }
    }
  );
});

test('a read that brings no greeting tells the launcher there is nothing to show', async () => {
  await withFetch(
    async () => ({ok: false}),
    async () => {
      for (const arrived of [
        // A profile without a greeting,
        {appearance: {...whole(), greeting: null}, isAppearancePending: false},
        // and a read that failed, or found no profile.
        {isAppearancePending: false},
      ]) {
        const {instance, events, becomes} = await previewed({
          appearance: settingsAppearance({}),
          isAppearancePending: true,
        });
        try {
          assert.deepEqual(events, []);
          becomes(arrived);
          assert.deepEqual(events, ['messages:seen']);
          // It is told once.
          becomes({});
          assert.deepEqual(events, ['messages:seen']);
        } finally {
          instance.componentWillUnmount();
        }
      }

      // With nothing being read it is told at once, as before.
      const {instance, events} = await previewed({
        appearance: settingsAppearance({}),
      });
      assert.deepEqual(events, ['messages:seen']);
      instance.componentWillUnmount();
    }
  );
});

// Whether the wrapper tells the chat its profile is still being read.
const pending = (wrapper) =>
  quietly(() => wrapper.render()).props.children.props.isAppearancePending;

test('the chat is told while its profile is being read, and when the read is over', async () => {
  let answer;
  await withFetch(
    () => new Promise((resolve) => (answer = resolve)),
    async (calls) => {
      const wrapper = widget({inbox: ASSISTANT});
      assert.equal(pending(wrapper), false);
      try {
        wrapper.componentDidMount();
        assert.equal(pending(wrapper), true);
        answer({ok: true, json: async () => page()});
        await settle();
        assert.equal(pending(wrapper), false);
        assert.equal(shown(wrapper).source, 'profile');

        // The page's own profile ends a read that is under way.
        const before = wrapper.state;
        wrapper.handleConfigUpdate({locale: 'cs'});
        wrapper.componentDidUpdate(wrapper.props, before);
        assert.equal(pending(wrapper), true);
        wrapper.handleConfigUpdate({appearance: embedded()});
        assert.equal(pending(wrapper), false);
      } finally {
        wrapper.componentWillUnmount();
      }

      // Nothing is read for an ID that is no Assistant ID, nor for a page
      // that has a profile of its own.
      for (const config of [
        {inbox: 'hotel-paris'},
        {inbox: ASSISTANT, appearanceInline: '1'},
      ]) {
        const idle = widget(config);
        idle.componentDidMount();
        assert.equal(pending(idle), false);
        idle.componentWillUnmount();
      }
      // The profile was read twice. Its look offers the card's questions, so
      // the card was read too.
      const reads = calls.map((call) => call.url);
      assert.equal(
        reads.filter((url) => /appearance-profiles/.test(url)).length,
        2
      );
      assert.equal(
        reads.filter((url) => /agent-card\.json$/.test(url)).length,
        1
      );
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

// A profile a page gives in its own embed, with a title in two languages.
const embedded = () => ({
  elements: [
    {
      name: 'root',
      component: 'FloatingChat',
      values: {header: 'header', accent_color: '#0B6E4F', launcher: 'button'},
    },
    {
      name: 'header',
      component: 'Header',
      values: {titles: {en: 'From the page', cs: 'Ze stránky'}},
    },
    {name: 'button', component: 'Launcher', values: {icon: 'filled'}},
  ],
});

test('a profile the page gives in its embed is drawn in the page’s language, with no read', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => page()}),
    async (calls) => {
      // The launcher says so when the page has a profile of its own.
      const wrapper = widget({
        inbox: ASSISTANT,
        locale: 'cs',
        appearanceInline: '1',
      });
      try {
        wrapper.componentDidMount();
        await settle();
        assert.equal(calls.length, 0);
        assert.equal(shown(wrapper).source, 'settings');

        wrapper.handleConfigUpdate({appearance: embedded()});
        assert.equal(shown(wrapper).source, 'profile');
        assert.equal(shown(wrapper).header.title, 'Ze stránky');
        assert.equal(shown(wrapper).accentColor, '#0B6E4F');
        assert.equal(shown(wrapper).composer, null);

        const before = wrapper.state;
        wrapper.handleConfigUpdate({locale: 'en'});
        wrapper.componentDidUpdate(wrapper.props, before);
        await settle();
        assert.equal(shown(wrapper).header.title, 'From the page');
        assert.equal(calls.length, 0);
      } finally {
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('the page’s own profile stands in front of the assistant’s, and goes when it is no profile', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => page()}),
    async () => {
      for (const nothing of ['root = FloatingChat()', {elements: []}, null]) {
        const wrapper = widget({inbox: ASSISTANT, locale: 'cs'});
        try {
          wrapper.componentDidMount();
          await settle();
          assert.equal(shown(wrapper).header.title, 'Zeptejte se nás');

          wrapper.handleConfigUpdate({appearance: embedded()});
          assert.equal(shown(wrapper).header.title, 'Ze stránky');
          // It names no branding line, so the chat has none.
          assert.equal(shown(wrapper).branding, null);

          // What is no profile gives the assistant's own back.
          wrapper.handleConfigUpdate({appearance: nothing});
          assert.equal(shown(wrapper).header.title, 'Zeptejte se nás');
          assert.deepEqual(shown(wrapper).branding, BRANDING);

          // Another assistant on the same page is drawn in the page's
          // profile too: it is the page's, not the assistant's.
          wrapper.handleConfigUpdate({appearance: embedded()});
          wrapper.handleConfigUpdate({inbox: OTHER});
          assert.equal(shown(wrapper).header.title, 'Ze stránky');
          wrapper.handleConfigUpdate({appearance: nothing});
          assert.equal(shown(wrapper).source, 'settings');
        } finally {
          wrapper.componentWillUnmount();
        }
      }
    }
  );
});

test('what is no profile does not stop the assistant’s own from being read', async () => {
  for (const nothing of [null, {elements: []}, 'root = FloatingChat()']) {
    let answer;
    await withFetch(
      () => new Promise((resolve) => (answer = resolve)),
      async (calls) => {
        const wrapper = widget({inbox: ASSISTANT, locale: 'cs'});
        try {
          wrapper.componentDidMount();
          wrapper.handleConfigUpdate({appearance: nothing});
          assert.equal(calls[0].options.signal.aborted, false);
          answer({ok: true, json: async () => page()});
          await settle();
          assert.equal(shown(wrapper).source, 'profile');
          assert.equal(shown(wrapper).header.title, 'Zeptejte se nás');
        } finally {
          wrapper.componentWillUnmount();
        }
      }
    );
  }
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
      ...SETTINGS_CONTACT,
      form: {...SETTINGS_CONTACT.form, isOffered: true},
    },
    branding: BRANDING,
    suggestions: null,
    messages: DEFAULT_MESSAGES,
  });
  assert.equal(
    shown(widget({inbox: 'hotel-paris'})).contact.form.isOffered,
    false
  );
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
          calls
            .filter((call) => /appearance-profiles/.test(call.url))
            .map((call) => call.url.split('?')[1]),
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
        assert.equal(pending(wrapper), false);
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

// The playground frames the real chat. Its guard stands in front of the
// frame's `fetch`, so nothing is sent from there.
test('nothing is sent from the playground’s frame, and its profile read is answered with the draft', async () => {
  const reached = [];
  const frame = {
    fetch: (input, init) => {
      reached.push(typeof input === 'string' ? input : input.url);
      return Promise.resolve('the network');
    },
    Response: class {
      constructor(body, init) {
        this.status = init.status;
        this.ok = init.status >= 200 && init.status < 300;
        this.json = async () => JSON.parse(body);
      }
    },
    URL,
    location: {href: 'http://localhost:3000/?token=-1'},
  };
  const draft = {items: [{ui: 'floating_chat', code: 'draft'}]};
  const asked = [];
  const guarded = guardedFetch(frame, (url) => {
    asked.push(url);
    return draft;
  });
  const agent = `https://${ASSISTANT}.agents.inhotel.io/`;
  const backend = 'https://backend.inhotel.io';

  // A message to an agent, in each way the chat could send one.
  for (const send of [
    () => guarded(agent, {method: 'POST', body: '{}'}),
    () => guarded(agent),
    () => guarded({url: agent, method: 'POST'}),
    () => guarded(agent + '.well-known/agent-card.json'),
  ]) {
    assert.equal((await send()).ok, false);
  }
  // The contact form, and anything else that would change something.
  for (const method of ['POST', 'post', 'PUT', 'PATCH', 'DELETE']) {
    const answer = await guarded(`${backend}/contact_form/send_email`, {
      method,
      body: '{}',
    });
    assert.deepEqual(await answer.json(), {
      status: 1,
      message: 'Not sent: appearance playground',
    });
  }
  assert.deepEqual(reached, []);

  // The profile read is answered with the draft, whatever the assistant.
  const read = `${backend}/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&limit=200&locale=cs`;
  assert.deepEqual(
    await (await guarded(read, {credentials: 'omit'})).json(),
    draft
  );
  assert.deepEqual(asked, [read]);
  assert.deepEqual(reached, []);

  // The card the chat reads for its questions is the playground's, when it
  // holds one, and never the agent's.
  const cardRead = `https://${ASSISTANT}.agents.inhotel.io/.well-known/agent-card.json`;
  const sample = {name: 'Preview', skills: [{examples: ['Is it far?']}]};
  const withCard = guardedFetch(
    frame,
    () => draft,
    (url) => (url === cardRead ? sample : undefined)
  );
  assert.deepEqual(await (await withCard(cardRead)).json(), sample);
  assert.equal((await withCard(cardRead, {method: 'POST'})).ok, false);
  assert.equal((await withCard(agent, {method: 'POST', body: '{}'})).ok, false);
  assert.equal((await guarded(cardRead)).ok, false);
  assert.deepEqual(reached, []);

  // Reads of other things go on as they are.
  assert.equal(
    await guarded(`${backend}/public/get_widget_settings`),
    'the network'
  );
  assert.equal(await guarded('/_next/static/chunk.js'), 'the network');
  assert.deepEqual(reached, [
    `${backend}/public/get_widget_settings`,
    '/_next/static/chunk.js',
  ]);
});

test('the playground runs on a local server only, and guards its frame before the chat is told anything', () => {
  const playground = fs.readFileSync(
    path.join(__dirname, '../pages/playground.tsx'),
    'utf8'
  );
  for (const wiring of [
    // Off a local server nothing is read and no chat is framed.
    /if \(!isDev\(window\)\) \{\s*setLocal\(false\);\s*return;\s*\}/,
    /if \(!isLocal\) \{\s*return \(\s*<div[^>]*>This page runs only on a local server\.<\/div>/,
    // The guard goes in front of the frame's `fetch` when the frame loads,
    // and again before the chat is told anything.
    /win\.fetch = guardedFetch\(win, answer, card\);/,
    /onLoad=\{guard\}/,
    /const onChatLoaded = \(\) => \{\s*guard\(\);\s*push\(\);/,
  ]) {
    assert.match(playground, wiring);
  }
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

// What the launcher makes of a page of the read, as plain data.
const overlayOf = (...args) =>
  JSON.parse(
    JSON.stringify(bundledLauncherHandler('appearanceOverlay', {})(...args))
  );
const BUTTON = {icon: 'outlined', preview: false};

test('the launcher takes its colour, its side and its button from the profile', () => {
  const of = overlayOf;
  assert.deepEqual(of(page()), {
    color: '#465EA4',
    position: 'right',
    launcher: BUTTON,
  });
  assert.deepEqual(of(twoProfiles(), 'govisit'), {
    color: '#0B6E4F',
    position: 'left',
    launcher: BUTTON,
  });
  assert.deepEqual(of(twoProfiles(), 'gone'), {
    color: '#465EA4',
    position: 'right',
    launcher: BUTTON,
  });

  // A value the launcher cannot draw is left to the settings.
  const odd = page();
  odd.items[0].elements[0].values.accent_color = 'url(//evil)';
  assert.deepEqual(of(odd), {position: 'right', launcher: BUTTON});
  odd.items[0].elements[0].values.screen_side = 'top';
  assert.deepEqual(of(odd), {launcher: BUTTON});

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

test('the round button is the profile’s: its picture, its preview, or none at all', () => {
  const button = (change) => {
    const changed = page();
    const element = (name) =>
      changed.items[0].elements.find((e) => e.name === name);
    change(element);
    return overlayOf(changed).launcher;
  };
  assert.deepEqual(
    button((element) => {
      element('launcher').values = {icon: 'filled', has_greeting_preview: true};
    }),
    {icon: 'filled', preview: true}
  );
  // A picture the launcher does not have is left to the embed.
  assert.deepEqual(
    button((element) => {
      element('launcher').values = {icon: 'star', has_greeting_preview: 'yes'};
    }),
    {icon: null, preview: false}
  );
  assert.deepEqual(
    button((element) => {
      delete element('launcher').values;
    }),
    {icon: null, preview: false}
  );
  // A profile that leaves the button out has none.
  for (const without of [
    (element) => delete element('root').values.launcher,
    (element) => (element('root').values.launcher = 'missing'),
    // The slot holds a `Launcher` and nothing else.
    (element) => (element('root').values.launcher = 'header'),
    (element) => (element('root').values.launcher = 7),
  ]) {
    assert.equal(button(without), false);
  }
});

test('the launcher and the chat read the same profile the same way', () => {
  const profiles = [
    page(),
    twoProfiles(),
    (() => {
      const changed = page();
      const values = changed.items[0].elements.find(
        (e) => e.name === 'launcher'
      ).values;
      values.icon = 'filled';
      values.has_greeting_preview = true;
      return changed;
    })(),
    (() => {
      const changed = page();
      delete changed.items[0].elements[0].values.launcher;
      return changed;
    })(),
  ];
  for (const read of profiles) {
    for (const code of [undefined, 'govisit']) {
      const launcher = overlayOf(read, code);
      const chat = launcherAppearance(pickProfile(read, code));
      assert.equal(launcher.color, chat.accentColor);
      assert.equal(launcher.position, chat.side);
      // The launcher says `false` where the chat says `null`: no button.
      assert.deepEqual(
        launcher.launcher,
        chat.button
          ? {icon: chat.button.icon, preview: chat.button.hasGreetingPreview}
          : false
      );
    }
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
          embedProfileOf: bundledLauncherHandler('embedProfileOf', {}),
        },
      }
    );
  const answer = async (fetcher, ...args) =>
    JSON.parse(JSON.stringify(await reader(fetcher)(...args)));
  const profiles = async () => ({ok: true, json: async () => twoProfiles()});

  assert.deepEqual(await answer(profiles, 'hotel-paris'), {});
  assert.deepEqual(await answer(profiles, undefined), {});
  assert.equal(calls.length, 0);

  assert.deepEqual(await answer(profiles, ASSISTANT.toUpperCase()), {
    color: '#465EA4',
    position: 'right',
    launcher: BUTTON,
  });
  assert.equal(
    calls[0].url,
    `https://backend.inhotel.io/api/v2/assistants/${ASSISTANT}/appearance-profiles?ui=floating_chat&limit=200`
  );
  assert.equal(calls[0].options.credentials, 'omit');
  assert.deepEqual(await answer(profiles, ASSISTANT, 'govisit'), {
    color: '#0B6E4F',
    position: 'left',
    launcher: BUTTON,
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
    return JSON.parse(
      JSON.stringify(
        await context.Pq({account_id: -1, inbox_id: ASSISTANT, ...query})
      )
    );
  };

  const queries = [];
  const reads = [];
  assert.deepEqual(
    await read({legacy, profiles: twoProfiles(), queries, reads}),
    {
      title: 'Legacy title',
      color: '#465EA4',
      position: 'right',
      launcher: BUTTON,
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
    {
      title: 'Legacy title',
      color: '#0B6E4F',
      position: 'left',
      launcher: BUTTON,
    }
  );
  assert.deepEqual(await read({legacy, profiles: null}), legacy);
  assert.deepEqual(await read({legacy: null, profiles: twoProfiles()}), {
    color: '#465EA4',
    position: 'right',
    launcher: BUTTON,
  });
  assert.deepEqual(await read({legacy: null, profiles: null}), {});
});

test('a profile the page gives in its embed is the launcher’s, with no read', async () => {
  const legacy = {title: 'Legacy title', color: '#111111', position: 'left'};
  const read = async (world, query) => {
    const context = launcherWorld(world);
    vm.runInNewContext(settingsRead() + '\n;this.Pq = Pq;', context);
    return JSON.parse(
      JSON.stringify(
        await context.Pq({account_id: -1, inbox_id: ASSISTANT, ...query})
      )
    );
  };
  const reads = [];
  assert.deepEqual(
    await read(
      {legacy, profiles: twoProfiles(), reads},
      {appearance: embedded()}
    ),
    {
      title: 'Legacy title',
      color: '#0B6E4F',
      position: 'left',
      launcher: {icon: 'filled', preview: false},
    }
  );
  assert.equal(reads.length, 0);

  // What is not a profile leaves the assistant's own to be read.
  for (const nothing of [
    undefined,
    null,
    'root = FloatingChat()',
    {},
    {elements: []},
    {elements: 'none'},
  ]) {
    const asked = [];
    assert.deepEqual(
      await read(
        {legacy, profiles: twoProfiles(), reads: asked},
        {appearance: nothing}
      ),
      {
        title: 'Legacy title',
        color: '#465EA4',
        position: 'right',
        launcher: BUTTON,
      }
    );
    assert.equal(asked.length, 1);
  }

  // The copy the iframe is sent is plain data, whatever the page holds.
  const copy = bundledLauncherHandler('embedProfileOf', {});
  const own = embedded();
  own.elements[1].values.onClick = () => {};
  assert.deepEqual(JSON.parse(JSON.stringify(copy(own))), {
    ui: 'floating_chat',
    code: 'embed',
    is_default: true,
    elements: embedded().elements,
  });
  const loop = embedded();
  loop.elements[0].values.self = loop;
  assert.equal(copy(loop), null);
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

  const handed = async ({
    props = {},
    legacy,
    profiles,
    lang = '',
    queries = [],
  }) => {
    const state = {};
    const context = {
      ...launcherWorld({legacy, profiles, queries}),
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
    return JSON.parse(
      JSON.stringify({
        primaryColor,
        position,
        title,
        appearanceProfile,
        locale,
        embedKeys,
        // `undefined` is left out here, as it is of the iframe's address.
        appearanceInline: state.config.appearanceInline,
        launcher: state.launcher,
        inbox: state.config.inbox || undefined,
        agentCard: state.config.agentCard,
        contactHandler: state.config.contactHandler,
      })
    );
  };
  const legacy = {title: 'Legacy title', color: '#111111', position: 'left'};

  // Without a profile: the legacy settings, as before, and the page language.
  assert.deepEqual(await handed({legacy, profiles: null, lang: 'cs'}), {
    primaryColor: '#111111',
    position: 'left',
    title: 'Legacy title',
    locale: 'cs',
    embedKeys: '',
    inbox: ASSISTANT,
  });
  // Any other agent: its card, no inHotel ID, and whether the page takes the
  // contact form. Nothing is read from the legacy service.
  const queries = [];
  const card = 'https://agent.example/.well-known/agent-card.json';
  const forCard = await handed({
    legacy,
    profiles: twoProfiles(),
    queries,
    props: {inbox: '', agentCard: card, onContactFormSubmit: () => {}},
  });
  assert.equal(forCard.inbox, undefined);
  assert.equal(forCard.agentCard, card);
  assert.equal(forCard.contactHandler, 1);
  assert.equal(forCard.title, undefined);
  assert.equal(forCard.primaryColor, '#465ea4');
  assert.deepEqual(queries, []);
  assert.equal(
    (
      await handed({
        legacy,
        profiles: null,
        props: {inbox: '', agentCard: card},
      })
    ).contactHandler,
    undefined
  );
  // The profile's colour and side stand in front of the legacy ones.
  assert.deepEqual(await handed({legacy, profiles: twoProfiles()}), {
    primaryColor: '#465EA4',
    position: 'right',
    title: 'Legacy title',
    locale: 'en-US',
    embedKeys: '',
    launcher: BUTTON,
    inbox: ASSISTANT,
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
      launcher: BUTTON,
      inbox: ASSISTANT,
    }
  );
  // A profile without the round button, and one the page gives itself: the
  // iframe is told the page has its own, so it reads none.
  const noButton = twoProfiles();
  delete noButton.items[0].elements[0].values.launcher;
  assert.equal((await handed({legacy, profiles: noButton})).launcher, false);
  assert.deepEqual(
    await handed({
      legacy,
      profiles: twoProfiles(),
      props: {appearance: embedded()},
    }),
    {
      primaryColor: '#0B6E4F',
      position: 'left',
      title: 'Legacy title',
      locale: 'en-US',
      embedKeys: '',
      appearanceInline: 1,
      launcher: {icon: 'filled', preview: false},
      inbox: ASSISTANT,
    }
  );
});

test('once the chat has loaded it is sent the page’s own profile, and the greeting shows above a button that asks for it', () => {
  // The launcher's step for a chat that has just loaded, closed.
  const loaded = ({launcher, ownProfile, props = {}, seen = false}) => {
    const sent = [];
    const timers = [];
    const bridge = {
      state: {isLoaded: false, isOpen: false, config: {}, launcher},
      setState(change, callback) {
        Object.assign(this.state, change);
        if (callback) callback();
      },
      props,
      ownProfile,
      shouldOpenByDefault: () => false,
      storage: {getPopupSeen: () => seen},
      send: (...args) => sent.push(args),
    };
    bundledLauncherHandler('handleChatLoaded', bridge, {
      setTimeout: (run, ms) => timers.push({run, ms}),
    })({});
    timers.forEach((timer) => timer.run());
    return JSON.parse(JSON.stringify(sent));
  };
  const preview = [
    'notifications:display',
    {shouldDisplayNotifications: true, popUpInitialMessage: true},
  ];
  const plan = ['inhotel:plan', {plan: null}];

  // Without a profile, and with a button that does not ask: as before.
  assert.deepEqual(loaded({}), [plan]);
  assert.deepEqual(loaded({launcher: BUTTON}), [plan]);
  assert.deepEqual(loaded({launcher: false}), [plan]);
  // The profile's button asks for the greeting, or the embed does.
  assert.deepEqual(loaded({launcher: {icon: 'outlined', preview: true}}), [
    plan,
    preview,
  ]);
  assert.deepEqual(loaded({props: {popUpInitialMessage: true}}), [
    plan,
    preview,
  ]);
  // A guest who has seen it is not shown it again.
  assert.deepEqual(
    loaded({launcher: {icon: 'outlined', preview: true}, seen: true}),
    [plan]
  );

  // The page's own profile follows, as the launcher copied it at the start.
  const copy = bundledLauncherHandler('embedProfileOf', {});
  const ownProfile = copy(embedded());
  assert.deepEqual(loaded({ownProfile}), [
    plan,
    [
      'config:update',
      {
        appearance: {
          ui: 'floating_chat',
          code: 'embed',
          is_default: true,
          elements: embedded().elements,
        },
      },
    ],
  ]);
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

  // The page's own profile is taken from its configuration as it is.
  const own = embedded();
  const given = vm.runInNewContext(bootstrap + '\n(ownAppearance);', {
    window: {
      FloatingChatWindow: {
        config: {
          agent_card_url: `https://${ASSISTANT}.agents.inhotel.io/.well-known/agent-card.json`,
          appearance: own,
        },
      },
    },
    document: {currentScript: null},
    ACCOUNT_ID: -1,
  });
  assert.equal(given, own);
});

test('the launcher wires the profile into its settings and the iframe configuration', () => {
  for (const wiring of [
    // The bootstrap hands the named profile to the launcher component,
    /appearanceProfile: appearanceProfile,/,
    // which asks for it together with the legacy settings,
    /appearance_profile: e\.appearanceProfile/,
    /cd\.fetchAppearanceOverlay\(\s*t\.inbox_id,\s*t\.appearance_profile,\s*t\.appearance,\s*t\.agent_card\s*\)/,
    // and tells the iframe what it needs to read the profile itself.
    /T\.appearanceProfile = this\.props\.appearanceProfile/,
    /T\.locale = cd\.pageLanguage\(document, navigator\)/,
    /T\.embedKeys = cd\.embedKeysOf\(this\.props\)/,
    // The page's own profile goes the same way: to the settings read, and to
    // the iframe once it has loaded.
    /appearance: ownAppearance,/,
    /appearance: e\.appearance,/,
    /this\.ownProfile = cd\.embedProfileOf\(\s*this\.props\.appearance\s*\)/,
    /T\.appearanceInline = this\.ownProfile \? 1 : void 0/,
    /n\.send\('config:update', \{appearance: n\.ownProfile\}\)/,
    // The button is drawn as the profile has it: not at all, or with its
    // picture, unless the page's own embed says otherwise.
    /launcher: this\.state\.launcher,/,
    /O = t\.hideToggleButton \|\| !1 === e\.launcher,/,
    /c = t\.iconVariant \|\| \(e\.launcher && e\.launcher\.icon\) \|\| void 0,/,
    /iconVariant: br,/,
    // and the greeting shows above it when the profile asks for that.
    /a\.popUpInitialMessage \|\|\s*!\(!n\.state\.launcher \|\| !0 !== n\.state\.launcher\.preview\),/,
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
