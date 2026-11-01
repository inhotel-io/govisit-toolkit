# GoVisit Toolkit

Tools and resources for using [GoVisit](https://govisit.ai) with AI agents and
coding assistants, including Claude Code, Codex, and other compatible tools.

This repository contains 22 portable read skills, native Claude Code/Codex
packages, release tooling, and implementation resources for GoVisit.
The [website documentation](https://govisit.ai/en/docs/developers/agent-skills/overview)
explains each tool's inputs and interpretation limits.

## Choose a package

| Audience | Available package | Contents |
| --- | --- | --- |
| All | `govisit` | All 22 public read skills, including documentation and catalog statistics |
| Travel Planner | `govisit-travel-planner` | 18 destination, place, category, collection, and activity readers/searches |
| Destination | `govisit-destination` | 13 skills to find and inspect destination profiles and their published inventory; Update destination is planned |
| Local Business | `govisit-local-business` | 10 skills to find and inspect place profiles and their local context; Update place is planned |

Audience packages overlap: the same canonical reader can be useful to a travel planner, a destination manager, and a local business. Choose All or any audience package you need. The current release reads public
information without a GoVisit API key; it does not include editing workflows.
An AI host may still request network/tool permission. Service limits and the
Data Use License apply, and model usage follows your assistant's plan.

## Install portable skills

Run in your project and choose the target agent and installation scope:

```sh
npx skills add inhotel-io/govisit-toolkit --skill '*'
```

For a single skill and an explicit target:

```sh
npx skills add inhotel-io/govisit-toolkit --skill govisit-search-places --agent codex
```

The canonical files live under `skills/govisit-*/`. Names already include
`govisit-`; keep the directory and SKILL.md name together without rewriting them.
Manual downloads use the [discovery index](https://govisit.ai/.well-known/agent-skills/index.json),
which points to versioned release assets and their SHA-256 digests. Verify the
original archive bytes before unpacking the complete package, including LICENSE
and references. A collection archive is not a universally supported skill-upload format.

## Install native plugins

Claude Code:

```sh
claude plugin marketplace add inhotel-io/govisit-toolkit
claude plugin install govisit-travel-planner@govisit-toolkit --scope project
```

Codex:

```sh
codex plugin marketplace add inhotel-io/govisit-toolkit --ref v0.2.0
codex plugin add govisit-travel-planner@govisit-toolkit
```

Use `govisit@govisit-toolkit` for All, `govisit-destination@govisit-toolkit` for Destination, or `govisit-local-business@govisit-toolkit` for Local Business. Native packages live under
`plugins/`; their included skill files are generated from the canonical `skills/`
selection, and all resources remain inside the plugin root. A native Claude skill
is namespaced, for example `/govisit-travel-planner:govisit-search-places`; portable
skill invocation uses the host's own skill selector.

## For destination and local business managers

Start by finding your own published entry. A destination manager can use
`govisit-search-destinations`, then `govisit-get-destination-overview` and
`govisit-get-destination-section`. A local business manager can use
`govisit-search-places`, then `govisit-get-place-overview`,
`govisit-get-place-section`, and `govisit-get-place-visit-facts`.

These skills are already included in the corresponding audience package and can
also be installed individually. The same readers are reused across audiences.
The planned `govisit-update-destination` and `govisit-update-place` skills will
join those packages when their secure authoring workflows are implemented. Reading
a public profile does not establish ownership or grant permission to update it.

## First task

After installation, start a session if your host needs to refresh discovery:

> Use GoVisit to find Prague, then find hotels there suitable for a quiet weekend.
> Read the published profiles, explain missing evidence, and link the GoVisit sources.

An empty result does not prove absence, and published discovery facts do not prove
live prices or availability. The example performs reads and makes no reservation.

## Updates and diagnostics

Installed copies are snapshots. For portable skills, use `npx skills check` and
`npx skills update`, or reinstall the selected complete package through your
installer. Native users update the marketplace/plugin using their client's
supported commands. Pin a reviewed release/commit for reproducible automation;
GitHub Release archives are versioned, while a checkout of `main` can change.

Remove portable skills through `npx skills remove`; native users use
`claude plugin uninstall` or `codex plugin remove` with the installed package ID.
Confirm actual installed paths/versions in your client before removing anything.

If a task fails, check the package version, network access to GitHub release
assets and `govisit.ai`, required arguments, and the response's error/freshness
metadata. HTTP 429 requires respecting Retry-After. Never paste credentials or
private business/travel data into a public issue.

For maintainers, see [release preparation and verification](docs/releasing.md).

## Licensing

The GoVisit Toolkit's code, skills, scripts, schemas, documentation, and examples
are licensed under the **[MIT License](LICENSE)** unless otherwise indicated.
You can reuse, modify, redistribute, and commercially use these materials under
that license. Preserve the required copyright and license notice when doing so.

Access to GoVisit-hosted search, public read APIs, WebMCP tools, and use of
returned GoVisit Data are governed separately by the
**[GoVisit Data Use License](https://govisit.ai/en/docs/general/data-use-license)**.
The toolkit license grants no additional service capacity, data rights, or editing
permissions. Third-party materials retain their identified licenses and notices.

| Material or activity | Applicable terms |
| --- | --- |
| Toolkit code, skills, schemas, documentation, and examples | MIT, except explicitly identified third-party or separately licensed material |
| Hosted search, public read APIs, WebMCP access, and returned GoVisit Data | GoVisit Data Use License and applicable source-specific terms |
| Submitting recommendations or publishing content updates | Applicable service/submission terms and current account, resource, and role permissions |
| Third-party content | Its identified source terms; inclusion in a response does not make it MIT-licensed |

These are separate scopes. The Data Use License is not an additional restriction
on reuse of the MIT-licensed toolkit files. Conversely, including a client or
schema here does not make the hosted service or its returned data MIT-licensed.

See [Hosted services and data terms](SERVICE_TERMS.md) for the scope of each set
of terms, attribution guidance, and handling of examples and submissions.

## Responsible use

- Follow the documented interfaces, request limits, and any account-specific
  access conditions. Installing a skill does not grant backend permissions.
- Preserve data attribution, provenance, freshness, and source-license notices
  when using GoVisit responses, as required by the applicable terms.
- Use clearly labeled synthetic data in examples where possible. Identify the
  source and applicable terms for any separately licensed fixtures or media.
- Keep credentials, personal information, and confidential business data out of
  public issues, examples, and pull requests.

