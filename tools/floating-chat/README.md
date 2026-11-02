# Floating Chat

Floating Chat is an embeddable floating chatbot optimized for travel and
hospitality websites and A2A-compatible agents. It gives guests a chat interface
that can sit above an existing website, with mobile layouts, configurable
presentation, conversation history, and hospitality contact forms.

This is a standalone tool in [GoVisit Toolkit](../../README.md). Its source code
is MIT-licensed, including the inherited Papercups code with its original notice
preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Current implementation

The host page loads `public/widget.js`, which creates the floating launcher and
opens an iframe. The iframe renders the Next.js chat application. The client
sends A2A `message/stream` requests using JSON-RPC and Server-Sent Events.

The initial import retains the inHotel adapter: settings and contact forms use
`backend.inhotel.io`, and an assistant profile ID resolves to
`https://<profile-id>.agents.inhotel.io/`. Connecting another A2A deployment
currently requires adapting these URL/settings mappings and allowing the chat
origin in that service's CORS policy. There is no arbitrary agent URL setting yet.

## Development

Run the following from this directory, using Node.js **16.20.2** and npm
**8.19.4**, the versions pinned for this imported application:

```sh
nvm install
nvm use
npm ci --ignore-scripts
npm run dev
```

Open [localhost:3000](http://localhost:3000). To exercise the local iframe UI
with an existing assistant, open
`http://localhost:3000/?token=-1&inbox=YOUR_ASSISTANT_PROFILE_ID&version=1.0.0`.
The legacy `token=-1` value selects the UI; it is not an authentication credential.
Sending a message uses the remote agent service described above.

## Embed on a website

An existing inHotel-hosted integration uses this contract:

```html
<script>
  window.ASSISTANT_INTERACTION_PROFILE_ID = 'YOUR_ASSISTANT_PROFILE_ID';
</script>
<script async defer src="https://chat.inhotel.io/widget.js"></script>
```

The profile ID must be defined before the script loads. The existing
`ASSISTANT_INTERACTION_PROFILE_ID` and `window.InhotelChatWindow` names are
preserved for compatibility with installed integrations.

Presentation options can be supplied before loading the script:

```html
<script>
  window.InhotelChatWindow = {
    config: {
      title: 'Ask our team',
      subtitle: 'How can we help with your visit?',
      primaryColor: '#1890ff',
      position: 'right',
    },
  };
</script>
```

For a self-hosted deployment, replace the script URL with your own host and
update the iframe origins in `public/widget.js` (`OD` and `xD`). For local
launcher development, both origins can point to `http://localhost:3000`.
Changing the script URL alone does not change its embedded iframe origin.

The launcher supplies its page origin to the iframe. Incoming bridge messages
are accepted only from that parent window and origin, and outgoing events target
that exact origin. Older loaders can use the iframe's `document.referrer` as a
fallback. With a referrer-suppressing policy, use the updated launcher so the
explicit origin is supplied; an iframe with no established parent origin ignores
bridge messages. Profile IDs must fit one DNS label (UUID profile IDs are
supported), and switching assistants creates a fresh chat component instead of
reusing the previous conversation state.

## Build and check

```sh
npm run build
npm test
npm start
```

`npm run build` compiles and type-checks the Next.js application. `npm test`
runs the security regressions, then starts the production server on a temporary local port, checks the launcher,
iframe pages, compiled JavaScript, and license files, then stops the server.
These checks do not contact a live agent or send guest messages.
Run `npm run test:security` for the rendering and iframe-boundary regressions
without requiring a production build.

The committed `public/widget.js` is a separate launcher bundle. The imported
project does not contain its original bundle source/build configuration, so
`npm run build` serves that file unchanged. Changes to `pages/`, `components/`,
and `helpers/` rebuild the iframe application; launcher changes must currently
be made to the committed bundle. Restoring a reproducible launcher build is a
maintenance follow-up.

## Source layout

| Path                          | Responsibility                                        |
| ----------------------------- | ----------------------------------------------------- |
| `public/widget.js`            | Host-page launcher and iframe bridge                  |
| `pages/index.tsx`             | Iframe application entry point                        |
| `components/Widget.tsx`       | Configuration and theme wrapper                       |
| `components/ChatWindow.tsx`   | Chat UI and conversation behavior                     |
| `components/ChatMessage*.tsx` | Message rendering                                     |
| `components/ChatFooter*.tsx`  | Composer and contact controls                         |
| `helpers/a2a-client.ts`       | A2A JSON-RPC/SSE communication                        |
| `helpers/storage.ts`          | Browser conversation and context persistence          |
| `helpers/embed-security.ts`   | Parent-message validation and fixed-origin agent URLs |
| `styles/`                     | Global and emoji styling                              |
| `tests/`                      | Local production smoke checks                         |
| `k8s/`                        | Kubernetes deployment examples                        |

## Deploy

The accepted GoVisit hosting decision is to serve the launcher and iframe app on
`floating-chat.govisit.ai`, with independently versioned releases. See
[the hosting decision](docs/hosting.md) for URL policy, managed TLS, caching,
rollback, and migration from `chat.inhotel.io`. This is the target deployment
design; the import does not provision that hostname or implement version routing.

Build from this tool directory so its Docker context contains its own files:

```sh
docker build -t floating-chat:local .
docker run --rm -p 3000:3000 floating-chat:local
```

The image includes the MIT license and third-party notices. The Kubernetes
examples use `floating-chat` resource names and the current kubectl namespace.
Replace the image and `chat.example.com` hostname before using them. Their ingress
example assumes an NGINX ingress controller and a cert-manager issuer named
`letsencrypt-prod`; adapt it to your own cluster.

The toolkit's Floating Chat workflow checks builds and local serving. Deploying
the hosted inHotel service remains a separate operational action.

## Maintenance status

This import preserves Next.js 9, React 16, and the pinned Node 16 toolchain.
They are legacy dependencies; a supported runtime and dependency upgrade should
precede new production deployments. The Node 22+ runtime used by the toolkit's
skills/release scripts is separate from this application.

Chat history is stored in the browser per assistant (up to 50 messages, with a
24-hour expiry checked when history is read); A2A context IDs use session storage.
Review these behaviors for your own guest data requirements.

## License

[MIT](LICENSE). Preserve the Papercups copyright and permission notice in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) when redistributing this code.
The code license does not grant access to hosted agent services or rights to
their returned data; see [the toolkit's service terms](../../SERVICE_TERMS.md)
for the GoVisit services.
