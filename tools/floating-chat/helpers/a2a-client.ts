/**
 * A2A Service Client
 * JSON-RPC 2.0 over SSE for real-time chat streaming
 *
 * Two dialects. `a2a` is the A2A 0.3 JSON-RPC any agent speaks: one message,
 * its context, nothing else. `inhotel` is what an inHotel agent takes: the
 * conversation so far in the message, and inHotel's own metadata.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  assistant_id: string; // inbox_id
  session_id?: string;
  context_id?: string; // A2A contextId for session continuity
  history?: ChatMessage[];
}

export type Dialect = 'inhotel' | 'a2a';
export type SendOptions = {
  dialect?: Dialect;
  // Whether the agent streams its replies. An `a2a` agent that does not is
  // asked with `message/send` and answers once.
  streaming?: boolean;
  // How long, in milliseconds, an `a2a` agent may stay silent before its
  // reply is given up as an error. `SILENCE_MS` unless given.
  silenceMs?: number;
};

const newId = (prefix: string) =>
  typeof crypto !== 'undefined' &&
  typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// A plain A2A 0.3 message: what any agent takes.
function buildA2aPayload(request: ChatRequest, streaming: boolean): object {
  return {
    jsonrpc: '2.0',
    id: String(Date.now()),
    method: streaming ? 'message/stream' : 'message/send',
    params: {
      message: {
        kind: 'message',
        messageId: newId('msg'),
        role: 'user',
        parts: [{kind: 'text', text: request.message}],
        ...(request.context_id ? {contextId: request.context_id} : {}),
      },
    },
  };
}

/**
 * Build JSON-RPC 2.0 payload matching FlowiseAgentExecutor expectations
 */
function buildJsonRpcPayload(
  request: ChatRequest,
  options: SendOptions = {}
): object {
  if (options.dialect === 'a2a')
    return buildA2aPayload(request, options.streaming !== false);

  const messageId =
    typeof crypto !== 'undefined' &&
    typeof (crypto as any).randomUUID === 'function'
      ? (crypto as any).randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const rpcId = String(Date.now());

  // Convert history to A2A format
  const sessionHistory = (request.history || []).map((m, idx) => ({
    messageId:
      typeof crypto !== 'undefined' &&
      typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `h-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
    role: m.role === 'assistant' ? 'agent' : 'user',
    parts: [{kind: 'text', text: m.content}],
  }));

  return {
    jsonrpc: '2.0',
    id: rpcId,
    method: 'message/stream',
    params: {
      stream: true,
      message: {
        messageId,
        contextId: request.context_id, // Include contextId in message object
        role: 'user',
        parts: [{kind: 'text', text: request.message}],
        history: sessionHistory,
      },
      metadata: {
        sourceChannel: 'web.embed',
        sourceTrigger: 'chat_window',
        sessionId: request.session_id,
        flowProfile: 'papercups',
      },
    },
  };
}

/**
 * Check if text is a system message that should be filtered out
 */
function isSystemMessage(text: string): boolean {
  const systemPhrases = [
    'running the flow',
    'processing',
    'thinking',
    'loading',
    'starting',
    'initializing',
  ];
  const lower = text.toLowerCase();
  return systemPhrases.some((p) => lower.includes(p));
}

/**
 * Extract text from A2A response parts
 */
function extractTextFromParts(parts: any[]): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => p?.text || p?.content || '')
    .filter(Boolean)
    .join('');
}

/**
 * Extract assistant text from various JSON-RPC response formats
 */
function extractAssistantText(data: any): string {
  try {
    const kind = data?.result?.kind || data?.kind;

    // A message as the whole answer
    if (kind === 'message') {
      const txt = extractTextFromParts(data?.result?.parts || data?.parts);
      if (txt) return txt;
    }

    // Status update with message parts
    if (kind === 'status-update') {
      const msg = data?.result?.status?.message;
      const txt = extractTextFromParts(msg?.parts);
      if (txt) return txt;
    }

    // Artifact update (usually final response)
    if (kind === 'artifact-update') {
      const arts = data?.result?.artifact?.parts || data?.artifact?.parts || [];
      const txt = extractTextFromParts(arts);
      if (txt) return txt;
    }

    // Direct response text
    const t1 = data?.result?.response?.text;
    if (typeof t1 === 'string' && t1.trim()) return t1;

    // Response with message parts
    const parts2 = data?.result?.response?.message?.parts;
    if (Array.isArray(parts2)) {
      const txt = extractTextFromParts(parts2).trim();
      if (txt) return txt;
    }

    // Artifacts array
    const artsRes = Array.isArray(data?.result?.artifacts)
      ? data.result.artifacts
      : [];
    const resArt =
      artsRes.find((a: any) => (a?.name || '').toLowerCase() === 'result') ||
      artsRes[artsRes.length - 1];
    if (resArt && Array.isArray(resArt.parts)) {
      const txt = extractTextFromParts(resArt.parts).trim();
      if (txt) return txt;
    }

    // A task with its reply in its status
    const statusParts = data?.result?.status?.message?.parts;
    if (kind === 'task' && Array.isArray(statusParts)) {
      const txt = extractTextFromParts(statusParts).trim();
      if (txt) return txt;
    }

    // History-based response
    const hist = Array.isArray(data?.result?.history)
      ? data.result.history
      : [];
    if (hist.length) {
      const txt = hist
        .filter((m: any) => m?.role === 'agent' || m?.role === 'assistant')
        .flatMap((m: any) => (Array.isArray(m?.parts) ? m.parts : []))
        .map((p: any) => p?.text || p?.content || '')
        .filter(Boolean)
        .join('')
        .trim();
      if (txt) return txt;
    }

    // Raw string
    if (typeof data === 'string' && data.trim()) return data;
  } catch {
    // Fall through
  }
  return '';
}

// The error a JSON-RPC answer carries, if it carries one.
function errorOf(data: any): Error | null {
  if (!data || typeof data !== 'object' || !data.error) return null;
  const message =
    typeof data.error.message === 'string' && data.error.message
      ? data.error.message
      : 'The agent answered with an error';
  return new Error(message);
}

export type StreamCallback = (text: string) => void;
export type CompleteCallback = (fullText: string, contextId?: string) => void;
export type ErrorCallback = (error: Error) => void;

// How long a plain A2A agent may stay silent before its reply is given up.
export const SILENCE_MS = 120000;

// The reply a stream builds up, event by event. `take` reads one event and
// says whether the stream has ended with it.
type Reply = {take: (json: any) => boolean; text: () => string};

// What an inHotel agent streams, read as it always was: its words as it
// works, then the whole reply as an artifact.
function inhotelReply(onToken: StreamCallback): Reply {
  let accumulated = '';
  return {
    take(json) {
      const kind = json?.result?.kind || json?.kind || '';
      if (kind === 'task' && json?.result?.status?.state === 'submitted')
        return false;
      if (kind === 'status-update') {
        const state = json?.result?.status?.state;
        // The last update repeats, or is, the whole reply: it is taken only
        // when nothing came before it.
        if (state === 'completed' && !accumulated) {
          const text = extractAssistantText(json);
          if (text) {
            accumulated = text;
            onToken(text);
          }
          return false;
        }
        if (state === 'completed' || state === 'submitted') return false;
        const text = extractAssistantText(json);
        if (text && !isSystemMessage(text)) {
          accumulated += text;
          onToken(text);
        }
        return false;
      }
      if (kind === 'artifact-update') {
        // The whole reply.
        const text = extractAssistantText(json);
        if (text) {
          accumulated = text;
          onToken(text);
        }
        return false;
      }
      const text = extractAssistantText(json);
      if (text) {
        accumulated += text;
        onToken(text);
      }
      return false;
    },
    text: () => accumulated,
  };
}

// A task's states in which the agent has had its last word, for now.
const LAST_WORD_STATES = [
  'completed',
  'input-required',
  'auth-required',
  'failed',
  'rejected',
  'canceled',
];

// What any A2A agent streams. Its answer is its artifacts, else its last word
// (the message of its final state), else what it said as it worked.
function a2aReply(onToken: StreamCallback): Reply {
  let progress = '';
  let lastWord = '';
  const artifactIds: string[] = [];
  const artifacts: string[] = [];
  const addArtifact = (artifact: any, append: boolean) => {
    const text = extractTextFromParts(artifact?.parts);
    const id = String(
      artifact && artifact.artifactId != null ? artifact.artifactId : ''
    );
    let at = artifactIds.indexOf(id);
    if (at < 0) {
      artifactIds.push(id);
      artifacts.push('');
      at = artifacts.length - 1;
    }
    artifacts[at] = append ? artifacts[at] + text : text;
    if (text) onToken(text);
  };
  return {
    take(json) {
      const result = json?.result || {};
      const kind = result.kind || json?.kind || '';
      if (kind === 'artifact-update') {
        addArtifact(result.artifact, result.append === true);
        return false;
      }
      if (kind === 'message') {
        // A message is the whole answer, and the stream's end.
        lastWord = extractTextFromParts(result.parts) || lastWord;
        return true;
      }
      if (kind === 'status-update' || kind === 'task') {
        const state = result.status?.state;
        const text = extractTextFromParts(result.status?.message?.parts);
        if (LAST_WORD_STATES.includes(state)) {
          if (text) lastWord = text;
        } else if (state !== 'submitted' && text) {
          progress += text;
          onToken(text);
        }
        if (kind === 'task' && Array.isArray(result.artifacts))
          result.artifacts.forEach((artifact: any) =>
            addArtifact(artifact, false)
          );
        return kind === 'status-update' && result.final === true;
      }
      const text = extractAssistantText(json);
      if (text) {
        progress += text;
        onToken(text);
      }
      return false;
    },
    text: () => artifacts.filter(Boolean).join('\n\n') || lastWord || progress,
  };
}

/**
 * Stream a message to the A2A endpoint using SSE
 */
export async function streamMessage(
  baseUrl: string,
  request: ChatRequest,
  onToken: StreamCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback,
  signal?: AbortSignal,
  options: SendOptions = {}
): Promise<void> {
  const payload = buildJsonRpcPayload(request, options);
  const isA2a = options.dialect === 'a2a';
  const isStreaming = !isA2a || options.streaming !== false;

  // A plain A2A agent that stays silent too long has stopped answering: its
  // request is ended, as it is when the caller ends it.
  const silenceMs = isA2a ? options.silenceMs || SILENCE_MS : 0;
  const control = new AbortController();
  const stop = () => control.abort();
  if (signal) {
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop);
  }
  function watched<T>(step: Promise<T>): Promise<T> {
    if (silenceMs <= 0) return step;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        stop();
        reject(new Error('The agent stopped answering'));
      }, silenceMs);
      step.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  try {
    const response = await watched(
      fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: isStreaming ? 'text/event-stream' : 'application/json',
          // inHotel's agents have always been asked so. Any other agent is
          // asked with no header its CORS must allow beyond `Content-Type`.
          ...(isA2a ? {} : {'Cache-Control': 'no-cache'}),
        },
        body: JSON.stringify(payload),
        mode: 'cors',
        credentials: 'omit',
        signal: control.signal,
      })
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    // Check if we got SSE or regular JSON
    const contentType = (
      response.headers.get('content-type') || ''
    ).toLowerCase();
    if (!contentType.includes('text/event-stream')) {
      // Non-streaming response (fallback)
      const text = await watched(response.text());
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = {result: {response: {text: text}}};
      }
      const error = errorOf(json);
      if (error) throw error;
      const result = extractAssistantText(json);
      if (isA2a && !result) throw new Error('The agent gave no answer');
      onToken(result);
      onComplete(result, json?.result?.contextId || undefined);
      return;
    }

    // Handle SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let extractedContextId: string | undefined;
    const reply = isA2a ? a2aReply(onToken) : inhotelReply(onToken);
    let hasEnded = false;

    while (!hasEnded) {
      const {value, done} = await watched(reader.read());
      if (done) break;

      buffer += decoder.decode(value, {stream: true});

      // Parse SSE events (separated by double newlines)
      let idx;
      while (!hasEnded && (idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const sepLen = /\r\n\r\n/.test(buffer.slice(idx, idx + 4)) ? 4 : 2;
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sepLen);

        // Extract data lines
        const lines = chunk.split(/\r?\n/);
        const dataLines = lines
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim());

        if (!dataLines.length) continue;

        const dataStr = dataLines.join('\n');
        if (!dataStr || dataStr === '[DONE]' || dataStr === '"[DONE]"')
          continue;

        let json;
        try {
          json = JSON.parse(dataStr);
        } catch {
          json = {result: {response: {text: dataStr}}};
        }
        const error = errorOf(json);
        if (error) throw error;

        // Extract contextId from response (present in all event types)
        if (json?.result?.contextId && !extractedContextId) {
          extractedContextId = json.result.contextId;
        }

        hasEnded = reply.take(json);
      }
    }
    // An agent may keep the stream open after its final event.
    if (hasEnded && typeof reader.cancel === 'function')
      reader.cancel().catch(() => {});

    const answer = reply.text();
    if (isA2a && !answer) throw new Error('The agent gave no answer');
    onComplete(answer, extractedContextId);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    if (signal) signal.removeEventListener('abort', stop);
  }
}

/**
 * Send a message without streaming (simple POST)
 */
export async function sendMessage(
  baseUrl: string,
  request: ChatRequest,
  options: SendOptions = {}
): Promise<string> {
  const payload = buildJsonRpcPayload(request, options);

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    mode: 'cors',
    credentials: 'omit',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const error = errorOf(data);
  if (error) throw error;
  return extractAssistantText(data);
}
