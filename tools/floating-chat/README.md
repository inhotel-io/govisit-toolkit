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

The launcher takes the agent's card URL, `agent_card_url`, and reads the
assistant profile ID from the card's host. The initial import's inHotel adapter
remains behind it: settings and contact forms use `backend.inhotel.io`, and the
profile ID resolves to `https://<profile-id>.agents.inhotel.io/`. Connecting
another A2A deployment currently requires adapting these URL/settings mappings
and allowing the chat origin in that service's CORS policy. There is no arbitrary
agent URL setting yet: the launcher rejects cards hosted anywhere else.

The welcome message and assistant replies use the public agent card's `iconUrl`
from `/.well-known/agent-card.json`. The text appears immediately while a fixed
32px avatar slot stays blank until the image is ready. Missing or unusable icons
use the built-in SVG fallback; card and image loading each have a three-second
timeout before showing the fallback. No guest message is required to load it.

## Development

Run the following from this directory, using Node.js **16.20.2** and npm
**8.19.4**, the versions pinned for this imported application:

```sh
nvm install
nvm use
npm ci --ignore-scripts
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the embed code and a live
launcher, chatting with the example agent from the Focus Chat quick start. Add
`?agent_card_url=` with another inHotel agent card URL to chat with that agent
instead. To exercise the local iframe UI with an existing assistant, open
`http://localhost:3000/?token=-1&inbox=YOUR_ASSISTANT_PROFILE_ID&version=1.0.0`.
Add `&shouldShowContactForm=true` to that preview URL to show the envelope
control in the footer. Click it to open the contact form; opening or focusing the
form does not submit it. Form fields reserve their border space so focus and
validation do not move neighbouring fields.

The legacy `token=-1` value selects the UI; it is not an authentication credential.
Sending a message uses the remote agent service described above.

Missing or invalid theme colors fall back to GoVisit blue-600 (`#465EA4`) in
both the launcher and iframe. Valid customer colors take precedence.

## Embed on a website

Name the agent by its card, the same `agent_card_url` that `<focus-chat>` takes:

```html
<script>
  window.agent_card_url =
    'https://YOUR_ASSISTANT_PROFILE_ID.agents.inhotel.io/.well-known/agent-card.json';
</script>
<script async defer src="https://floating-chat.govisit.ai/widget.js"></script>
```

`agent_card_url` must be set before the script loads, either as that global or
as `window.InhotelChatWindow.config.agent_card_url`. It must be an inHotel agent
card URL of exactly that form.

Integrations installed with `window.ASSISTANT_INTERACTION_PROFILE_ID` and
`https://chat.inhotel.io/widget.js` keep working unchanged: chat.inhotel.io is a
separate deployment of the original chat window, which this tool does not change.

Presentation options can be supplied before loading the script:

```html
<script>
  window.InhotelChatWindow = {
    config: {
      title: 'Ask our team',
      subtitle: 'How can we help with your visit?',
      primaryColor: '#1890ff',
      position: 'right'
    }
  };
</script>
```

For a self-hosted deployment, replace the script URL with your own host. The
launcher opens its iframe from the host that served the script, so a local
`npm run dev` also loads the local iframe.

## Build and check

```sh
npm run build
npm test
npm start
```

`npm run build` compiles and type-checks the Next.js application. `npm test`
runs avatar/card lifecycle regression checks with mocked requests, then starts
the production server on a temporary local port and checks the launcher,
iframe pages, compiled JavaScript, and license files, then stops the server.
These checks do not contact a live agent or send guest messages.

The committed `public/widget.js` is a separate launcher bundle. The imported
project does not contain its original bundle source/build configuration, so
`npm run build` serves that file unchanged. Changes to `pages/`, `components/`,
and `helpers/` rebuild the iframe application; launcher changes must currently
be made to the committed bundle. Restoring a reproducible launcher build is a
maintenance follow-up.

## Source layout

| Path | Responsibility |
| --- | --- |
| `public/widget.js` | Host-page launcher and iframe bridge |
| `pages/index.tsx` | Iframe application entry point |
| `components/EmbedLanding.tsx` | Embed code and live launcher, shown when `/` is opened directly |
| `components/Widget.tsx` | Configuration and theme wrapper |
| `components/ChatWindow.tsx` | Chat UI and conversation behavior |
| `components/ChatMessage*.tsx` | Message rendering |
| `components/ChatFooter*.tsx` | Composer and contact controls |
| `helpers/a2a-client.ts` | A2A JSON-RPC/SSE communication |
| `helpers/storage.ts` | Browser conversation and context persistence |
| `styles/` | Global and emoji styling |
| `tests/` | Local production smoke checks |
| `k8s/` | Kubernetes deployment examples |
| `k8s/govisit/` | The GoVisit-hosted service's Kubernetes resources |

## Deploy

GoVisit runs this tool at `https://floating-chat.govisit.ai`, following
[the hosting decision](docs/hosting.md) for URL policy, managed TLS, caching,
rollback, and migration from `chat.inhotel.io`. Versioned release routes are not
implemented yet: the host serves the latest `main` at `/widget.js` and `/`.

The toolkit's [Floating Chat workflow](../../.github/workflows/floating-chat.yml)
builds, tests and builds the image for every pull request that touches this
directory. A push to `main` that touches it also deploys: the workflow pushes the
image tagged with the commit SHA, moves Deployment `govisit-floating-chat` onto
it, and checks that `https://floating-chat.govisit.ai/widget.js` is the commit's
launcher. If the new pods never become ready, it restores the previous image.
Run the workflow by hand on `main` to deploy again.

The deploy signs in to Google Cloud through Workload Identity Federation, so the
repository holds no key. Only this workflow, run on `main` by a push or by hand,
can obtain that identity, and in the cluster it may change only that Deployment.
[`k8s/govisit/`](k8s/govisit) holds the hosted service's resources. The workflow
changes only the image, so apply changes to the others by hand.

To run your own copy, build from this tool directory so its Docker context
contains its own files:

```sh
docker build -t floating-chat:local .
docker run --rm -p 3000:3000 floating-chat:local
```

The image includes the MIT license and third-party notices. The Kubernetes
examples in `k8s/` use `floating-chat` resource names and the current kubectl
namespace. Replace the image and `chat.example.com` hostname before using them.
Their ingress example assumes an NGINX ingress controller and a cert-manager
issuer named `letsencrypt-prod`; adapt it to your own cluster.

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
