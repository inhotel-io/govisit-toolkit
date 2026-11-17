// Any A2A agent, given by its agent card: reading the card, talking to the
// agent, and the chat drawn for it with no inHotel service. Nothing here
// contacts a hosted service; the end-to-end check runs a local echo agent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {bundledLauncherHandler} = require('./support/runtime.cjs');
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
        resolveJsonModule: true,
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
  APPEARANCE_EXTENSION,
  CARD_LOAD_TIMEOUT_MS,
  inhotelProfileOf,
  isAgentCardUrl,
  parseAgentCard,
  readAgentCard,
  webAddress,
} = require('../helpers/agent-card.ts');
const {streamMessage} = require('../helpers/a2a-client.ts');
const {settingsAppearance, embedProfile} = require('../helpers/appearance.ts');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ChatWindow = require('../components/ChatWindow.tsx').default;
const Widget = require('../components/Widget.tsx').default;
for (const [ext, previous] of oldExtensions) {
  if (previous) require.extensions[ext] = previous;
  else delete require.extensions[ext];
}

const tests = [];
const test = (name, run) => tests.push({name, run});

const CARD_URL = 'https://agent.example/.well-known/agent-card.json';
// An A2A 0.3 agent card, as most agents publish one.
const card = () => ({
  protocolVersion: '0.3.0',
  name: 'Concierge',
  description: 'Answers questions about your stay.',
  url: 'https://agent.example/a2a',
  preferredTransport: 'JSONRPC',
  iconUrl: '/icon.png',
  version: '1.0.0',
  capabilities: {streaming: true},
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'stay',
      name: 'Stay',
      examples: ['When is breakfast?', 'Is there parking?'],
    },
    {
      id: 'area',
      name: 'Area',
      examples: ['What is near?', 'When is breakfast?'],
    },
  ],
});

test('only a web address is an agent card address: https, or http on this computer', () => {
  for (const address of [
    CARD_URL,
    'https://agent.example/cards/concierge.json',
    'http://localhost:3300/.well-known/agent-card.json',
    'http://127.0.0.1:3300/.well-known/agent-card.json',
    'http://[::1]:3300/.well-known/agent-card.json',
  ]) {
    assert.equal(isAgentCardUrl(address), true, address);
  }
  for (const address of [
    'http://agent.example/.well-known/agent-card.json',
    'https://user:secret@agent.example/.well-known/agent-card.json',
    'javascript:alert(1)',
    'data:application/json,{}',
    'ftp://agent.example/card.json',
    '//agent.example/card.json',
    '/.well-known/agent-card.json',
    'agent.example',
    '',
    null,
    42,
  ]) {
    assert.equal(isAgentCardUrl(address), false, String(address));
  }
  // An address in a card is read against the card's own.
  assert.equal(
    webAddress('/icon.png', CARD_URL),
    'https://agent.example/icon.png'
  );
  assert.equal(webAddress('javascript:alert(1)', CARD_URL), null);
});

test('an inHotel agent card names its profile ID, and only an exact one does', () => {
  const id = 'f1a4e101-533a-8355-80f0-f448ed950b76';
  assert.equal(
    inhotelProfileOf(
      `https://${id}.agents.inhotel.io/.well-known/agent-card.json`
    ),
    id
  );
  for (const address of [
    CARD_URL,
    `https://${id}.agents.inhotel.io/.well-known/agent-card.json?x=1`,
    `http://${id}.agents.inhotel.io/.well-known/agent-card.json`,
    `https://${id}.agents.inhotel.io.agent.example/.well-known/agent-card.json`,
    `https://a.${id}.agents.inhotel.io/.well-known/agent-card.json`,
  ]) {
    assert.equal(inhotelProfileOf(address), null, address);
  }
});

test('a card gives the agent’s address, name, picture, streaming and example questions', () => {
  assert.deepEqual(parseAgentCard(card(), CARD_URL), {
    url: CARD_URL,
    endpoint: 'https://agent.example/a2a',
    name: 'Concierge',
    description: 'Answers questions about your stay.',
    iconUrl: 'https://agent.example/icon.png',
    streaming: true,
    examples: ['When is breakfast?', 'Is there parking?', 'What is near?'],
    appearance: null,
  });
});

test('the agent is reached over JSON-RPC, at the card’s own address or another interface it names', () => {
  const endpoint = (change) => {
    const given = card();
    change(given);
    return parseAgentCard(given, CARD_URL).endpoint;
  };
  // A relative address is read against the card's.
  assert.equal(
    endpoint((c) => (c.url = '/a2a/v1')),
    'https://agent.example/a2a/v1'
  );
  // Without a transport named, JSON-RPC is meant.
  assert.equal(
    endpoint((c) => delete c.preferredTransport),
    'https://agent.example/a2a'
  );
  assert.equal(
    endpoint((c) => {
      c.preferredTransport = 'GRPC';
      c.additionalInterfaces = [
        {transport: 'GRPC', url: 'https://agent.example:443'},
        {transport: 'JSONRPC', url: 'https://rpc.agent.example/'},
      ];
    }),
    'https://rpc.agent.example/'
  );
  // No JSON-RPC interface, or one at an address the chat may not call.
  for (const change of [
    (c) => (c.preferredTransport = 'GRPC'),
    (c) => delete c.url,
    (c) => (c.url = 'http://agent.example/a2a'),
    (c) => (c.url = 'javascript:alert(1)'),
  ]) {
    assert.equal(endpoint(change), null);
  }
});

test('what a card gives in the wrong shape is left out', () => {
  const read = parseAgentCard(
    {
      ...card(),
      name: ['Concierge'],
      description: '   ',
      iconUrl: 'javascript:alert(1)',
      capabilities: {streaming: 'yes'},
      skills: [{examples: 'one'}, 'two', {examples: [3, '', ' Is it far? ']}],
    },
    CARD_URL
  );
  assert.equal(read.name, null);
  assert.equal(read.description, null);
  assert.equal(read.iconUrl, null);
  assert.equal(read.streaming, false);
  assert.deepEqual(read.examples, ['Is it far?']);
  // A text too long to be one is cut, and there are six questions at most.
  const many = parseAgentCard(
    {
      ...card(),
      name: 'N'.repeat(400),
      skills: [
        {examples: Array.from({length: 10}, (_, i) => `Question ${i}?`)},
      ],
    },
    CARD_URL
  );
  assert.equal(many.name.length, 255);
  assert.equal(many.examples.length, 6);
  for (const nothing of [null, 'card', [], 42]) {
    assert.equal(parseAgentCard(nothing, CARD_URL), null);
  }
});

test('a card on the web cannot send the chat to the guest’s own computer or network', () => {
  const named = parseAgentCard(
    {
      ...card(),
      url: 'http://localhost:8080/',
      iconUrl: 'https://127.0.0.1/icon.png',
    },
    CARD_URL
  );
  assert.equal(named.endpoint, null);
  assert.equal(named.iconUrl, null);
  for (const url of [
    'https://localhost/a2a',
    'https://foo.localhost/a2a',
    'https://127.1.2.3/a2a',
    'https://[::1]/a2a',
    'https://0.0.0.0/a2a',
    'https://10.0.0.5/a2a',
    'https://172.16.0.1/a2a',
    'https://192.168.1.1/a2a',
    'https://169.254.169.254/a2a',
    'https://[fd00::1]/a2a',
    'https://printer.local/a2a',
  ])
    assert.equal(
      parseAgentCard({...card(), url}, CARD_URL).endpoint,
      null,
      url
    );
  // Another interface it lists is held to the same rule.
  assert.equal(
    parseAgentCard(
      {
        ...card(),
        preferredTransport: 'GRPC',
        additionalInterfaces: [
          {transport: 'JSONRPC', url: 'https://192.168.1.1/a2a'},
        ],
      },
      CARD_URL
    ).endpoint,
    null
  );
  // A card on this computer, or on the guest's network, may name addresses
  // there: that is where it is.
  assert.equal(
    parseAgentCard(
      {...card(), url: 'http://localhost:3300/'},
      'http://localhost:3300/.well-known/agent-card.json'
    ).endpoint,
    'http://localhost:3300/'
  );
  assert.equal(
    parseAgentCard(
      {...card(), url: 'https://192.168.1.10/a2a'},
      'https://192.168.1.10/.well-known/agent-card.json'
    ).endpoint,
    'https://192.168.1.10/a2a'
  );
  // An address on the web stays one.
  assert.equal(
    parseAgentCard({...card(), url: 'https://172.32.0.1/a2a'}, CARD_URL)
      .endpoint,
    'https://172.32.0.1/a2a'
  );
});

test('a card can publish the look of its chat, in an extension of its own', () => {
  const look = {
    elements: [{name: 'root', component: 'FloatingChat', values: {}}],
  };
  const read = parseAgentCard(
    {
      ...card(),
      capabilities: {
        streaming: true,
        extensions: [
          {uri: 'https://other.example/extension', params: {elements: []}},
          {uri: APPEARANCE_EXTENSION, required: false, params: look},
        ],
      },
    },
    CARD_URL
  );
  assert.deepEqual(read.appearance, look);
  assert.equal(
    APPEARANCE_EXTENSION,
    'https://floating-chat.govisit.ai/extensions/appearance/v1'
  );
});

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

test('a card is read without credentials, and a card that does not answer is no card', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async (calls) => {
      const read = await readAgentCard(CARD_URL);
      assert.equal(read.name, 'Concierge');
      assert.equal(calls[0].url, CARD_URL);
      assert.equal(calls[0].options.credentials, 'omit');
    }
  );
  for (const failing of [
    async () => ({ok: false, json: async () => card()}),
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
    await withFetch(failing, async () => {
      assert.equal(await readAgentCard(CARD_URL), null);
    });
  }
  // An address that is not one is not asked for.
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async (calls) => {
      assert.equal(await readAgentCard('http://agent.example/card.json'), null);
      assert.equal(calls.length, 0);
    }
  );
});

// What a JSON-RPC answer looks like to the client, streamed or not.
const sse = (events) => {
  const text = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join('');
  const bytes = new TextEncoder().encode(text);
  let sent = false;
  return {
    ok: true,
    status: 200,
    headers: {get: () => 'text/event-stream'},
    body: {
      getReader: () => ({
        read: async () =>
          sent ? {done: true} : ((sent = true), {value: bytes, done: false}),
      }),
    },
  };
};
const json = (value) => ({
  ok: true,
  status: 200,
  headers: {get: () => 'application/json'},
  text: async () => JSON.stringify(value),
});
// Send one message and collect what the client makes of the answer.
async function send(answer, options, request = {}) {
  let result = null;
  await withFetch(
    async () => answer,
    async (calls) => {
      await streamMessage(
        'https://agent.example/a2a',
        {message: 'Hello', assistant_id: '', ...request},
        () => {},
        (text, contextId) => (result = {text, contextId}),
        (error) => (result = {error: error.message}),
        undefined,
        options
      );
      result.request = JSON.parse(calls[0].options.body);
      result.accept = calls[0].options.headers.Accept;
      result.headers = calls[0].options.headers;
    }
  );
  return result;
}
// A stream that sends its events and then stays open.
const openStream = (events) => {
  const answer = sse(events);
  const reader = answer.body.getReader();
  let sent = false;
  answer.body.getReader = () => ({
    read: () => (sent ? new Promise(() => {}) : ((sent = true), reader.read())),
    cancel: async () => {},
  });
  return answer;
};

test('any agent is sent a plain A2A message, with no history and no inHotel metadata', async () => {
  const sent = await send(
    sse([]),
    {dialect: 'a2a', streaming: true},
    {
      context_id: 'ctx-1',
      session_id: 'session-1',
      history: [{role: 'user', content: 'Earlier', timestamp: 'now'}],
    }
  );
  const {id, ...rest} = sent.request;
  assert.equal(typeof id, 'string');
  const {messageId, ...message} = rest.params.message;
  assert.equal(typeof messageId, 'string');
  assert.deepEqual(
    {...rest, params: {...rest.params, message}},
    {
      jsonrpc: '2.0',
      method: 'message/stream',
      params: {
        message: {
          kind: 'message',
          role: 'user',
          parts: [{kind: 'text', text: 'Hello'}],
          contextId: 'ctx-1',
        },
      },
    }
  );
  assert.equal(sent.accept, 'text/event-stream');
  // An agent that does not stream is asked once, and answers once.
  const once = await send(
    json({
      jsonrpc: '2.0',
      id: '1',
      result: {kind: 'message', parts: [{kind: 'text', text: 'Hi'}]},
    }),
    {dialect: 'a2a', streaming: false}
  );
  assert.equal(once.request.method, 'message/send');
  assert.equal(once.accept, 'application/json');
  assert.equal(once.text, 'Hi');
  assert.equal('contextId' in once.request.params.message, false);
});

test('an inHotel agent is still sent what it always was', async () => {
  const sent = await send(sse([]), undefined, {
    context_id: 'ctx-1',
    session_id: 'session-1',
    history: [{role: 'user', content: 'Earlier', timestamp: 'now'}],
  });
  assert.equal(sent.request.method, 'message/stream');
  assert.equal(sent.request.params.stream, true);
  assert.equal(sent.request.params.metadata.flowProfile, 'papercups');
  assert.equal(sent.request.params.message.history.length, 1);
});

test('the reply is read from every shape an A2A agent gives it', async () => {
  const text = (part) => ({kind: 'text', text: part});
  const status = (state, parts, extra = {}) => ({
    jsonrpc: '2.0',
    id: '1',
    result: {
      kind: 'status-update',
      contextId: 'ctx-9',
      status: {state, message: parts && {role: 'agent', parts}},
      ...extra,
    },
  });
  const a2a = {dialect: 'a2a', streaming: true};
  // Words streamed as the agent works, and the context kept.
  assert.deepEqual(
    await send(
      sse([
        {
          jsonrpc: '2.0',
          id: '1',
          result: {
            kind: 'task',
            id: 't',
            contextId: 'ctx-9',
            status: {state: 'submitted'},
          },
        },
        status('working', [text('Hello ')]),
        status('working', [text('there')]),
        status('completed', null, {final: true}),
      ]),
      a2a
    ).then(({text, contextId}) => ({text, contextId})),
    {text: 'Hello there', contextId: 'ctx-9'}
  );
  // The whole reply in the last update, and nothing before it.
  assert.equal(
    (
      await send(
        sse([status('completed', [text('All at once')], {final: true})]),
        a2a
      )
    ).text,
    'All at once'
  );
  // One message as the whole answer.
  assert.equal(
    (
      await send(
        sse([
          {
            jsonrpc: '2.0',
            id: '1',
            result: {
              kind: 'message',
              role: 'agent',
              parts: [text('A message')],
            },
          },
        ]),
        a2a
      )
    ).text,
    'A message'
  );
  // An artifact sent in pieces, and one sent whole.
  const artifact = (parts, append) => ({
    jsonrpc: '2.0',
    id: '1',
    result: {kind: 'artifact-update', append, artifact: {parts}},
  });
  assert.equal(
    (
      await send(
        sse([
          artifact([text('Part one, ')], false),
          artifact([text('part two')], true),
        ]),
        a2a
      )
    ).text,
    'Part one, part two'
  );
  // A task answered at once, with its reply in its status or its artifacts.
  for (const result of [
    {
      kind: 'task',
      status: {state: 'completed', message: {parts: [text('In the status')]}},
    },
    {
      kind: 'task',
      status: {state: 'completed'},
      artifacts: [{parts: [text('In the status')]}],
    },
  ]) {
    assert.equal(
      (
        await send(json({jsonrpc: '2.0', id: '1', result}), {
          dialect: 'a2a',
          streaming: false,
        })
      ).text,
      'In the status'
    );
  }
});

test('an error the agent answers with is an error, streamed or not', async () => {
  const error = {
    jsonrpc: '2.0',
    id: '1',
    error: {code: -32602, message: 'Invalid params'},
  };
  assert.deepEqual(
    await send(sse([error]), {dialect: 'a2a', streaming: true}).then(
      (r) => r.error
    ),
    'Invalid params'
  );
  assert.deepEqual(
    await send(json(error), {dialect: 'a2a', streaming: false}).then(
      (r) => r.error
    ),
    'Invalid params'
  );
});

const textPart = (part) => ({kind: 'text', text: part});
const statusEvent = (state, parts, extra = {}) => ({
  jsonrpc: '2.0',
  id: '1',
  result: {
    kind: 'status-update',
    contextId: 'ctx-9',
    status: {state, message: parts && {role: 'agent', parts}},
    ...extra,
  },
});
const artifactEvent = (artifactId, parts, append) => ({
  jsonrpc: '2.0',
  id: '1',
  result: {kind: 'artifact-update', append, artifact: {artifactId, parts}},
});

test('a plain A2A reply is the agent’s answer, not its progress', async () => {
  const reply = async (events) =>
    (await send(sse(events), {dialect: 'a2a', streaming: true})).text;
  // Progress, then the answer in the last status.
  assert.equal(
    await reply([
      statusEvent('working', [textPart('Looking it up…')]),
      statusEvent('completed', [textPart('Breakfast is 7-10.')], {
        final: true,
      }),
    ]),
    'Breakfast is 7-10.'
  );
  // Progress, then the answer as an artifact sent in pieces.
  assert.equal(
    await reply([
      statusEvent('working', [textPart('Looking it up…')]),
      artifactEvent('a', [textPart('Breakfast ')], false),
      artifactEvent('a', [textPart('is 7-10.')], true),
      statusEvent('completed', null, {final: true}),
    ]),
    'Breakfast is 7-10.'
  );
  // Two artifacts are both the answer.
  assert.equal(
    await reply([
      artifactEvent('a', [textPart('Breakfast is 7-10.')]),
      artifactEvent('b', [textPart('Lunch is 12-14.')]),
    ]),
    'Breakfast is 7-10.\n\nLunch is 12-14.'
  );
  // Words streamed as the agent works are kept, whatever they say.
  assert.equal(
    await reply([
      statusEvent('working', [textPart('I am thinking ')]),
      statusEvent('working', [textPart('about loading bikes')]),
      statusEvent('completed', null, {final: true}),
    ]),
    'I am thinking about loading bikes'
  );
  // The agent's question, when it needs more from the guest.
  assert.equal(
    await reply([
      statusEvent('input-required', [textPart('For which date?')], {
        final: true,
      }),
    ]),
    'For which date?'
  );
});

test('an inHotel agent’s reply is read as it always was', async () => {
  const reply = async (events) => (await send(sse(events))).text;
  // Its words as it works, then the whole reply as an artifact.
  assert.equal(
    await reply([
      statusEvent('working', [textPart('')]),
      statusEvent('working', [textPart('Hello ')]),
      statusEvent('working', [textPart('there')]),
      artifactEvent('r', [textPart('Hello there')]),
      statusEvent('completed', null, {final: true}),
    ]),
    'Hello there'
  );
  // A line about its flow is not a word of the reply.
  assert.equal(
    await reply([
      statusEvent('working', [textPart('Running the flow...')]),
      statusEvent('working', [textPart('Hi')]),
    ]),
    'Hi'
  );
});

test('a plain A2A stream ends at its final event, and an agent that stops answering is an error', async () => {
  const ended = await send(
    openStream([
      statusEvent('working', [textPart('Hi')]),
      statusEvent('completed', null, {final: true}),
    ]),
    {dialect: 'a2a', streaming: true, silenceMs: 1000}
  );
  assert.equal(ended.text, 'Hi');
  const silent = await send(
    openStream([statusEvent('working', [textPart('Hi')])]),
    {dialect: 'a2a', streaming: true, silenceMs: 30}
  );
  assert.match(silent.error, /stopped answering/);
  // An agent that never answers at all.
  let result = null;
  await withFetch(
    () => new Promise(() => {}),
    async () => {
      await streamMessage(
        'https://agent.example/a2a',
        {message: 'Hello', assistant_id: ''},
        () => {},
        (text) => (result = {text}),
        (error) => (result = {error: error.message}),
        undefined,
        {dialect: 'a2a', streaming: true, silenceMs: 30}
      );
    }
  );
  assert.match(result.error, /stopped answering/);
});

test('any agent is asked with only the headers a JSON request needs', async () => {
  const plain = await send(sse([]), {dialect: 'a2a', streaming: true});
  assert.deepEqual(Object.keys(plain.headers).sort(), [
    'Accept',
    'Content-Type',
  ]);
  // An inHotel agent is asked as it always was.
  assert.equal((await send(sse([]))).headers['Cache-Control'], 'no-cache');
});

// The chat window for a card's agent, open. `ChatWindow` logs while it
// works; that is kept out of the test output.
const quietly = (run) => {
  const log = console.log;
  const error = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return run();
  } finally {
    console.log = log;
    console.error = error;
  }
};
const store = () => {
  const items = {};
  return {
    items,
    getItem: (key) => (key in items ? items[key] : null),
    setItem: (key, value) => (items[key] = String(value)),
    removeItem: (key) => delete items[key],
  };
};
function browser() {
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
  global.localStorage = store();
  global.sessionStorage = store();
}
const AGENT = {
  cardUrl: CARD_URL,
  endpoint: 'https://agent.example/a2a',
  streaming: true,
  iconUrl: 'https://agent.example/icon.png',
  isReading: false,
};
function chat(props = {}, state = {}) {
  browser();
  const instance = quietly(
    () =>
      new ChatWindow({
        accountId: '-1',
        agent: AGENT,
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
  instance.events = [];
  instance.emit = (event, payload) => instance.events.push([event, payload]);
  Object.assign(instance.state, {isOpen: true}, state);
  return instance;
}
const html = (instance) =>
  quietly(() => renderToStaticMarkup(instance.render()));
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise(setImmediate);
};
// An agent that answers every message with one word.
const answering = (word) => async () =>
  sse([
    {
      jsonrpc: '2.0',
      id: '1',
      result: {
        kind: 'status-update',
        contextId: 'ctx-' + word,
        status: {
          state: 'working',
          message: {parts: [{kind: 'text', text: word}]},
        },
      },
    },
  ]);

test('a card’s agent is sent messages at the card’s address, and nowhere else', async () => {
  await withFetch(answering('Yes'), async (calls) => {
    const instance = chat(
      {},
      {
        messages: [
          {
            id: 'g',
            type: 'bot',
            body: 'Hello',
            created_at: '2026-11-16T07:00:00Z',
          },
        ],
      }
    );
    await quietly(() =>
      instance.handleSendMessage({body: 'Is there parking?'})
    );
    await settle();
    assert.deepEqual(
      calls.map((call) => call.url),
      ['https://agent.example/a2a']
    );
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.method, 'message/stream');
    assert.deepEqual(body.params.message.parts, [
      {kind: 'text', text: 'Is there parking?'},
    ]);
    assert.equal('history' in body.params.message, false);
    assert.equal('metadata' in body.params, false);
    assert.deepEqual(
      instance.state.messages.map((m) => m.body),
      ['Hello', 'Is there parking?', 'Yes']
    );
  });
  // An agent that does not stream is asked once.
  await withFetch(
    async () =>
      json({
        jsonrpc: '2.0',
        id: '1',
        result: {kind: 'message', parts: [{kind: 'text', text: 'Yes'}]},
      }),
    async (calls) => {
      const instance = chat({agent: {...AGENT, streaming: false}});
      await quietly(() => instance.handleSendMessage({body: 'Hi'}));
      await settle();
      assert.equal(JSON.parse(calls[0].options.body).method, 'message/send');
      assert.equal(
        instance.state.messages[instance.state.messages.length - 1].body,
        'Yes'
      );
    }
  );
});

test('with no address to send to, nothing is sent', async () => {
  await withFetch(answering('Yes'), async (calls) => {
    for (const props of [
      // The card did not answer, or named no address the chat may call.
      {agent: {...AGENT, endpoint: null}},
      {agent: {...AGENT, endpoint: 'http://agent.example/a2a'}},
      // An inHotel ID that is not one is never made up for by a card.
      {inboxId: 'attacker.example/', agent: AGENT},
      {agent: null},
    ]) {
      const instance = chat(props);
      await quietly(() => instance.handleSendMessage({body: 'Hi'}));
    }
    assert.equal(calls.length, 0);
  });
});

test('each agent keeps its own conversation, and its context', async () => {
  await withFetch(answering('Yes'), async (calls) => {
    const first = chat();
    await quietly(() => first.handleSendMessage({body: 'Hi'}));
    await settle();
    const stored = JSON.parse(
      localStorage.getItem('inhotel_chat_history_card:' + CARD_URL)
    );
    assert.deepEqual(
      stored.messages.map((m) => m.content),
      ['Hi', 'Yes']
    );
    // The next message carries the context the agent gave.
    await quietly(() => first.handleSendMessage({body: 'And then?'}));
    await settle();
    assert.equal(
      JSON.parse(calls[1].options.body).params.message.contextId,
      'ctx-Yes'
    );

    // Another agent starts with nothing of it.
    const other = 'https://other.example/.well-known/agent-card.json';
    const items = localStorage.items;
    const second = chat({
      agent: {...AGENT, cardUrl: other, endpoint: 'https://other.example/'},
    });
    global.localStorage.items = items;
    Object.assign(global.localStorage, {
      getItem: (key) => (key in items ? items[key] : null),
    });
    await quietly(() => second.componentDidMount());
    assert.deepEqual(second.state.messages, []);
    await quietly(() => second.handleSendMessage({body: 'Hello'}));
    await settle();
    assert.equal(
      'contextId' in JSON.parse(calls[2].options.body).params.message,
      false
    );
  });
});

test('the agent’s picture is the card’s, and no other card is read for it', async () => {
  await withFetch(answering('Yes'), async (calls) => {
    const instance = chat();
    await quietly(() => instance.componentDidMount());
    const markup = html(
      chat(
        {},
        {
          messages: [
            {
              id: 'a',
              type: 'agent',
              user_id: 1,
              body: 'Hi',
              created_at: '2026-11-16T07:00:00Z',
            },
          ],
        }
      )
    );
    assert.match(markup, /src="https:\/\/agent\.example\/icon\.png"/);
    assert.equal(calls.length, 0);
    // While the card is being read the picture's place is kept.
    const reading = html(
      chat(
        {agent: {...AGENT, iconUrl: null, isReading: true}},
        {
          messages: [
            {
              id: 'a',
              type: 'agent',
              user_id: 1,
              body: 'Hi',
              created_at: '2026-11-16T07:00:00Z',
            },
          ],
        }
      )
    );
    assert.match(reading, /data-avatar-state="loading"/);
  });
});

// A contact form a page's own profile gives, for a card's chat.
const formLook = () =>
  embedProfile(
    {
      elements: [
        {name: 'root', component: 'FloatingChat', values: {contact: 'contact'}},
        {
          name: 'contact',
          component: 'Contact',
          values: {form: 'form', email: 'front@hotel.example'},
        },
        {
          name: 'form',
          component: 'ContactForm',
          values: {email: 'email', message: 'message'},
        },
        {name: 'email', component: 'FormField', values: {}},
        {name: 'message', component: 'FormField', values: {}},
      ],
    },
    'en'
  );
const {profileAppearance} = require('../helpers/appearance.ts');
const lookOf = (profile) => profileAppearance(profile, {}, []);

test('a card’s contact form is offered when the page takes it, and sent to the page', async () => {
  const envelope = /data-contact-form-control="true"/;
  assert.match(
    html(chat({appearance: lookOf(formLook()), hasContactHandler: true})),
    envelope
  );
  assert.doesNotMatch(html(chat({appearance: lookOf(formLook())})), envelope);
  // Without a profile the same holds.
  assert.match(
    html(
      chat({
        appearance: settingsAppearance({shouldShowContactForm: true}),
        hasContactHandler: true,
      })
    ),
    envelope
  );

  await withFetch(answering('Yes'), async (calls) => {
    const instance = chat(
      {appearance: lookOf(formLook()), hasContactHandler: true},
      {
        isMailIconClicked: true,
        email: 'ada@guest.example',
        message: 'Hello',
        firstName: 'Left over',
      }
    );
    quietly(() => instance.handleSubmitCF());
    assert.equal(calls.length, 0);
    assert.deepEqual(instance.events, [
      [
        'contact:submit',
        {
          firstName: '',
          lastName: '',
          email: 'ada@guest.example',
          message: 'Hello',
        },
      ],
    ]);
    assert.equal(instance.state.isLoading, true);
    // The page says it took it.
    instance.handleContactResult({ok: true});
    assert.equal(instance.state.isLoading, false);
    assert.equal(instance.state.isContactFormSubmitted, true);
    assert.match(html(instance), /Thank you for your message/);

    // The page says it could not, in its own words.
    const refused = chat(
      {appearance: lookOf(formLook()), hasContactHandler: true},
      {isMailIconClicked: true, email: 'ada@guest.example', message: 'Hello'}
    );
    quietly(() => refused.handleSubmitCF());
    refused.handleContactResult({ok: false, message: 'Our inbox is full.'});
    assert.equal(refused.state.isContactFormSubmitted, false);
    assert.match(html(refused), /Our inbox is full\./);

    // A form the page has not taken is not sent anywhere.
    const nowhere = chat(
      {appearance: lookOf(formLook())},
      {isMailIconClicked: true, email: 'ada@guest.example', message: 'Hello'}
    );
    quietly(() => nowhere.handleSubmitCF());
    assert.deepEqual(nowhere.events, []);
    assert.equal(calls.length, 0);
  });
});

test('a contact line with nothing to show is not drawn, and a phone comes with its icon', () => {
  const PHONE_ICON = 'viewBox="0 0 100000 100000"';
  const line = (instance) => {
    const markup = html(instance);
    const at = markup.indexOf('data-component="Contact"');
    return at < 0 ? null : markup.slice(at);
  };
  // A card's chat drawn from its card has no phone and no e-mail: its line is
  // the page's form, or nothing.
  assert.equal(
    line(chat({appearance: settingsAppearance({suggestions: true})})),
    null
  );
  const form = line(
    chat({
      appearance: settingsAppearance({
        shouldShowContactForm: true,
        suggestions: true,
      }),
      hasContactHandler: true,
    })
  );
  assert.match(form, /data-contact-form-control="true"/);
  assert.ok(!form.includes(PHONE_ICON));
  // A profile's line draws the phone it gives with its icon, and no icon
  // without one.
  const contactOnly = (values) =>
    lookOf(
      embedProfile(
        {
          elements: [
            {
              name: 'root',
              component: 'FloatingChat',
              values: {contact: 'contact'},
            },
            {name: 'contact', component: 'Contact', values},
          ],
        },
        'en'
      )
    );
  const phoned = line(chat({appearance: contactOnly({phone: '+1 555 0100'})}));
  assert.ok(phoned.includes(PHONE_ICON) && phoned.includes('+1 555 0100'));
  const mailed = line(
    chat({appearance: contactOnly({email: 'front@hotel.example'})})
  );
  assert.ok(mailed.includes('front@hotel.example'));
  assert.ok(!mailed.includes(PHONE_ICON));
  assert.equal(line(chat({appearance: contactOnly({})})), null);
  // inHotel's chat drawn from its settings keeps its line and its icon, as it
  // always has.
  const legacy = line(
    chat({
      inboxId: 'hotel-example',
      agent: undefined,
      appearance: settingsAppearance({}),
    })
  );
  assert.ok(legacy && legacy.includes(PHONE_ICON));
});

test('with nowhere to send, the guest cannot write: nothing written is lost', () => {
  const composer = (agent) =>
    /<textarea[^>]*disabled/.test(html(chat({agent})));
  assert.equal(composer({...AGENT, endpoint: null, isReading: true}), true);
  assert.equal(composer({...AGENT, endpoint: null, isReading: false}), true);
  assert.equal(composer(AGENT), false);
});

test('the page’s contact form is sent once, and a late answer still counts', () => {
  const instance = chat(
    {appearance: lookOf(formLook()), hasContactHandler: true},
    {isMailIconClicked: true, email: 'ada@guest.example', message: 'Hello'}
  );
  quietly(() => instance.handleSubmitCF());
  quietly(() => instance.handleSubmitCF());
  assert.equal(instance.events.length, 1);
  // The page takes longer than the chat waits, then says it took it.
  instance.handleContactTimeout();
  assert.equal(instance.state.isLoading, false);
  instance.handleContactResult({ok: true});
  assert.equal(instance.state.isContactFormSubmitted, true);
  if (instance.contactTimeout) clearTimeout(instance.contactTimeout);
});

test('the card’s example questions are offered until the guest writes', async () => {
  const offered = (instance) =>
    [...html(instance).matchAll(/<button[^>]*>([^<]*)<\/button>/g)]
      .map((match) => match[1])
      .filter((label) => /\?$/.test(label));
  const questions = ['When is breakfast?', 'Is there parking?'];
  const greeting = {
    id: 'greeting',
    type: 'bot',
    body: 'Hello',
    created_at: '2026-11-16T07:00:00Z',
  };
  const first = chat({suggestions: questions}, {messages: [greeting]});
  assert.match(html(first), /data-component="Suggestions"/);
  assert.deepEqual(offered(first), questions);
  // Once the guest has written there are none.
  const written = chat(
    {suggestions: questions},
    {
      messages: [
        greeting,
        {
          id: 'u',
          type: 'customer',
          customer_id: 'customer',
          body: 'Hi',
          created_at: '2026-11-16T07:00:00Z',
        },
      ],
    }
  );
  assert.doesNotMatch(html(written), /data-component="Suggestions"/);
  // A question is sent as the guest's message.
  await withFetch(answering('At seven'), async (calls) => {
    const instance = chat({suggestions: questions}, {messages: [greeting]});
    await quietly(() =>
      instance.handleSelectQuickReply({
        text: 'When is breakfast?',
        action: 'suggestion:0',
      })
    );
    await settle();
    assert.deepEqual(JSON.parse(calls[0].options.body).params.message.parts, [
      {kind: 'text', text: 'When is breakfast?'},
    ]);
  });
});

// The iframe's wrapper for a card's agent, as the launcher frames it.
function widget(config) {
  browser();
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
// What the wrapper hands the chat window.
const handed = (wrapper) =>
  quietly(() => wrapper.render()).props.children.props;
const LOOK_EXTENSION = (elements) => ({
  ...card(),
  capabilities: {
    streaming: true,
    extensions: [{uri: APPEARANCE_EXTENSION, params: {elements}}],
  },
});

test('a card’s chat is drawn from its card: its name, its description, its picture', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async (calls) => {
      const wrapper = widget({agentCard: CARD_URL, locale: 'en'});
      assert.equal(handed(wrapper).isAppearancePending, false);
      wrapper.componentDidMount();
      assert.equal(handed(wrapper).isAppearancePending, true);
      await settle();
      const props = handed(wrapper);
      assert.equal(props.isAppearancePending, false);
      assert.deepEqual(props.appearance.header, {
        title: 'Concierge',
        subtitle: 'Answers questions about your stay.',
      });
      assert.deepEqual(props.agent, {
        cardUrl: CARD_URL,
        endpoint: 'https://agent.example/a2a',
        streaming: true,
        iconUrl: 'https://agent.example/icon.png',
        isReading: false,
      });
      assert.equal(props.inboxId, undefined);
      // The card is the only thing read: no inHotel service is asked.
      assert.deepEqual(
        calls.map((call) => call.url),
        [CARD_URL]
      );
      wrapper.componentWillUnmount();
    }
  );
});

test('what the page sets itself stands in front of the card', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async () => {
      const wrapper = widget({
        agentCard: CARD_URL,
        title: 'Ask us',
        embedKeys: 'title',
      });
      wrapper.componentDidMount();
      await settle();
      assert.equal(handed(wrapper).appearance.header.title, 'Ask us');
      assert.equal(
        handed(wrapper).appearance.header.subtitle,
        'Answers questions about your stay.'
      );
      wrapper.componentWillUnmount();
    }
  );
});

test('a card’s own look is drawn, and the page’s own stands in front of it', async () => {
  const own = [
    {name: 'root', component: 'FloatingChat', values: {header: 'header'}},
    {
      name: 'header',
      component: 'Header',
      values: {titles: {en: 'From the card', cs: 'Z karty'}},
    },
  ];
  await withFetch(
    async () => ({ok: true, json: async () => LOOK_EXTENSION(own)}),
    async () => {
      const wrapper = widget({agentCard: CARD_URL, locale: 'cs'});
      wrapper.componentDidMount();
      await settle();
      assert.equal(handed(wrapper).appearance.source, 'profile');
      assert.equal(handed(wrapper).appearance.header.title, 'Z karty');
      assert.equal(handed(wrapper).appearance.composer, null);
      wrapper.handleConfigUpdate({
        appearance: {
          elements: [
            {
              name: 'root',
              component: 'FloatingChat',
              values: {header: 'h', composer: 'c'},
            },
            {name: 'h', component: 'Header', values: {titles: 'From the page'}},
            {name: 'c', component: 'Composer', values: {}},
          ],
        },
      });
      assert.equal(handed(wrapper).appearance.header.title, 'From the page');
      assert.notEqual(handed(wrapper).appearance.composer, null);
      wrapper.componentWillUnmount();
    }
  );
});

test('the card’s name and description stand in for a header that gives none', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async () => {
      const wrapper = widget({agentCard: CARD_URL});
      wrapper.componentDidMount();
      await settle();
      const header = (values) => {
        wrapper.handleConfigUpdate({
          appearance: {
            elements: [
              {name: 'root', component: 'FloatingChat', values: {header: 'h'}},
              {name: 'h', component: 'Header', values},
            ],
          },
        });
        return handed(wrapper).appearance.header;
      };
      assert.deepEqual(header({}), {
        title: 'Concierge',
        subtitle: 'Answers questions about your stay.',
      });
      assert.deepEqual(header({titles: 'Ask us'}), {
        title: 'Ask us',
        subtitle: 'Answers questions about your stay.',
      });
      wrapper.componentWillUnmount();
    }
  );
});

test('a card’s chat is drawn only inside a page, or on this computer', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async (calls) => {
      // Opened by itself on the hosted service: nothing is drawn or read.
      const alone = widget({agentCard: CARD_URL});
      global.window.parent = global.window;
      global.window.location = {hostname: 'floating-chat.govisit.ai'};
      alone.componentDidMount();
      await settle();
      assert.equal(
        quietly(() => alone.render()),
        null
      );
      assert.equal(calls.length, 0);
      alone.componentWillUnmount();
      // Framed by a page, it is drawn.
      const framed = widget({agentCard: CARD_URL});
      global.window.parent = {};
      global.window.location = {hostname: 'floating-chat.govisit.ai'};
      framed.componentDidMount();
      await settle();
      assert.notEqual(
        quietly(() => framed.render()),
        null
      );
      framed.componentWillUnmount();
      // On this computer it is drawn by itself too.
      const local = widget({agentCard: CARD_URL});
      global.window.parent = global.window;
      global.window.location = {hostname: 'localhost'};
      local.componentDidMount();
      await settle();
      assert.notEqual(
        quietly(() => local.render()),
        null
      );
      local.componentWillUnmount();
    }
  );
});

test('a card that answers after the chat stops waiting is still taken', async () => {
  let answer;
  const late = new Promise((resolve) => (answer = resolve));
  const waits = [];
  const setTimeoutBefore = global.setTimeout;
  global.setTimeout = (run, ms) => {
    if (ms === CARD_LOAD_TIMEOUT_MS) {
      waits.push(run);
      return 0;
    }
    return setTimeoutBefore(run, ms);
  };
  try {
    await withFetch(
      () => late,
      async () => {
        const wrapper = widget({agentCard: CARD_URL});
        wrapper.componentDidMount();
        assert.equal(handed(wrapper).isAppearancePending, true);
        // The chat stops waiting: it is drawn, with nowhere to send yet.
        waits.forEach((run) => run());
        assert.equal(handed(wrapper).isAppearancePending, false);
        assert.equal(handed(wrapper).agent.endpoint, null);
        // The card answers.
        answer({ok: true, json: async () => card()});
        await settle();
        assert.equal(
          handed(wrapper).agent.endpoint,
          'https://agent.example/a2a'
        );
        assert.equal(handed(wrapper).appearance.header.title, 'Concierge');
        wrapper.componentWillUnmount();
      }
    );
  } finally {
    global.setTimeout = setTimeoutBefore;
  }
});

test('a card’s chat offers the card’s questions, three by default; a profile decides', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async () => {
      const wrapper = widget({agentCard: CARD_URL});
      wrapper.componentDidMount();
      await settle();
      assert.deepEqual(handed(wrapper).suggestions, [
        'When is breakfast?',
        'Is there parking?',
        'What is near?',
      ]);
      // A profile without them has none, and one with them says how many.
      wrapper.handleConfigUpdate({
        appearance: {
          elements: [{name: 'root', component: 'FloatingChat', values: {}}],
        },
      });
      assert.deepEqual(handed(wrapper).suggestions, []);
      wrapper.handleConfigUpdate({
        appearance: {
          elements: [
            {
              name: 'root',
              component: 'FloatingChat',
              values: {suggestions: 's'},
            },
            {name: 's', component: 'Suggestions', values: {limit: 1}},
          ],
        },
      });
      assert.deepEqual(handed(wrapper).suggestions, ['When is breakfast?']);
      wrapper.componentWillUnmount();
    }
  );
});

test('a card that cannot be read leaves the chat drawn, with nothing to send to', async () => {
  await withFetch(
    async () => ({ok: false, json: async () => card()}),
    async () => {
      const wrapper = widget({agentCard: CARD_URL});
      wrapper.componentDidMount();
      await settle();
      const props = handed(wrapper);
      assert.equal(props.agent.endpoint, null);
      assert.equal(props.isAppearancePending, false);
      assert.equal(props.appearance.header.title, 'Welcome!');
      assert.deepEqual(props.suggestions, []);
      wrapper.componentWillUnmount();
    }
  );
});

test('a card’s contact form is offered when the page takes it', async () => {
  await withFetch(
    async () => ({ok: true, json: async () => card()}),
    async () => {
      for (const [contactHandler, offered] of [
        ['1', true],
        [undefined, false],
      ]) {
        const wrapper = widget({
          agentCard: CARD_URL,
          contactHandler,
          shouldShowContactForm: 'true',
        });
        wrapper.componentDidMount();
        await settle();
        assert.equal(
          handed(wrapper).appearance.contact.form.isOffered,
          offered
        );
        assert.equal(handed(wrapper).hasContactHandler, offered);
        wrapper.componentWillUnmount();
      }
    }
  );
});

test('a card the page does not give as a web address is not taken, and another card starts afresh', async () => {
  await withFetch(
    async (url) => ({
      ok: true,
      json: async () => ({
        ...card(),
        name: url.includes('other') ? 'Other' : 'Concierge',
      }),
    }),
    async () => {
      const wrapper = widget({agentCard: CARD_URL});
      wrapper.parentOrigin = 'https://hotel.example';
      wrapper.componentDidMount();
      await settle();
      for (const agentCard of [
        'javascript:alert(1)',
        'http://agent.example/card.json',
        42,
      ]) {
        wrapper.handleConfigUpdate({agentCard, title: 'Changed'});
        assert.equal(wrapper.state.config.agentCard, CARD_URL);
        assert.equal(wrapper.state.config.title, undefined);
      }
      const other = 'https://other.example/.well-known/agent-card.json';
      const before = wrapper.state;
      wrapper.handleConfigUpdate({agentCard: other});
      assert.equal(wrapper.state.assistantRemount, true);
      // Until the other card is read, nothing of the first is left.
      assert.equal(handed(wrapper).agent.endpoint, null);
      assert.equal(handed(wrapper).appearance.header.title, 'Welcome!');
      wrapper.componentDidUpdate(wrapper.props, before);
      await settle();
      assert.equal(handed(wrapper).appearance.header.title, 'Other');
      assert.equal(
        quietly(() => wrapper.render()).props.children.key,
        'card:' + other
      );
      wrapper.componentWillUnmount();
    }
  );
});

test('an inHotel chat reads its card only when its look offers the card’s questions', async () => {
  const id = 'f1a4e101-533a-8355-80f0-f448ed950b76';
  const inhotelCard = `https://${id}.agents.inhotel.io/.well-known/agent-card.json`;
  const profiles = (withSuggestions) => ({
    items: [
      {
        ui: 'floating_chat',
        code: 'default',
        is_default: true,
        elements: [
          {
            name: 'root',
            component: 'FloatingChat',
            values: withSuggestions ? {suggestions: 's'} : {},
          },
          {name: 's', component: 'Suggestions', values: {limit: 2}},
        ],
      },
    ],
  });
  for (const withSuggestions of [false, true]) {
    await withFetch(
      async (url) =>
        url === inhotelCard
          ? {ok: true, json: async () => card()}
          : {ok: true, json: async () => profiles(withSuggestions)},
      async (calls) => {
        const wrapper = widget({inbox: id});
        wrapper.componentDidMount();
        await settle();
        wrapper.componentDidUpdate(wrapper.props, wrapper.state);
        await settle();
        const cardReads = calls.filter((call) => call.url === inhotelCard)
          .length;
        assert.equal(cardReads, withSuggestions ? 1 : 0);
        assert.deepEqual(
          handed(wrapper).suggestions,
          withSuggestions ? ['When is breakfast?', 'Is there parking?'] : []
        );
        // It is still an inHotel chat: its agent is reached by its ID.
        assert.equal(handed(wrapper).inboxId, id);
        assert.equal(handed(wrapper).agent, undefined);
        wrapper.componentWillUnmount();
      }
    );
  }
});

// The launcher, `public/widget.js`: a committed bundle, so its parts are
// taken out of the served file itself.
const launcher = fs.readFileSync(
  path.join(__dirname, '../public/widget.js'),
  'utf8'
);
const launcherLines = launcher.split('\n');
const lineOf = (pattern) => {
  const index = launcherLines.findIndex((line) => pattern.test(line));
  if (index < 0) throw new Error('Launcher code not found: ' + pattern);
  return index;
};
const piece = (from, to, last = 0) =>
  launcherLines.slice(lineOf(from), lineOf(to) + last).join('\n');
const bootstrap = launcher.slice(
  launcher.indexOf('    var ye = function () {},'),
  launcher.indexOf('    var sr = document.createElement')
);
// What the launcher's bootstrap takes from the page.
const embedded = ({attribute, config} = {}) =>
  vm.runInNewContext(
    bootstrap + '\n({profile: DD, card: anyCard, config: ga});',
    {
      window: {FloatingChatWindow: {config}},
      document: {
        currentScript: {
          getAttribute: (name) =>
            name === 'data-agent-card-url' ? attribute : null,
        },
      },
      URL,
      ACCOUNT_ID: -1,
    }
  );

test('the launcher takes any agent card, and an inHotel card as before', () => {
  const id = 'f1a4e101-533a-8355-80f0-f448ed950b76';
  const inhotel = `https://${id}.agents.inhotel.io/.well-known/agent-card.json`;
  assert.deepEqual(
    JSON.parse(JSON.stringify(embedded({attribute: inhotel}))).profile,
    id
  );
  assert.equal(embedded({attribute: inhotel}).card, '');
  for (const address of [
    CARD_URL,
    'https://agent.example/cards/concierge.json',
    'http://localhost:3300/.well-known/agent-card.json',
    // Not the exact inHotel address: an agent like any other.
    inhotel + '?x=1',
  ]) {
    const read = embedded({config: {agent_card_url: address}});
    assert.equal(read.profile, '', address);
    assert.equal(read.card, new URL(address).href, address);
  }
  for (const address of [
    'http://agent.example/.well-known/agent-card.json',
    'https://user:secret@agent.example/card.json',
    'javascript:alert(1)',
    'not an address',
  ]) {
    assert.throws(
      () => embedded({attribute: address, config: {agent_card_url: CARD_URL}}),
      /must be the https address of an A2A agent card/,
      address
    );
  }
  assert.throws(() => embedded(), /Set data-agent-card-url/);
});

// The launcher's settings read, with the bundle's async helpers and `cd`.
const settingsRead = () =>
  piece(/^    var Nq =$/, /cd\.updateWidgetSettingsMetadata = Qq;/, 1);
const launcherWorld = ({legacy, answers, queries = [], reads = []}) => ({
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
  fetch: async (url, options) => {
    reads.push({url, options});
    const answer = answers[url];
    return answer ? {ok: true, json: async () => answer} : {ok: false};
  },
  AbortController,
  setTimeout,
  clearTimeout,
});
const readSettings = async (world, query) => {
  const context = launcherWorld(world);
  vm.runInNewContext(settingsRead() + '\n;this.Pq = Pq;', context);
  return JSON.parse(JSON.stringify(await context.Pq(query)));
};

test('for any agent the launcher reads nothing of inHotel’s, and takes its look from the card', async () => {
  const look = [
    {
      name: 'root',
      component: 'FloatingChat',
      values: {accent_color: '#0B6E4F', screen_side: 'left', launcher: 'b'},
    },
    {
      name: 'b',
      component: 'Launcher',
      values: {icon: 'filled', has_greeting_preview: true},
    },
  ];
  const queries = [];
  const reads = [];
  assert.deepEqual(
    await readSettings(
      {
        legacy: {title: 'Legacy'},
        answers: {[CARD_URL]: LOOK_EXTENSION(look)},
        queries,
        reads,
      },
      {account_id: -1, inbox_id: '', agent_card: CARD_URL}
    ),
    {
      color: '#0B6E4F',
      position: 'left',
      launcher: {icon: 'filled', preview: true},
    }
  );
  assert.deepEqual(queries, []);
  assert.deepEqual(
    reads.map((read) => read.url),
    [CARD_URL]
  );
  assert.equal(reads[0].options.credentials, 'omit');

  // A card that publishes no look gives the launcher nothing.
  assert.deepEqual(
    await readSettings(
      {legacy: null, answers: {[CARD_URL]: card()}},
      {account_id: -1, inbox_id: '', agent_card: CARD_URL}
    ),
    {}
  );
  // The page's own look stands in front of the card's, and the card is not
  // read for it.
  const own = [
    {
      name: 'root',
      component: 'FloatingChat',
      values: {accent_color: '#123456'},
    },
  ];
  const ownReads = [];
  assert.deepEqual(
    await readSettings(
      {
        legacy: null,
        answers: {[CARD_URL]: LOOK_EXTENSION(look)},
        reads: ownReads,
      },
      {
        account_id: -1,
        inbox_id: '',
        agent_card: CARD_URL,
        appearance: {elements: own},
      }
    ),
    {color: '#123456', launcher: false}
  );
  assert.equal(ownReads.length, 0);
});

test('the page takes the contact form when it gives a handler, and its answer goes back to the chat', async () => {
  const answered = async (
    handler,
    given = {
      firstName: 'Ada',
      lastName: '',
      email: 'ada@guest.example',
      message: 'Hello',
      ts: '123',
      extra: {nested: true},
    }
  ) => {
    const sent = [];
    const fields = [];
    const bridge = {
      props: {
        onContactFormSubmit:
          handler &&
          ((given) => {
            fields.push(given);
            return handler(given);
          }),
      },
      send: (...args) => sent.push(args),
    };
    bundledLauncherHandler('handleContactSubmit', bridge, {Promise})(given);
    await settle();
    return {
      sent: JSON.parse(JSON.stringify(sent)),
      fields: JSON.parse(JSON.stringify(fields)),
    };
  };
  const taken = await answered(async () => undefined);
  assert.deepEqual(taken.fields, [
    {
      firstName: 'Ada',
      lastName: '',
      email: 'ada@guest.example',
      message: 'Hello',
    },
  ]);
  assert.deepEqual(taken.sent, [['contact:result', {ok: true}]]);
  // The page is handed text, whatever the frame sent.
  const odd = await answered(async () => undefined, {
    firstName: ['Ada'],
    lastName: {toString: () => 'x'},
    email: 42,
    message: null,
  });
  assert.deepEqual(odd.fields, [
    {firstName: '', lastName: '', email: '', message: ''},
  ]);
  assert.deepEqual(
    (await answered(() => ({ok: false, message: 'Full'}))).sent,
    [['contact:result', {ok: false, message: 'Full'}]]
  );
  for (const failing of [
    () => {
      throw new Error('broken');
    },
    async () => {
      throw new Error('rejected');
    },
    null,
  ]) {
    assert.deepEqual((await answered(failing)).sent, [
      ['contact:result', {ok: false}],
    ]);
  }

  // The launcher hands the chat's form to that step, and only from its frame.
  const iframeWindow = {};
  const submitted = [];
  const handler = bundledLauncherHandler('postMessageHandlers', {
    iframeRef: {contentWindow: iframeWindow},
    getIframeUrl: () => 'https://chat.example/',
    logger: {debug() {}, warn() {}},
    hasValidPayloadIdentity: () => true,
    handleContactSubmit: (payload) => submitted.push(payload),
  });
  const data = {event: 'contact:submit', payload: {email: 'ada@guest.example'}};
  handler({source: {}, origin: 'https://chat.example', data});
  handler({source: iframeWindow, origin: 'https://attacker.example', data});
  assert.equal(submitted.length, 0);
  handler({source: iframeWindow, origin: 'https://chat.example', data});
  assert.deepEqual(submitted, [{email: 'ada@guest.example'}]);
});

test('the launcher wires any agent’s card into its settings and the iframe configuration', () => {
  for (const wiring of [
    /agentCard: anyCard,/,
    /onContactFormSubmit: ga\.onContactFormSubmit,/,
    /agent_card: e\.agentCard,/,
    /T\.agentCard = this\.props\.agentCard \|\| void 0/,
    /T\.contactHandler =\s*'function' == typeof this\.props\.onContactFormSubmit \? 1 : void 0/,
    /case 'contact:submit':\s*return n\.handleContactSubmit\(s\);/,
  ]) {
    assert.match(launcher, wiring);
  }
});

// The local echo agent, as anyone runs it with no backend.
const {createEchoAgent} = require('../dev/echo-agent.cjs');
const httpFetch = require('./support/http-fetch.cjs');
async function withEchoAgent(options, run) {
  const server = createEchoAgent({delayMs: 0, ...options});
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  global.fetch = httpFetch;
  try {
    return await run(base);
  } finally {
    delete global.fetch;
    await new Promise((done) => server.close(done));
  }
}
const talk = (endpoint, message, options, request = {}) =>
  new Promise((done) =>
    streamMessage(
      endpoint,
      {message, assistant_id: '', ...request},
      () => {},
      (text, contextId) => done({text, contextId}),
      (error) => done({error: error.message}),
      undefined,
      options
    )
  );

test('the chat’s own client talks to a real A2A agent: the local echo agent', async () => {
  await withEchoAgent({}, async (base) => {
    const read = await readAgentCard(`${base}/.well-known/agent-card.json`);
    assert.equal(read.endpoint, `${base}/`);
    assert.equal(read.name, 'Echo agent');
    assert.equal(read.streaming, true);
    assert.deepEqual(read.examples, [
      'Hello!',
      'What can you do?',
      'Is there parking at the hotel?',
    ]);
    assert.equal(read.appearance, null);

    const first = await talk(read.endpoint, 'Is there parking?', {
      dialect: 'a2a',
      streaming: true,
    });
    assert.equal(first.text, 'You said: Is there parking?');
    assert.equal(typeof first.contextId, 'string');
    // The context the agent gave is kept by the next message.
    const second = await talk(
      read.endpoint,
      'And a pool?',
      {dialect: 'a2a', streaming: true},
      {context_id: first.contextId}
    );
    assert.deepEqual(second, {
      text: 'You said: And a pool?',
      contextId: first.contextId,
    });
  });
  // An agent that does not stream answers once.
  await withEchoAgent({streaming: false}, async (base) => {
    const read = await readAgentCard(`${base}/.well-known/agent-card.json`);
    assert.equal(read.streaming, false);
    const once = await talk(read.endpoint, 'Hello', {
      dialect: 'a2a',
      streaming: false,
    });
    assert.equal(once.text, 'You said: Hello');
  });
});

test('the echo agent can publish the look of its chat in its card', async () => {
  const look = {
    elements: [
      {name: 'root', component: 'FloatingChat', values: {header: 'h'}},
      {name: 'h', component: 'Header', values: {titles: 'Echo'}},
    ],
  };
  await withEchoAgent({appearance: look}, async (base) => {
    const read = await readAgentCard(`${base}/.well-known/agent-card.json`);
    assert.deepEqual(read.appearance, look);
  });
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
  console.log(`${tests.length - failed}/${tests.length} agent checks passed`);
  if (failed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
