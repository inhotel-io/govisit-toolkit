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
launcher, chatting with the inHotel Solutions Specialist. Add
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

Set `data-agent-card-url` on the launcher script. This example opens the
inHotel Solutions Specialist.

```html
<script
  defer
  src="https://floating-chat.govisit.ai/widget.js"
  data-agent-card-url="https://b6739ac5-af3d-4cf0-a980-6ad34122f58d.agents.inhotel.io/.well-known/agent-card.json"
></script>
```

For additional configuration, set `window.FloatingChatWindow.config` before
loading the launcher. You can also supply the agent card in this configuration.

```html
<script>
  window.FloatingChatWindow = {
    config: {
      agent_card_url:
        'https://b6739ac5-af3d-4cf0-a980-6ad34122f58d.agents.inhotel.io/.well-known/agent-card.json',
      title: 'Ask our team',
      subtitle: 'How can we help with your visit?',
      primaryColor: '#465EA4',
      position: 'right',
    },
  };
</script>
<script defer src="https://floating-chat.govisit.ai/widget.js"></script>
```

The script's `data-agent-card-url` takes precedence over
`window.FloatingChatWindow.config.agent_card_url`. The selected value must be an
inHotel agent card URL in the form shown above.

For a self-hosted deployment, replace the script URL with your own host. The
launcher opens its iframe from the host that served the script, so a local
`npm run dev` also loads the local iframe.

The launcher supplies its page origin to the iframe. Incoming bridge messages
are accepted only from that parent window and origin, and outgoing events target
that exact origin. Older loaders can use the iframe's `document.referrer` as a
fallback. With a referrer-suppressing policy, use the updated launcher so the
explicit origin is supplied; an iframe with no established parent origin ignores
bridge messages. Profile IDs must fit one DNS label (UUID profile IDs are
supported), and switching assistants creates a fresh chat component instead of
reusing the previous conversation state.

## Appearance profiles

The chat is drawn from an appearance profile: a list of elements that says
which parts the chat has and what each part says. A part the profile leaves out
is not drawn. Without a profile the chat is drawn from the legacy widget
settings, as before.

### The library

What a profile can hold is this UI's library,
[`appearance-library.json`](appearance-library.json): every component, what it
takes, each type and each default. The chat reads a profile against that file,
the playground draws its controls from it, and `npm test` checks the table
below against it.

<!-- library:start -->
| Component | What it is | What a profile sets |
| --- | --- | --- |
| `FloatingChat` | The chat as a whole: the round button, the window and the list of messages. | `header`, `greeting`, `composer`, `accent_color`, `screen_side`, `contact`, `branding`, `messages`, `launcher` |
| `Launcher` | The round button the chat opens from. | `icon`, `has_greeting_preview` |
| `Header` | The bar at the top of the window, with a title and a line under it. | `titles`, `subtitles` |
| `Greeting` | The first message, shown before the guest writes. | `greetings` |
| `Messages` | How the list of messages looks. A group of values, not a part. | `assistant_bubble_color`, `guest_bubble_color`, `has_avatars`, `has_feedback`, `has_timestamps` |
| `Composer` | The field the guest writes in, with the send button. | `input_placeholders` |
| `Contact` | The line under the composer with the phone, the e-mail and the contact form. | `phone`, `email`, `form`, `copy_hints`, `copied_notes`, `copy_failed_notes` |
| `ContactForm` | The form a guest sends a message with, opened from the contact line. | `titles`, `first_name`, `last_name`, `email`, `message`, `send_labels`, `sending_labels`, `discard_labels`, `confirmations` |
| `FormField` | One field of the contact form. | `labels`, `is_required` |
| `Branding` | The "Powered by" line at the bottom. | `texts`, `name`, `link_url` |
<!-- library:end -->

A profile starts at the element named `root`, a `FloatingChat`. A prop that
takes a component is a slot: its value is the name of another element. The
contact form is a `ContactForm` in the `form` slot of the `Contact` line, and
each of its fields is a `FormField` in a slot of the form.

```json
{
  "elements": [
    {
      "name": "root",
      "component": "FloatingChat",
      "values": {
        "header": "header",
        "composer": "composer",
        "contact": "contact",
        "launcher": "launcher",
        "accent_color": "#0B6E4F"
      }
    },
    {
      "name": "header",
      "component": "Header",
      "values": {"titles": {"en": "Ask us", "cs": "Zeptejte se"}}
    },
    {"name": "composer", "component": "Composer", "values": {}},
    {"name": "contact", "component": "Contact", "values": {"form": "form"}},
    {
      "name": "form",
      "component": "ContactForm",
      "values": {"email": "email", "message": "message"}
    },
    {
      "name": "email",
      "component": "FormField",
      "values": {"labels": {"en": "Your e-mail", "cs": "Váš e-mail"}}
    },
    {"name": "message", "component": "FormField", "values": {}},
    {"name": "launcher", "component": "Launcher", "values": {"icon": "filled"}}
  ]
}
```

This chat has a header, a composer and a contact line whose form asks for an
e-mail and a message. It has no greeting and no branding line: the root names
none.

Each part the iframe draws carries its component's name as `data-component`.

### Where the profile comes from

- **The assistant's.** An assistant can carry profiles for this UI,
  `floating_chat`, in the inHotel v2 API. The launcher and the iframe both read
  `GET /api/v2/assistants/{assistant ID}/appearance-profiles?ui=floating_chat`,
  which answers any origin and fills in the library's defaults. The assistant's
  default profile is drawn. To draw another, name its code on the script,
  `data-appearance-profile="govisit"`, or as `appearance_profile` in
  `window.FloatingChatWindow.config`. That is also how a profile is tried on a
  page before it becomes the default.
- **The page's own.** A page can give a whole profile itself, as `appearance`
  in `window.FloatingChatWindow.config`, in the shape above. It is drawn in
  place of the assistant's, and nothing is read from the API. A text is one
  string for every language, or a map of languages as above. It decides every
  part, the branding line too: a page can reword the line or leave it out.

```html
<script>
  window.FloatingChatWindow = {
    config: {
      agent_card_url: 'https://ASSISTANT_ID.agents.inhotel.io/.well-known/agent-card.json',
      appearance: {elements: [/* as above */]},
    },
  };
</script>
<script defer src="https://floating-chat.govisit.ai/widget.js"></script>
```

### What else decides the look

- **Language.** Texts come in the host page's `<html lang>`, else in the
  browser's language. A text with no translation falls back to the base
  language, then to English, then to any.
- **The embed still wins** for what a page sets in its own
  `FloatingChatWindow.config`: `title`, `subtitle`, `greeting`,
  `newMessagePlaceholder`, `primaryColor`, `iconVariant` and
  `hideToggleButton`. The side is the profile's, ahead of the embed's
  `position`, as the legacy setting's has always been.
- **Without a profile** the chat is drawn from the legacy settings, as before.
  The same holds when the read fails or takes more than three seconds, and for
  a profile with no `root`. A profile ID that is not a UUID is never asked for.
- **The round button** is the profile's `launcher`. A profile that leaves it
  out has no button, and the page opens the chat itself.
- **The contact line** shows the profile's `phone` and `email`, else the
  assistant's own from the legacy settings. The contact form is sent by the
  inHotel backend to the assistant's own e-mail, so it is offered only when the
  assistant has one. A field the form leaves out is sent empty.
- A value that is not of its prop's type is not drawn: the library's default
  stands in. Words in a language are cut to the length their prop takes; a
  phone, an address or a name that is too long is not taken at all. A link is
  drawn only for an `http` or `https` address.
- A profile that leaves the header out still has the control that closes the
  chat.

### Try it

`npm run dev`, then open `http://localhost:3000/playground`. Every prop of the
library is a control there, and the chat beside the controls redraws as you
change them: its read of the assistant's profile is answered with your draft.
Add `?assistant=ASSISTANT_ID` to start from an assistant's profile. Nothing is
saved and nothing is sent, not a message and not the contact form: the page
shows the profile to copy. It runs on a local server only.

To see one assistant's profile as the iframe draws it, open
`http://localhost:3000/?token=-1&inbox=ASSISTANT_ID&version=1.0.0&locale=cs`.
Add `&appearanceProfile=CODE` for a profile that is not the default.

## Build and check

```sh
npm run build
npm test
npm start
```

`npm run build` compiles and type-checks the Next.js application. `npm test`
runs security, appearance and presentation regressions, then starts the
production server on a temporary local port and checks the launcher,
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

| Path | Responsibility |
| --- | --- |
| `public/widget.js` | Host-page launcher and iframe bridge |
| `pages/index.tsx` | Iframe application entry point |
| `pages/playground.tsx` | Tries every prop of the library on the real chat; local only |
| `appearance-library.json` | The UI's library: every component, its props, types and defaults |
| `components/EmbedLanding.tsx` | Embed code and live launcher, shown when `/` is opened directly |
| `components/Widget.tsx` | Configuration and theme wrapper; reads the appearance profile |
| `components/ChatWindow.tsx` | Conversation behavior; places the blocks the look lists |
| `components/ChatHeader.tsx`, `components/ChatMessages.tsx` | The header and the message list |
| `components/ChatMessage*.tsx` | Message rendering |
| `components/ChatFooter*.tsx`, `components/ContactForm.tsx` | Composer, contact line and contact form |
| `helpers/a2a-client.ts` | A2A JSON-RPC/SSE communication |
| `helpers/appearance.ts` | The look the chat draws from: a profile read against the library, or the settings |
| `helpers/appearance-api.ts` | Reads the assistant's appearance profile |
| `helpers/playground.ts` | Keeps the playground's chat from sending anything |
| `helpers/storage.ts` | Browser conversation and context persistence |
| `helpers/embed-security.ts` | Parent-message validation and fixed-origin agent URLs |
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
