# Floating Chat

Floating Chat is an embeddable floating chat for any A2A agent, made for
travel and hospitality websites. Give it the address of the agent's card and it
sits above an existing website, with mobile layouts, conversation history, a
contact form, and a look that can be set in every part. It needs no backend of
its own: the guest's browser talks to the agent.

This is a standalone tool in [GoVisit Toolkit](../../README.md). Its source code
is MIT-licensed, including the inherited Papercups code with its original notice
preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Current implementation

The host page loads `public/widget.js`, which creates the floating launcher and
opens an iframe. The iframe renders the Next.js chat application. The client
sends A2A 0.3 JSON-RPC requests to the agent: `message/stream` with Server-Sent
Events when its card says it streams, `message/send` when it does not. The reply
is the agent's artifacts, else the message of its last status, else the text it
sent as it worked. A stream ends at its final event, and an agent silent for two
minutes is given up.

The launcher takes one input, the address of the agent's card,
`agent_card_url`. From the card the chat takes:

- where messages go: the card's `url`, or the JSON-RPC interface it lists;
- the agent's name and description, the header's title and subtitle unless the
  page or a profile sets them;
- its `iconUrl`, the picture beside the agent's messages;
- whether it streams its replies;
- the example questions of its skills, which the chat can offer before the guest
  writes;
- the look of the chat, when the card publishes one (see
  [Appearance profiles](#appearance-profiles)).

An agent of inHotel's, whose card is at
`https://<profile-id>.agents.inhotel.io/.well-known/agent-card.json`, is reached
the way it always was: the chat also reads the assistant's settings, its
appearance profile and its contact form from `backend.inhotel.io`. Any other
agent's chat reads nothing from `backend.inhotel.io`: what it knows of the agent
comes from the card.

The welcome message and assistant replies use the card's `iconUrl`. The text
appears immediately while a fixed 32px avatar slot stays blank until the image is
ready. Missing or unusable icons use the built-in SVG fallback; card and image
loading each have a timeout before showing the fallback. No guest message is
required to load it.

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
`?agent_card_url=` with any A2A agent's card URL to chat with that agent instead.
The page on the hosted service takes only inHotel agents' cards, and a card's
chat is drawn only inside a page that frames it, so a link to the service cannot
put someone else's agent behind its address. On a local server both take any
card.

To try the chat with no backend at all, start the local echo agent, which
repeats what you write, in a second terminal:

```sh
npm run agent:echo
```

Then open
`http://localhost:3000/?agent_card_url=http://localhost:3300/.well-known/agent-card.json`.
[`examples/any-agent.html`](examples/any-agent.html) is a whole page to copy:
the card, a look for each part, and a contact form sent to the page's own code.
`dev/echo-agent.cjs` says how to make the echo agent stream or not, and publish
a look in its card.

To exercise the local iframe UI with an existing inHotel assistant, open
`http://localhost:3000/?token=-1&inbox=YOUR_ASSISTANT_PROFILE_ID&version=1.0.0`.
Add `&shouldShowContactForm=true` to that preview URL to show the envelope
control in the footer. Click it to open the contact form; opening or focusing the
form does not submit it. Form fields reserve their border space so focus and
validation do not move neighbouring fields.

The legacy `token=-1` value selects the UI; it is not an authentication credential.
Sending a message uses the agent described above.

Missing or invalid theme colors fall back to GoVisit blue-600 (`#465EA4`) in
both the launcher and iframe. Valid customer colors take precedence.

## Embed on a website

Set `data-agent-card-url` on the launcher script to the address of any A2A
agent's card. This example opens the inHotel Solutions Specialist.

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
      agent_card_url: 'https://agent.example/.well-known/agent-card.json',
      title: 'Ask our team',
      subtitle: 'How can we help with your visit?',
      primaryColor: '#465EA4',
      position: 'right',
      // The look of the chat, every part of it: see Appearance profiles.
      appearance: {elements: [/* ... */]},
      // The contact form, sent to your own code.
      onContactFormSubmit: async (form) => {
        await sendToYourInbox(form); // {firstName, lastName, email, message}
        return {ok: true}; // or {ok: false, message: 'Shown to the guest'}
      },
    },
  };
</script>
<script defer src="https://floating-chat.govisit.ai/widget.js"></script>
```

The script's `data-agent-card-url` takes precedence over
`window.FloatingChatWindow.config.agent_card_url`. It must be an `https`
address, or `http` on `localhost`.

What an agent needs:

- **A2A 0.3 over JSON-RPC.** Agents that offer only gRPC or HTTP+JSON, and A2A 1.0
  cards, are not read yet.
- **No sign-in.** The guest's browser calls the agent, and a browser cannot keep
  a secret, so an agent that asks for credentials cannot be used.
- **CORS.** The card is read from your page and from the origin that serves the
  chat (`https://floating-chat.govisit.ai`, or your own host), and messages are
  sent from that origin, so the card and the agent must allow both. Messages are
  `POST` requests with a `Content-Type` header, which the agent's preflight must
  allow.
- **Addresses on the web.** A card on the web cannot name an address on the
  guest's own computer or network: its endpoint and its picture must be on the
  web too. A card on `localhost`, or on a private network, may name addresses
  there.

The contact form of any agent other than inHotel's is sent to
`onContactFormSubmit`. A page that gives none has no form. The chat waits a
minute for its answer, and an answer after that still counts; a form on its way
is not sent again. An inHotel agent's form is sent by inHotel's backend to the
assistant's e-mail, as before.

For a self-hosted deployment, replace the script URL with your own host. The
launcher opens its iframe from the host that served the script, so a local
`npm run dev` also loads the local iframe.

The launcher supplies its page origin to the iframe. Incoming bridge messages
are accepted only from that parent window and origin, and outgoing events target
that exact origin. Older loaders can use the iframe's `document.referrer` as a
fallback. With a referrer-suppressing policy, use the updated launcher so the
explicit origin is supplied; an iframe with no established parent origin ignores
bridge messages. Messages go only to the address in the card the page named,
and every request carries the conversation's context, so each agent keeps a
conversation of its own: switching agents creates a fresh chat component
instead of reusing the previous conversation state. inHotel profile IDs must fit
one DNS label (UUID profile IDs are supported).

## Appearance profiles

The chat is drawn from an appearance profile: a list of elements that says
which parts the chat has and what each part says. A part the profile leaves out
is not drawn. Without a profile, an inHotel agent's chat is drawn from the legacy
widget settings, as before, and any other agent's from its card.

### The library

What a profile can hold is this UI's library,
[`appearance-library.json`](appearance-library.json): every component, what it
takes, each type and each default. The chat reads a profile against that file,
the playground draws its controls from it, and `npm test` checks the table
below against it.

<!-- library:start -->
| Component | What it is | What a profile sets |
| --- | --- | --- |
| `FloatingChat` | The chat as a whole: the round button, the window and the list of messages. | `header`, `greeting`, `composer`, `accent_color`, `screen_side`, `contact`, `branding`, `messages`, `launcher`, `suggestions` |
| `Launcher` | The round button the chat opens from. | `icon`, `has_greeting_preview` |
| `Header` | The bar at the top of the window, with a title and a line under it. | `titles`, `subtitles` |
| `Greeting` | The first message, shown before the guest writes. | `greetings` |
| `Messages` | How the list of messages looks. A group of values, not a part. | `assistant_bubble_color`, `guest_bubble_color`, `has_avatars`, `has_feedback`, `has_timestamps` |
| `Composer` | The field the guest writes in, with the send button. | `input_placeholders` |
| `Suggestions` | Questions the guest can send with one click before writing: the examples in the agent's card. | `limit` |
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

The page's own profile comes first. Without one, an inHotel agent's chat draws
the assistant's profile, and any other agent's chat draws the look its card
publishes.

- **An inHotel assistant's.** An inHotel assistant can carry profiles for this UI,
  `floating_chat`, in the inHotel v2 API. The launcher and the iframe both read
  `GET /api/v2/assistants/{assistant ID}/appearance-profiles?ui=floating_chat`,
  which answers any origin and fills in the library's defaults. The assistant's
  default profile is drawn. To draw another, name its code on the script,
  `data-appearance-profile="govisit"`, or as `appearance_profile` in
  `window.FloatingChatWindow.config`. That is also how a profile is tried on a
  page before it becomes the default.
- **The agent's card.** Any agent can publish the look of its chat in its own
  card, as an A2A extension whose `params` is a profile in the shape above:

  ```json
  "capabilities": {
    "extensions": [
      {
        "uri": "https://floating-chat.govisit.ai/extensions/appearance/v1",
        "required": false,
        "params": {"elements": [/* ... */]}
      }
    ]
  }
  ```

  The chat draws it for that agent, and the card's address is all a page then
  needs. A card's texts are read like a page's: a string, or a map of languages.
- **The page's own.** A page can give a whole profile itself, as `appearance`
  in `window.FloatingChatWindow.config`, in the shape above. It is drawn in
  place of the assistant's or the card's, and nothing is read from the API. A text is one
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
- **Without a profile** an inHotel agent's chat is drawn from the legacy
  settings, as before. The same holds when the read fails or takes more than
  three seconds, and for a profile with no `root`. A profile ID that is not a
  UUID is never asked for. Any other agent's chat takes its title and subtitle
  from the card's name and description, and the rest from the page's
  `FloatingChatWindow.config` and the library's defaults.
- **The round button** is the profile's `launcher`. A profile that leaves it
  out has no button, and the page opens the chat itself.
- **The contact line** shows the profile's `phone` and `email`, else, for an
  inHotel agent, the assistant's own from the legacy settings. An inHotel
  agent's contact form is sent by inHotel's backend to the assistant's own
  e-mail, so it is offered only when the assistant has one. Any other agent's is
  sent to the page's `onContactFormSubmit`, and offered only when the page gives
  one. A field the form leaves out is sent empty. A line with no phone, no
  e-mail and no form is not drawn, and the phone's icon comes only with a
  phone; an inHotel chat drawn from its settings keeps its line as before.
- **The questions** a `Suggestions` part offers are the example questions of the
  agent's card. Without a profile, a card's chat offers three of them; an
  inHotel chat drawn from its settings offers none. A click sends a question as
  the guest's message, so each is drawn as that message: in the guest's bubble,
  `guest_bubble_color` or else the accent colour. Replies an agent offers are
  drawn the same way.
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
Add `?assistant=` with an Assistant ID, or an agent card's address, to start
from that assistant's profile or the look the card publishes. Nothing is
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
runs security, appearance, agent and presentation regressions (the agent checks
talk to the local echo agent), then starts the
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
| `helpers/agent-card.ts` | Reads an agent's card: where messages go, its name, picture, questions and look |
| `helpers/appearance.ts` | The look the chat draws from: a profile read against the library, or the settings |
| `helpers/appearance-api.ts` | Reads the assistant's appearance profile |
| `helpers/playground.ts` | Keeps the playground's chat from sending anything |
| `helpers/storage.ts` | Browser conversation and context persistence |
| `helpers/embed-security.ts` | Parent-message validation and fixed-origin agent URLs |
| `styles/` | Global and emoji styling |
| `tests/` | Regression checks and the local production smoke check |
| `dev/echo-agent.cjs` | A small A2A agent for trying the chat with no backend |
| `examples/any-agent.html` | A page that embeds the chat for any agent, with a look and a contact form |
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
