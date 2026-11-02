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
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ChatWindow = require('../components/ChatWindow.tsx').default;
const ChatMessage = require('../components/ChatMessage.tsx').default;
const getThemeConfig = require('../helpers/theme.ts').default;
const Widget = require('../components/Widget.tsx').default;
for (const [ext, previous] of oldExtensions) {
  if (previous) require.extensions[ext] = previous;
  else delete require.extensions[ext];
}

const first = 'f1a4e101-533a-8355-80f0-f448ed950b76';
const second = 'f1a4e101-0000-8000-8000-000000000002';
const icon = 'https://images.example/agent.webp';
const fallback = 'https://images.example/legacy.svg';
const nextTick = () => new Promise(setImmediate);
function welcome(chat, id = 'greeting') {
  function find(node) {
    if (!React.isValidElement(node)) return null;
    if (node.type === ChatMessage && node.props.message.id === id) return node;
    for (const child of React.Children.toArray(node.props.children)) {
      const result = find(child);
      if (result) return result;
    }
    return null;
  }
  const result = find(chat.render());
  assert.ok(
    result,
    'welcome message should be present without waiting for the card'
  );
  return result;
}
function fixture(fetcher, profile = first) {
  const calls = [];
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
  global.fetch = (url, options) => {
    calls.push({url, options});
    return fetcher(url, options);
  };
  const chat = new ChatWindow({
    accountId: '-1',
    inboxId: profile,
    greeting: 'Welcome to our hotel',
    disableAnalyticsTracking: true,
    avatarURL: fallback,
  });
  let updates = 0;
  chat.setState = (change, callback) => {
    updates++;
    chat.state = {
      ...chat.state,
      ...(typeof change === 'function'
        ? change(chat.state, chat.props)
        : change),
    };
    if (callback) callback();
  };
  return {chat, calls, updates: () => updates};
}
const response = (card) => ({
  ok: true,
  url: `https://${first}.agents.inhotel.io/.well-known/agent-card.json`,
  json: async () => card,
});

async function runPresentationChecks() {
  const saved = new Map(
    ['window', 'document', 'parent', 'fetch', 'localStorage'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(global, name),
    ])
  );
  const tests = [];
  const test = (name, run) => tests.push({name, run});
  test('only agent replies have feedback controls', () => {
    for (const type of ['bot', 'customer', 'agent']) {
      const html = renderToStaticMarkup(
        React.createElement(ChatMessage, {
          message: {
            id: type === 'bot' ? 'greeting' : 'reply',
            type,
            body: 'Hello',
          },
          isMe: type === 'customer',
        })
      );
      assert.equal(
        (html.match(/class="btn_up_down"/g) || []).length,
        type === 'agent' ? 2 : 0
      );
    }
  });
  test('history distinguishes welcome messages from agent replies', async () => {
    for (const [type, content, count] of [
      [undefined, 'Welcome to our hotel', 0],
      ['bot', 'An older welcome', 0],
      ['agent', 'Welcome to our hotel', 2],
    ]) {
      const f = fixture(async () => response({}));
      const messages = [
        {role: 'assistant', type, content, timestamp: new Date().toISOString()},
      ];
      global.localStorage = {
        getItem: (key) =>
          key.startsWith('inhotel_chat_history')
            ? JSON.stringify({messages, timestamp: Date.now()})
            : null,
      };
      try {
        await f.chat.componentDidMount();
        await nextTick();
        const html = renderToStaticMarkup(welcome(f.chat, 'restored-0'));
        assert.equal((html.match(/class="btn_up_down"/g) || []).length, count);
      } finally {
        f.chat.componentWillUnmount();
        delete global.localStorage;
      }
    }
  });
  test('iframe uses GoVisit blue-600 for missing or invalid colors', () => {
    for (const primary of [undefined, null, '', 'not-a-color']) {
      assert.equal(getThemeConfig({primary}).colors.primary, '#465ea4');
      fixture(async () => response({}));
      const widget = new Widget({config: {token: '-1', primaryColor: primary}});
      const rendered = widget.render();
      assert.equal(rendered.props.theme.colors.primary, '#465ea4');
      assert.equal(rendered.props.children.props.primaryColor, '#465ea4');
    }
    assert.equal(
      getThemeConfig({primary: '#123456'}).colors.primary,
      '#123456'
    );
  });
  test('launcher uses the same fallback and preserves configured colors', () => {
    const source = fs.readFileSync(
      require.resolve('../public/widget.js'),
      'utf8'
    );
    const ast = ts.createSourceFile(
      'widget.js',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    let themeFunction;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'Nj')
        themeFunction = node.initializer.getText(ast);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(themeFunction, 'launcher theme function should be present');
    const launcherTheme = require('node:vm').runInNewContext(
      '(' + themeFunction + ')',
      {
        za: () => ({d: require('tinycolor2')}),
        Rq: {},
        qD: Object.assign,
        rD: {},
      }
    );
    for (const primary of [undefined, null, '', 'not-a-color'])
      assert.equal(launcherTheme({primary}).colors.primary, '#465ea4');
    assert.equal(launcherTheme({primary: '#123456'}).colors.primary, '#123456');
  });
  test('welcome uses the public card icon before any message is sent', async () => {
    const f = fixture(async () => response({iconUrl: icon}));
    await f.chat.componentDidMount();
    await nextTick();
    assert.equal(f.calls.length, 1);
    assert.equal(
      f.calls[0].url,
      `https://${first}.agents.inhotel.io/.well-known/agent-card.json`
    );
    assert.equal(f.calls[0].options.credentials, 'omit');
    assert.equal(welcome(f.chat).props.avatarURL, icon);
    assert.match(
      renderToStaticMarkup(welcome(f.chat)),
      /<img[^>]+src="https:\/\/images\.example\/agent\.webp"/
    );
    f.chat.componentWillUnmount();
  });
  test('welcome stays visible while the card is pending', async () => {
    const f = fixture(() => new Promise(() => {}));
    await f.chat.componentDidMount();
    assert.equal(welcome(f.chat).props.message.body, 'Welcome to our hotel');
    assert.equal(welcome(f.chat).props.isAvatarLoading, true);
    assert.doesNotMatch(
      renderToStaticMarkup(welcome(f.chat)),
      /data-avatar-state="fallback"/
    );
    f.chat.componentWillUnmount();
  });
  test('relative icon URLs resolve against the card URL', async () => {
    const f = fixture(async () => response({iconUrl: '/images/avatar.png'}));
    await f.chat.componentDidMount();
    await nextTick();
    assert.equal(
      welcome(f.chat).props.avatarURL,
      `https://${first}.agents.inhotel.io/images/avatar.png`
    );
    f.chat.componentWillUnmount();
  });
  for (const [name, fetcher] of [
    ['missing icon', async () => response({name: 'Agent'})],
    ['unsafe icon URL', async () => response({iconUrl: 'javascript:alert(1)'})],
    ['HTTP error', async () => ({ok: false})],
    [
      'network failure',
      async () => {
        throw new Error('offline');
      },
    ],
    [
      'invalid JSON',
      async () => ({
        ok: true,
        json: async () => {
          throw new Error('invalid JSON');
        },
      }),
    ],
  ]) {
    test('welcome retains SVG fallback on ' + name, async () => {
      const f = fixture(fetcher);
      await f.chat.componentDidMount();
      await nextTick();
      const html = renderToStaticMarkup(welcome(f.chat));
      assert.equal(welcome(f.chat).props.avatarURL, null);
      assert.equal(welcome(f.chat).props.isAvatarLoading, false);
      assert.match(html, /<svg/);
      assert.doesNotMatch(html, /<img[^>]+src="javascript:/);
      assert.equal(welcome(f.chat).props.message.body, 'Welcome to our hotel');
      f.chat.componentWillUnmount();
    });
  }
  test('a timed-out card load resolves to the fallback', async () => {
    const f = fixture(() => new Promise(() => {}));
    await f.chat.componentDidMount();
    assert.equal(welcome(f.chat).props.isAvatarLoading, true);
    await new Promise((resolve) => setTimeout(resolve, 3100));
    assert.equal(welcome(f.chat).props.isAvatarLoading, false);
    assert.equal(welcome(f.chat).props.avatarURL, null);
    f.chat.componentWillUnmount();
  });
  test('a malformed profile ID never makes a card request', async () => {
    const f = fixture(() => {
      throw new Error('must not fetch');
    }, 'evil.example/path');
    await f.chat.componentDidMount();
    await nextTick();
    assert.equal(f.calls.length, 0);
    assert.equal(welcome(f.chat).props.avatarURL, null);
    f.chat.componentWillUnmount();
  });
  test('late avatar responses cannot update an unmounted chat', async () => {
    let resolve;
    const f = fixture(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await f.chat.componentDidMount();
    assert.equal(f.calls.length, 1);
    f.chat.componentWillUnmount();
    const before = f.updates();
    resolve(response({iconUrl: icon}));
    await nextTick();
    assert.equal(f.updates(), before);
  });
  test('a previous assistant card cannot replace the current avatar', async () => {
    let resolve;
    const f = fixture((url) =>
      url.includes(first)
        ? new Promise((done) => {
            resolve = done;
          })
        : Promise.resolve(
            response({iconUrl: 'https://images.example/current.webp'})
          )
    );
    await f.chat.componentDidMount();
    const previous = f.chat.props;
    f.chat.props = {...previous, inboxId: second};
    assert.equal(typeof f.chat.componentDidUpdate, 'function');
    f.chat.componentDidUpdate(previous);
    await nextTick();
    resolve(response({iconUrl: icon}));
    await nextTick();
    assert.equal(
      welcome(f.chat).props.avatarURL,
      'https://images.example/current.webp'
    );
    f.chat.componentWillUnmount();
  });
  test('avatar rendering does not mutate message user data', () => {
    const user = Object.freeze({
      id: 1,
      email: 'assistant@example.com',
      profile_photo_url: 'https://images.example/original.webp',
    });
    const html = renderToStaticMarkup(
      React.createElement(ChatMessage, {
        message: {body: 'Hello', type: 'agent', user},
        avatarURL: icon,
      })
    );
    assert.match(html, /<img[^>]+src="https:\/\/images\.example\/agent\.webp"/);
    assert.equal(
      user.profile_photo_url,
      'https://images.example/original.webp'
    );
  });
  let failed = 0;
  try {
    for (const {name, run} of tests) {
      try {
        await run();
        console.log('PASS ' + name);
      } catch (error) {
        failed++;
        console.error('FAIL ' + name + '\n' + error.stack);
      }
    }
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(global, name, descriptor);
      else delete global[name];
    }
  }
  if (failed)
    throw new Error(
      `${failed}/${tests.length} presentation regressions failed`
    );
  console.log(
    `${tests.length}/${tests.length} presentation regressions passed`
  );
}
module.exports = runPresentationChecks;
if (require.main === module)
  runPresentationChecks().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
