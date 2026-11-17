// A `fetch` for tests on Node 16, which has none: enough of one for the
// chat's own client to talk to a local server over http.
const http = require('node:http');

module.exports = function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {method: options.method || 'GET', headers: options.headers || {}},
      (response) => {
        const chunks = [];
        const waiting = [];
        let ended = false;
        response.on('data', (chunk) => {
          const value = new Uint8Array(chunk);
          if (waiting.length) waiting.shift()({value, done: false});
          else chunks.push(value);
        });
        response.on('end', () => {
          ended = true;
          while (waiting.length) waiting.shift()({done: true});
        });
        const read = () =>
          chunks.length
            ? Promise.resolve({value: chunks.shift(), done: false})
            : ended
            ? Promise.resolve({done: true})
            : new Promise((done) => waiting.push(done));
        const all = async () => {
          const parts = [];
          for (;;) {
            const {value, done} = await read();
            if (done) break;
            parts.push(Buffer.from(value));
          }
          return Buffer.concat(parts).toString('utf8');
        };
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          url,
          headers: {
            get: (name) => response.headers[name.toLowerCase()] || null,
          },
          body: {getReader: () => ({read})},
          text: all,
          json: async () => JSON.parse(await all()),
        });
      }
    );
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
};
