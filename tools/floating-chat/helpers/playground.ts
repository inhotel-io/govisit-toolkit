// What the playground puts in front of the `fetch` of the chat it frames.
//
// The chat in the frame is the real one, so left alone it would talk to real
// services. From the playground nothing is sent: not a message to an agent,
// and not the contact form to its service. The read of the assistant's
// appearance profile is answered with the draft the playground holds, so the
// chat draws the draft as it draws a profile from the database.
import {DEFAULT_BASE_URL} from './config';

type Frame = {
  fetch: (input: any, init?: any) => Promise<any>;
  Response: any;
  URL: any;
  location: {href: string};
};

export const NOT_SENT = 'Not sent: appearance playground';

// The frame's `fetch` with the guard in front of it. `answer` gives what the
// profile read is answered with, for the address the chat asked.
export function guardedFetch(frame: Frame, answer: (url: string) => unknown) {
  const realFetch = frame.fetch.bind(frame);
  const reply = (status: number, body: unknown) =>
    Promise.resolve(
      new frame.Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
      })
    );

  return (input: any, init: any = {}) => {
    const url =
      typeof input === 'string' ? input : input && input.url ? input.url : '';
    const method = String(
      init.method || (input && input.method) || 'GET'
    ).toUpperCase();
    let host = '';
    try {
      host = new frame.URL(url, frame.location.href).host;
    } catch (e) {
      host = '';
    }

    // An agent is never reached, not even for its card.
    if (/\.agents\.inhotel\.io$/.test(host)) {
      return reply(503, {error: NOT_SENT});
    }
    // Nothing that would change something is sent anywhere. The answer is
    // the one the contact form's service gives a form it took.
    if (method !== 'GET') {
      return reply(200, {status: 1, message: NOT_SENT});
    }
    if (
      url.indexOf(`${DEFAULT_BASE_URL}/api/v2/assistants/`) === 0 &&
      url.indexOf('/appearance-profiles') > 0
    ) {
      return reply(200, answer(url));
    }
    return realFetch(input, init);
  };
}
