# Floating Chat hosted deployment decision

Status: accepted on 2026-11-02. Scope: hosting and release design for the
GoVisit-operated service. Self-hosted installations may use their own hostname.
Since 2026-11-04, `floating-chat.govisit.ai` has DNS and a Let's Encrypt
certificate, and the toolkit's Floating Chat workflow deploys `main` to it (see
the tool's README). The release routes described here are not implemented yet.

## Hostname and application boundary

Use **`https://floating-chat.govisit.ai/widget.js`** as the public entry point.
Host the iframe application on the same dedicated hostname, behind its own
deployment and ingress/CDN configuration. This permits independent deployment,
caching, and rollback while keeping one stable hostname across application versions.

The alternatives considered were `chat.govisit.ai/floating-chat/widget.js`,
which shares a browser origin with other applications on `chat.govisit.ai`, and
`govisit.ai/floating-chat/widget.js`, which shares the main website's origin.
The dedicated tool hostname best matches the independently operated tool and
the existing application's root-based routes and asset paths.

Browser origin isolation is based on scheme, hostname, and port; changing a URL
path does not create that boundary. Use host-only authentication cookies for the
main website where possible: cookies with `Domain=govisit.ai` also reach its
subdomains. The selected hostname isolates the iframe application; the launcher
script still executes in the customer page's browsing context.

References: [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy),
[cookie domain scope](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
and [script/iframe storage contexts](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API#determining_storage_access_by_a_third_party).

## HTTPS and certificates

Use managed TLS with automatic issuance and renewal for
`floating-chat.govisit.ai`. A certificate for that individual hostname is
sufficient; an existing `*.govisit.ai` certificate may also cover it. Version
paths use the same certificate. A shared edge or ingress can terminate TLS and
route this hostname to its separate application deployment.

When using Let's Encrypt, a wildcard certificate requires DNS validation; an
individual hostname can use the managed provider's supported validation method.
Keep certificate renewal automated. See [Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/).

## Release URLs and compatibility

The following are example future release routes, using version 1.0.0 to
illustrate the policy. They are not a declaration that version 1.0.0 is published.

| Path on `floating-chat.govisit.ai` | Contract |
| --- | --- |
| `/v1.0.0/widget.js` | Exact release; immutable bytes |
| `/v1.0.0/chat` | Iframe application for that exact release |
| `/v1/widget.js` | Latest compatible release within major version 1 |
| `/widget.js` | Convenience alias, initially following version 1 |

Never move an existing major alias to a different major release. Introduce
`/v2/widget.js` for a breaking version and retain the supported v1 contract.
Keep `/widget.js` following v1 unless an explicit migration policy is announced.

A pinned launcher must open the corresponding iframe release, and that iframe
must resolve its own immutable JavaScript/CSS assets. Pinning only the launcher
while sending its iframe to a moving root application does not pin the product.
Restoring the launcher source/build configuration and adding release-aware
routing and asset resolution are prerequisites for these routes.

Version Floating Chat independently from the toolkit's agent-skill releases.
For example, the tool may use a `floating-chat-v1.0.0` tag and tool-specific
release assets while the existing toolkit release tags continue their own series.

## Cache policy and rollback

- Exact-release launcher files and immutable static assets:
  `Cache-Control: public, max-age=31536000, immutable`.
- Moving launcher aliases: `Cache-Control: public, max-age=300, must-revalidate`.
- Serve an alias with its current release's launcher content or a temporary
  redirect with the same short caching policy. A permanent redirect is unsuitable
  for an alias that must be able to move during rollback.
- Keep previously published release files and the assets their iframes reference.
  Publish a new release under a new version URL; never replace an existing
  exact-release file's bytes.
- Promote a tested launcher/iframe release together. Roll back by pointing the
  major/convenience aliases to the previous compatible release. Exact-release
  URLs continue serving their selected release.

These cache rules apply to the launcher and static release assets. Agent API,
SSE, and any personalized responses require their own appropriate policies.
See [HTTP caching guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).

## Migration from chat.inhotel.io

1. Provision the new hostname, managed TLS, and its independent deployment.
2. Update the launcher's iframe URL defaults (`OD` and `xD`) and check all
   application/static asset routes on the new host. Preserve existing embed
   globals while migrating installations.
3. Check backend settings, contact-form, and A2A endpoint CORS policies for the
   new iframe origin. The hostname move does not itself change those backend URLs.
4. Update customer CSP `script-src` and `frame-src` allowlists where required.
   Configure embedding permissions on the iframe application for intended
   customer sites; an unconditional `X-Frame-Options: SAMEORIGIN` or `DENY` would
   prevent the external-site embedding that this tool needs.
5. Validate the widget on representative customer sites, including browsers with
   restrictive third-party storage settings, before migrating customers.
6. Keep `chat.inhotel.io` available for existing integrations during the rollout.

Conversation history currently lives in the iframe's localStorage and context
IDs in sessionStorage. Moving to the new origin does not automatically transfer
either store; redirecting the old hostname does not migrate browser storage.
If continuity is required, design and review an explicit migration mechanism.
All candidate GoVisit URLs are still external embeds on a customer's hotel
domain, so changing the host/path alone does not remove third-party storage
restrictions. See [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).
