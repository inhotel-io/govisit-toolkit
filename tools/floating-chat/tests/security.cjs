const assert = require('node:assert/strict');
const {
  createRuntime,
  synchronousState,
  bundledLauncherHandler,
  projectRequire,
} = require('./support/runtime.cjs');
const React = projectRequire('react');
const {renderToStaticMarkup} = projectRequire('react-dom/server');
const parentOrigin = 'https://hotel.example';
const firstProfile = 'f1a4e101-533a-8355-80f0-f448ed950b76';
const secondProfile = 'f1a4e101-0000-8000-8000-000000000002';
const tests = [];
const test = (name, run) => tests.push({name, run});

const MessageBody = createRuntime().load('components/ChatMessageBody.tsx')
  .default;
for (const content of [
  '&lt;img src=x onerror="window.__probe=1"&gt;',
  '\\<img src=x onerror="window.__probe=1"\\>',
  '&lt;svg onload="window.__probe=1"&gt;&lt;/svg&gt;',
]) {
  test('message text stays escaped: ' + content, () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageBody, {content})
    );
    assert.doesNotMatch(html, /<(?:img|svg)\b[^>]*\bon(?:error|load)=/i);
    assert.match(html, /&lt;(?:img|svg)/);
  });
}
test('safe message text and emoji still render', () => {
  const html = renderToStaticMarkup(
    React.createElement(MessageBody, {content: 'Welcome 👋 to AT&amp;T'})
  );
  assert.match(html, /class="emoji-icon"/);
  assert.match(html, /alt="👋"/);
  assert.match(html, /AT(?:&amp;|&)T/);
});

function fixture(options = {}) {
  const sent = [];
  const parent = {postMessage: (...args) => sent.push(args)};
  const window = {
    parent,
    location: {origin: 'https://chat.example'},
    addEventListener() {},
    removeEventListener() {},
  };
  const document = {
    referrer: options.noReferrer ? '' : parentOrigin + '/rooms',
    documentElement: {style: {setProperty() {}}},
  };
  const runtime = createRuntime(
    {window, parent, document},
    {'./ChatWindow': () => null}
  );
  const Wrapper = runtime.load('components/Widget.tsx').default;
  const wrapper = synchronousState(
    new Wrapper({
      config: {
        token: '-1',
        inbox: firstProfile,
        parentOrigin: options.explicitOrigin,
        disableAnalyticsTracking: '1',
      },
    })
  );
  wrapper.componentDidMount();
  const event = (payload, fields = {}) => ({
    source: parent,
    origin: parentOrigin,
    data: {event: 'config:update', payload},
    ...fields,
  });
  return {wrapper, event, window, parent, document, sent};
}

test('the real parent can update presentation', () => {
  const f = fixture();
  f.wrapper.postMessageHandlers(f.event({title: 'Welcome to our hotel'}));
  assert.equal(f.wrapper.state.config.title, 'Welcome to our hotel');
});
test('same-origin sibling frames cannot change configuration', () => {
  const f = fixture();
  f.wrapper.postMessageHandlers(f.event({inbox: secondProfile}, {source: {}}));
  assert.equal(f.wrapper.state.config.inbox, firstProfile);
});
test('a parent at an unexpected origin cannot change configuration', () => {
  const f = fixture();
  f.wrapper.postMessageHandlers(
    f.event({inbox: secondProfile}, {origin: 'https://ad.example'})
  );
  assert.equal(f.wrapper.state.config.inbox, firstProfile);
});
test('malformed messages are ignored without throwing', () => {
  const f = fixture();
  for (const data of [
    null,
    'config:update',
    [],
    {event: 'config:update', payload: 'invalid'},
  ]) {
    assert.doesNotThrow(() =>
      f.wrapper.postMessageHandlers({
        source: f.parent,
        origin: parentOrigin,
        data,
      })
    );
  }
  assert.equal(f.wrapper.state.config.inbox, firstProfile);
});
test('invalid assistant IDs are rejected even from the real parent', () => {
  const f = fixture();
  for (const inbox of [
    'attacker.example/',
    'a@attacker.example',
    'a?query=x',
    'a#fragment',
    '',
    ['x'],
  ]) {
    f.wrapper.postMessageHandlers(f.event({inbox}));
    assert.equal(f.wrapper.state.config.inbox, firstProfile);
  }
});
test('a legitimate assistant switch remounts conversation state', () => {
  const f = fixture();
  const before = f.wrapper.render().props.children;
  f.wrapper.postMessageHandlers(f.event({inbox: secondProfile}));
  const after = f.wrapper.render().props.children;
  assert.equal(after.props.inboxId, secondProfile);
  assert.equal(before.props.assistantRemount, false);
  assert.equal(after.props.assistantRemount, true);
  assert.notEqual(
    after.key,
    before.key,
    'different assistants must not reuse one ChatWindow instance'
  );
});
test('explicit parent origin supports referrer-suppressed embeds', () => {
  const f = fixture({noReferrer: true, explicitOrigin: parentOrigin});
  f.wrapper.postMessageHandlers(f.event({title: 'Private referrer policy'}));
  assert.equal(f.wrapper.state.config.title, 'Private referrer policy');
});
test('missing origin binding fails closed', () => {
  const f = fixture({noReferrer: true});
  f.wrapper.postMessageHandlers(f.event({title: 'Unbound parent'}));
  assert.equal(f.wrapper.state.config.title, undefined);
});
test('conflicting explicit origin and referrer fail closed', () => {
  const f = fixture({explicitOrigin: 'https://different.example'});
  f.wrapper.postMessageHandlers(f.event({title: 'Conflicting parent'}));
  assert.equal(f.wrapper.state.config.title, undefined);
});

function chatFixture(inbox = firstProfile, respond = () => {}) {
  const f = fixture();
  const requests = [];
  const writes = [];
  const quietLogger = class {
    debug() {}
    error() {}
    warn() {}
  };
  const runtime = createRuntime(
    {window: f.window, parent: f.parent, document: f.document},
    {
      '../helpers/a2a-client': {
        streamMessage: async (
          url,
          request,
          onToken,
          onComplete,
          onError,
          signal
        ) => {
          requests.push({url, request});
          await respond({onComplete, onError, signal});
        },
      },
      '../helpers/storage': {
        getContextId: () => null,
        setContextId: (...args) => writes.push(args),
        saveChatHistory: (...args) => writes.push(args),
      },
      '../helpers/visibility': {addVisibilityEventListener: () => () => {}},
      '../helpers/logger': quietLogger,
    }
  );
  const ChatWindow = runtime.load('components/ChatWindow.tsx').default;
  const chat = synchronousState(
    new ChatWindow({
      inboxId: inbox,
      accountId: '-1',
      parentOrigin,
      disableAnalyticsTracking: true,
    })
  );
  return {...f, chat, requests, writes};
}
test('the send boundary rejects a malicious profile without leaking history', async () => {
  const f = chatFixture('attacker.example/');
  f.chat.state.messages = [
    {body: 'Private booking details', customer_id: 'guest'},
  ];
  await f.chat.handleSendMessage({body: 'Next question'});
  assert.equal(
    f.requests.length,
    0,
    'no request may contain guest history at an untrusted host'
  );
});
test('valid profile requests retain their fixed agent origin', async () => {
  const f = chatFixture(firstProfile, ({onComplete}) =>
    onComplete('At 3 p.m.', 'current-context')
  );
  await f.chat.handleSendMessage({body: 'Check-in time?'});
  assert.equal(f.requests.length, 1);
  assert.equal(
    f.requests[0].url,
    'https://f1a4e101-533a-8355-80f0-f448ed950b76.agents.inhotel.io/'
  );
  assert.equal(f.writes.length, 2);
  assert.equal(f.sent[0][0].event, 'message:received');
});
test('late replies after an assistant unmount cannot write history or emit events', async () => {
  let finish;
  let requestSignal;
  const f = chatFixture(firstProfile, ({onComplete, signal}) => {
    requestSignal = signal;
    return new Promise((resolve) => {
      finish = () => {
        onComplete('Reply from the old instance', 'stale-context');
        resolve();
      };
    });
  });
  const pending = f.chat.handleSendMessage({body: 'Original question'});
  f.chat.componentWillUnmount();
  finish();
  await pending;
  assert.equal(f.writes.length, 0);
  assert.equal(f.sent.length, 0);
  assert.equal(requestSignal.aborted, true);
});

test('chat state messages reject unrelated sender windows', () => {
  const f = chatFixture();
  f.chat.state.customerId = 'original';
  f.chat.postMessageHandlers({
    source: {},
    origin: parentOrigin,
    data: {event: 'customer:set:id', payload: 'intruder'},
  });
  assert.equal(f.chat.state.customerId, 'original');
});
test('chat events target only the expected parent origin', () => {
  const f = chatFixture();
  f.chat.emit('message:sent', {body: 'Test message'});
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0][1], parentOrigin);
});

function parentBridge() {
  const iframeWindow = {};
  const received = [];
  const bridge = {
    iframeRef: {contentWindow: iframeWindow},
    getIframeUrl: () => 'https://chat.example/',
    logger: {debug() {}, warn() {}},
    hasValidPayloadIdentity: () => true,
    handleMessageReceived: (payload) => received.push(payload),
  };
  return {
    handler: bundledLauncherHandler('postMessageHandlers', bridge),
    received,
    iframeWindow,
  };
}
test('the bundled parent bridge accepts only its actual iframe', () => {
  const f = parentBridge();
  const data = {event: 'message:received', payload: {body: 'Unrelated chat'}};
  f.handler({source: {}, origin: 'https://chat.example', data});
  assert.equal(f.received.length, 0);
  f.handler({source: f.iframeWindow, origin: 'https://chat.example', data});
  assert.equal(f.received.length, 1);
});

test('a remounted iframe keeps an already open launcher visible', () => {
  const sent = [];
  const bridge = {
    state: {isLoaded: true, isOpen: true, config: {subscriptionPlan: 'team'}},
    setState(change) {
      Object.assign(this.state, change);
    },
    props: {},
    shouldOpenByDefault: () => false,
    send: (...args) => sent.push(args),
  };
  bundledLauncherHandler('handleChatLoaded', bridge)({assistantRemount: true});
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [
    ['inhotel:toggle', {isOpen: true}],
    ['inhotel:plan', {plan: 'team'}],
  ]);
});

test('a remounted iframe stays closed when onChatLoaded initially opens it', () => {
  const sent = [];
  let opened = 0;
  const bridge = {
    state: {
      isLoaded: false,
      isOpen: false,
      shouldDisplayNotifications: true,
      config: {},
    },
    setState(change, callback) {
      Object.assign(this.state, change);
      if (callback) callback();
    },
    props: {onChatLoaded: ({open}) => open()},
    handleOpenWidget: () => {
      opened++;
      bridge.state.isOpen = true;
    },
    shouldOpenByDefault: () => true,
    emitToggleEvent: () => {
      opened++;
    },
    send: (...args) => sent.push(args),
  };
  const loaded = bundledLauncherHandler('handleChatLoaded', bridge);
  loaded();
  assert.equal(bridge.state.isOpen, true);
  assert.equal(opened, 1);

  bridge.state.isOpen = false;
  bridge.state.shouldDisplayNotifications = true;
  sent.length = 0;
  loaded({assistantRemount: true});

  assert.equal(bridge.state.isOpen, false);
  assert.equal(bridge.state.shouldDisplayNotifications, false);
  assert.equal(opened, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), [
    'inhotel:toggle',
    {isOpen: false},
  ]);
  loaded();
  assert.equal(
    bridge.state.isOpen,
    true,
    'a document reload runs onChatLoaded'
  );
  assert.equal(opened, 2);
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
    `${tests.length - failed}/${tests.length} security regressions passed`
  );
  if (failed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
