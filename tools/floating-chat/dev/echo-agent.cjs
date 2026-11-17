#!/usr/bin/env node
// A small A2A agent for trying the floating chat with no backend at all.
//
// It serves its agent card and answers every message by repeating it, word
// by word. Start it, then give the chat its card:
//
//   npm run agent:echo
//   npm run dev
//   open http://localhost:3000/?agent_card_url=http://localhost:3300/.well-known/agent-card.json
//
// Set as environment variables:
//   PORT        the port, 3300 unless given
//   NO_STREAM   set to answer at once instead of streaming
//   APPEARANCE  a JSON file holding a profile, {"elements": [...]}, that the
//               card publishes as the look of its chat
//
// It speaks A2A 0.3 over JSON-RPC: `message/send`, and `message/stream` with
// Server-Sent Events. It answers any origin.
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');

const APPEARANCE_EXTENSION =
  'https://floating-chat.govisit.ai/extensions/appearance/v1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // All the chat sends beyond what CORS lets through without asking.
  'Access-Control-Allow-Headers': 'content-type',
};

// The card, with addresses on the host the request came to.
function cardFor(host, {streaming, appearance}) {
  const base = `http://${host}`;
  return {
    protocolVersion: '0.3.0',
    name: 'Echo agent',
    description: 'Repeats what you write. For trying the chat locally.',
    url: `${base}/`,
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: {
      streaming,
      ...(appearance
        ? {
            extensions: [
              {uri: APPEARANCE_EXTENSION, required: false, params: appearance},
            ],
          }
        : {}),
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      {
        id: 'echo',
        name: 'Echo',
        description: 'Repeats a message.',
        tags: ['test'],
        examples: [
          'Hello!',
          'What can you do?',
          'Is there parking at the hotel?',
        ],
      },
    ],
  };
}

const textOf = (message) =>
  (message && Array.isArray(message.parts) ? message.parts : [])
    .filter(
      (part) => part && part.kind === 'text' && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('');

const error = (id, code, message) => ({
  jsonrpc: '2.0',
  id: id === undefined ? null : id,
  error: {code, message},
});

function createEchoAgent({
  streaming = true,
  appearance = null,
  delayMs = 40,
} = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  return http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS);
      response.end();
      return;
    }
    if (
      request.method === 'GET' &&
      request.url === '/.well-known/agent-card.json'
    ) {
      response.writeHead(200, {...CORS, 'Content-Type': 'application/json'});
      response.end(
        JSON.stringify(cardFor(request.headers.host, {streaming, appearance}))
      );
      return;
    }
    if (request.method !== 'POST' || request.url !== '/') {
      response.writeHead(404, CORS);
      response.end();
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => (body += chunk));
    request.on('end', async () => {
      const json = (status, value) => {
        response.writeHead(status, {
          ...CORS,
          'Content-Type': 'application/json',
        });
        response.end(JSON.stringify(value));
      };
      let call;
      try {
        call = JSON.parse(body);
      } catch {
        json(200, error(null, -32700, 'Parse error'));
        return;
      }
      const message = call && call.params && call.params.message;
      if (!message || !Array.isArray(message.parts)) {
        json(200, error(call && call.id, -32602, 'Invalid params'));
        return;
      }
      const contextId =
        typeof message.contextId === 'string' && message.contextId
          ? message.contextId
          : crypto.randomUUID();
      const reply = `You said: ${textOf(message)}`;

      if (call.method === 'message/send') {
        json(200, {
          jsonrpc: '2.0',
          id: call.id,
          result: {
            kind: 'message',
            messageId: crypto.randomUUID(),
            role: 'agent',
            parts: [{kind: 'text', text: reply}],
            contextId,
          },
        });
        return;
      }
      if (call.method !== 'message/stream') {
        json(200, error(call.id, -32601, 'Method not found'));
        return;
      }

      // The reply streamed: the task, a status update for each word, and the
      // last update with nothing in it.
      response.writeHead(200, {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      const send = (result) =>
        response.write(
          `data: ${JSON.stringify({jsonrpc: '2.0', id: call.id, result})}\n\n`
        );
      const taskId = crypto.randomUUID();
      send({kind: 'task', id: taskId, contextId, status: {state: 'submitted'}});
      const words = reply.split(' ');
      for (let index = 0; index < words.length; index++) {
        await wait(delayMs);
        send({
          kind: 'status-update',
          taskId,
          contextId,
          final: false,
          status: {
            state: 'working',
            message: {
              kind: 'message',
              messageId: crypto.randomUUID(),
              role: 'agent',
              parts: [
                {
                  kind: 'text',
                  text: words[index] + (index < words.length - 1 ? ' ' : ''),
                },
              ],
            },
          },
        });
      }
      send({
        kind: 'status-update',
        taskId,
        contextId,
        final: true,
        status: {state: 'completed'},
      });
      response.end();
    });
  });
}

module.exports = {createEchoAgent, APPEARANCE_EXTENSION};

if (require.main === module) {
  const port = Number(process.env.PORT || 3300);
  const appearance = process.env.APPEARANCE
    ? JSON.parse(fs.readFileSync(process.env.APPEARANCE, 'utf8'))
    : null;
  createEchoAgent({streaming: !process.env.NO_STREAM, appearance}).listen(
    port,
    () => {
      console.log(
        `Echo agent: http://localhost:${port}/.well-known/agent-card.json`
      );
    }
  );
}
