// Verify the built app locally without contacting any hosted agent service.
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {readFile} = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return port;
}

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {hostname: '127.0.0.1', port, path: pathname},
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('error', reject);
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          })
        );
      }
    );
    request.setTimeout(2000, () => request.destroy(new Error('HTTP timeout')));
    request.on('error', reject);
  });
}

async function main() {
  await require('./presentation.cjs')();
  const port = await unusedPort();
  const server = spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)],
    {
      cwd: root,
      env: {...process.env, NEXT_TELEMETRY_DISABLED: '1'},
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let logs = '';
  let launchError;
  server.on('error', (error) => (launchError = error));
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => (logs = (logs + chunk).slice(-32768)));
  }

  try {
    let launcher;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (server.exitCode !== null || server.signalCode !== null) {
        throw new Error('Production server exited before becoming ready');
      }
      launcher = await get(port, '/widget.js').catch(() => null);
      if (launcher && launcher.status === 200) break;
      await delay(200);
    }
    assert.equal(launcher?.status, 200, 'Launcher must be served');
    assert.match(launcher.headers['content-type'], /javascript/);
    assert.match(launcher.body, /ASSISTANT_INTERACTION_PROFILE_ID/);
    assert.match(launcher.body, /InhotelChatWidget/);

    const iframe = await get(port, '/?token=-1&inbox=smoke-test&version=1.0.0');
    assert.equal(iframe.status, 200, 'Iframe app must be served');
    assert.match(iframe.body, /id="__next"/);

    const chunks = [...iframe.body.matchAll(/<script[^>]+src="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((src) => src.startsWith('/_next/'));
    assert.ok(chunks.length > 0, 'Iframe must reference compiled scripts');
    for (const chunk of chunks) {
      const response = await get(port, chunk);
      assert.equal(response.status, 200, `Missing compiled script: ${chunk}`);
      assert.match(response.headers['content-type'], /javascript/);
    }

    const widgetPage = await get(port, '/widget');
    assert.equal(
      widgetPage.status,
      200,
      'Launcher preview page must be served'
    );
    assert.match(widgetPage.body, /src="\/widget.js"/);
    assert.match(
      await readFile(path.join(root, 'LICENSE'), 'utf8'),
      /MIT License/
    );
    assert.match(
      await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'),
      /Copyright \(c\) 2020 Papercups/
    );
    console.log(
      `Floating Chat smoke checks passed: launcher, iframe, ${chunks.length} compiled scripts, preview, and MIT notices.`
    );
  } catch (error) {
    error.message += `\nProduction server output:\n${logs}`;
    throw error;
  } finally {
    if (server.pid && server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      const forceKill = setTimeout(() => server.kill('SIGKILL'), 2000);
      try {
        await exited;
      } finally {
        clearTimeout(forceKill);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
