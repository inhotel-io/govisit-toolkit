# GoVisit Toolkit

[![Suede Skill Check: 80/100](https://suedeai.directory/inhotel-io/govisit-toolkit/govisit-search-places/score.svg)](https://suedeai.directory/inhotel-io/govisit-toolkit/#govisit-search-places)

[![Listed in the Wever Labs Agent Directory](https://weverlabs.com/directory/badge.svg?name=GoVisit+Tools)](https://weverlabs.com/directory/verify?name=GoVisit+Tools)

[![MCP status](https://mcpi.app/servers/govisit-tools/badge.svg)](https://mcpi.app/servers/govisit-tools)

[![Listed on HookMCP](https://hookmcp.com/badge.svg)](https://hookmcp.com)

[![govisit.ai on the Neuronto ARD Registry](https://neuronto.com/badge/govisit.ai.svg?theme=dark)](https://neuronto.com/ard-publishers/govisit.ai)
[![MCP security](https://gateturbo.com/badge/scan/14b3623a-6c16-45c6-8bea-9b56a44e30aa)](https://gateturbo.com/report/14b3623a-6c16-45c6-8bea-9b56a44e30aa)
[![QAmcp score](https://api.qamcp.dev/badge/zKo3lhH9.svg)](https://qamcp.dev/?from=badge)
[![skillscan.io](https://skillscan.io/badge/inhotel-io-govisit-list-category-places.svg)
[![Featured in the Suede AI Directory](https://suedeai.directory/badges/featured.svg)](https://suedeai.directory/featured/#govisit)
[![Listed on CurlShip](https://curlship.com/badge.svg)](https://curlship.com)
[![Reviewed on skillemall](https://skillemall.ai/badge/inhotel-io%2Fgovisit-toolkit/inhotel-io/govisit-toolkit/skills/govisit-search-places)](https://skillemall.ai/s/inhotel-io%2Fgovisit-toolkit/inhotel-io/govisit-toolkit/skills/govisit-search-places)
[![AgentVerus](https://agentverus.ai/api/v1/skill/35b354a7-e330-4896-bc1f-6082cd5cb674/badge)](https://agentverus.ai/skill/35b354a7-e330-4896-bc1f-6082cd5cb674)
[![Listed in Awesome MCP Servers](https://sagargupta.online/awesome-mcp-servers/badge.svg)](https://github.com/Sagargupta16/awesome-mcp-servers)
[![Listed in Awesome Agent Skills](https://sagargupta.online/awesome-skills/badge.svg)](https://github.com/Sagargupta16/awesome-skills)
[![GoVisit on mcp.tc](https://mcp.tc/i/govisit/badge.svg)](https://mcp.tc/i/govisit)
[![Listed on mcpHQ](https://img.shields.io/badge/Listed%20on-mcpHQ-8A2BE2)](https://github.com/mcpHQ/awesome-mcp-servers)
[![Listed on KeelTools](https://keeltools.com/badge/keeltools-listed.svg)](https://keeltools.com/)
[![GoVisit Toolkit on HOL Registry (Trust Score)](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dinhotel-io%252Fgovisit-toolkit%26metric%3Dtrust%26style%3Dfor-the-badge%26label%3DGoVisit+Toolkit)](https://hol.org/registry/plugins/inhotel-io%2Fgovisit-toolkit)

[GoVisit](https://govisit.ai) is a travel platform that helps people and AI agents
discover destinations, local businesses, and experiences. It brings together
published destination and business profiles so travelers can explore what places
offer and local businesses can make their services easier to find and understand.

Tools and resources for using [GoVisit](https://govisit.ai) with AI agents and
coding assistants, including Claude Code, Codex, GitHub Copilot, Cursor, and other
Agent Skills-compatible tools.

This repository contains open-source tools, 22 portable read skills, native
Claude Code/Codex packages, release tooling, and implementation resources for GoVisit.
The [website documentation](https://govisit.ai/en/docs/developers/agent-skills/overview)
explains each tool's inputs and interpretation limits.

## Open-source tools

| Tool | Purpose | Source and setup |
| --- | --- | --- |
| Floating Chat | A floating chatbot optimized for travel and hospitality websites and A2A-compatible agents | [tools/floating-chat](tools/floating-chat/README.md) |

Each tool has its own dependencies, build, and deployment instructions. See
[tools/README.md](tools/README.md) for the directory conventions. Agent skills and
native plugins below are installed separately from these applications.

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

For a three-step setup with one choice of AI assistant, follow the
[Installation guide](https://govisit.ai/en/docs/developers/agent-skills/installation).
Install once, then use any included skill.

The `npx skills` installer requires Node.js 22.20 or later and npm. Its GitHub
shorthand commands use the repository's default branch, `main`.

Run in your project and choose the target agent and installation scope:

```sh
npx skills add inhotel-io/govisit-toolkit --skill '*'
```

The portable skills are the shared route for compatible AI tools. For an
explicit target, install all 22 skills for GitHub Copilot or Cursor:

```sh
npx skills add inhotel-io/govisit-toolkit --skill '*' --agent github-copilot
npx skills add inhotel-io/govisit-toolkit --skill '*' --agent cursor
```

Install the matching CLI before using those assistants from a terminal.

**GitHub Copilot CLI** (Node.js 22 or later):

```sh
npm install -g @github/copilot
```

Start it with `copilot`; on first launch, sign in with `/login`. Run
`copilot update` to update it. GitHub also documents Homebrew, WinGet, and an
install script in its [Copilot CLI installation guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli).

**Cursor CLI** (macOS, Linux, or Windows Subsystem for Linux):

```sh
curl https://cursor.com/install -fsS | bash
agent --version
```

On native Windows, run `irm 'https://cursor.com/install?win32=true' | iex` in
PowerShell. Cursor updates automatically; run `agent update` to update it
manually. See [Cursor CLI installation](https://cursor.com/docs/cli/installation).

Choose the command for your assistant; you do not need to install twice. See
[GitHub's skills guide](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
and [Cursor's skills guide](https://cursor.com/docs/skills) for discovery and scope.
The installer currently uses the shared project directory `.agents/skills/` for
both targets; their host-specific directories `.github/skills/` and
`.cursor/skills/` are also options for manual installation.

For another AI tool, select it in the interactive installer or install complete
skill directories in its documented Agent Skills location. The host must load
`SKILL.md` and its `references/contract.json`, and have permission to make HTTPS
requests to GoVisit. Model choice alone does not provide those capabilities.
See the [compatibility and verification record](docs/compatibility.md) for the
difference between installation checks and an exercised model conversation.

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

Install the Claude Code CLI first. Anthropic recommends the native installer for macOS, Linux, and WSL:

```sh
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

On Windows, use the [official Claude Code installation guide](https://code.claude.com/docs/en/getting-started) for the PowerShell or Command Prompt installer. Then add the marketplace and install a plugin:

```sh
claude plugin marketplace add inhotel-io/govisit-toolkit
claude plugin install govisit-travel-planner@govisit-toolkit --scope project
```

The marketplace command uses the repository's default `main` branch.

Codex:

Install or upgrade Codex CLI with Node.js and npm before running these commands:

```sh
npm install -g @openai/codex@latest
```

```sh
codex plugin marketplace add inhotel-io/govisit-toolkit --ref main
codex plugin add govisit-travel-planner@govisit-toolkit
```

Use `govisit@govisit-toolkit` for All, `govisit-destination@govisit-toolkit` for Destination, or `govisit-local-business@govisit-toolkit` for Local Business. Native packages live under
`plugins/`; their included skill files are generated from the canonical `skills/`
selection, and all resources remain inside the plugin root. A native Claude skill
is namespaced, for example `/govisit-travel-planner:govisit-search-places`; portable
skill invocation uses the host's own skill selector.

Codex reads each package's listing and composer icons from its `plugin.json`; the
SVGs live in that package's `assets/` directory. The Codex marketplace manifest
currently has no marketplace-level icon field. Its GoVisit Toolkit brand SVG is
kept at `plugins/assets/marketplace.svg` for use by surfaces that support one.

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

> Search GoVisit for places in Czechia where travelers can actively participate in immersive experiences such as regional festivals, traditional craft workshops, historical preservation sites, and local food traditions.
> Read the published profiles, explain missing evidence, and link the GoVisit sources.

An empty result does not prove absence, and published discovery facts do not prove
live prices or availability. The example performs reads and makes no reservation.

## Updates and diagnostics

To move a Codex marketplace from a version tag to the current GoVisit source,
remove and re-add it at `main`, then install the selected package again. Existing
plugin snapshots are updated by the final command:

```sh
codex plugin marketplace remove govisit-toolkit
codex plugin marketplace add inhotel-io/govisit-toolkit --ref main
codex plugin add govisit-travel-planner@govisit-toolkit
```

Use your audience package name in the last command. Re-adding an existing
marketplace with a different `--ref` requires removing its old marketplace
declaration first. `main` tracks ongoing changes; use a reviewed release tag
when a stable, reproducible version is required.

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

