# Verification record

## v0.2.1 packaging checks

Checked on 2026-11-13 before publication, from release branch commit
`f66eeab` (packaging changes; subsequent documentation changes do not alter plugin contents).

| Component | Version | Observed result |
|---|---|---|
| Toolkit | 0.2.1 | All 11 tests, build, generated-output checks and local verification of all 33 release assets pass |
| Native archives | 0.2.1 | All four archives contain valid listing descriptions and their referenced square SVG icons; portable skill bytes and digests are unchanged |
| Codex CLI | 0.166.0 | All four plugins install from the remote marketplace pinned to the full release-branch commit; every installed resource matches the candidate; clean local marketplace installs also pass |
| Claude Code | 2.1.316 | All four plugins install at project scope from the remote release-branch marketplace; every installed resource matches the candidate; all manifests and the marketplace validate |
| skills installer | 1.7.4 | Local discovery lists all 22 canonical portable skills |
| Release settings | GitHub | Immutable releases are enabled; public release verification follows publication as documented in releasing.md |

Native install checks used isolated temporary client configurations, which were
removed afterward. They verify packaging and installation, not a new model
conversation or every live API operation. Website discovery was not promoted
as part of this toolkit packaging patch; the website record below applies to v0.2.0.

## Previous v0.2.0 verification

Published release: [v0.2.0](https://github.com/inhotel-io/govisit-toolkit/releases/tag/v0.2.0).
Checked on 2026-11-01. v0.1.0 remains immutable.

| Component | Version | Observed result |
|---|---|---|
| Node.js | 23.7.0 locally; 22 in CI | Toolkit 8/8 tests, generated-output checks and release workflow pass |
| Release assets | v0.2.0 | All 33 uploaded draft files equal reviewed local bytes; public SHA-256/size/metadata checks and GitHub release attestation pass; release is immutable |
| skills installer | 1.7.4 | Remote one-session installation of all 22 skills, complete canonical resource comparison, update check and full project removal pass |
| Claude Code | 2.1.316 | All four native packages install from the real Git-backed marketplace; every included resource matches its canonical source; project-scoped removal passes; Travel Planner reports up-to-date on its update check |
| Codex CLI | 0.164.0-alpha.11.1 | All four native packages install from the pinned remote catalog; resources match; tested pinned-marketplace upgrade v0.1.0 → v0.2.0 and removal |
| Codex conversation | Authenticated ChatGPT session | Destination search → destination overview returned Prague; Local Business global name search → place overview returned Hermitage Hotel Prague from the installed owner packs |
| Website | v0.2.0 | Live discovery exactly matches release metadata; overview and all 22 references return HTTP 200 with current toolkit links and four audience selections |
| Manual Python download | Python 3.13 | Actual published example downloads live index/archive, verifies SHA-256, and writes exactly LICENSE, SKILL.md and references/contract.json |

The audience selections overlap: All 22, Travel Planner 18, Destination 13 and
Local Business 10. Only Update destination and Update place are still planned.
Public reads do not establish business ownership or permit publishing edits.

## Other compatible AI tools

The portable `skills/` packages are shared resources for Agent Skills-compatible
hosts, including GitHub Copilot and Cursor. Native Claude Code/Codex packaging
adds convenient installation routes; it does not limit the portable packages to
those two clients.

| AI tool | Portable route | Verification scope |
|---|---|---|
| GitHub Copilot | `--agent github-copilot`; installer uses `.agents/skills/`, with `.github/skills/` also documented by the host | skills 1.7.4 remote installation passed; all 22 skills/66 files match canonical resources. No Copilot model conversation run |
| Cursor | `--agent cursor`; installer uses `.agents/skills/`, with `.cursor/skills/` also documented by the host | skills 1.7.4 remote installation passed; all 22 skills/66 files match canonical resources. No Cursor model conversation run |
| Other Agent Skills-compatible hosts | Interactive installer target or the host's documented skill directory | Requires skill/reference discovery and HTTPS tool execution; verify the specific client/version before relying on a workflow |

Host references: [GitHub Copilot agent skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
and [Cursor agent skills](https://cursor.com/docs/skills), checked 2026-11-01.
Provider support for the format is separate from our end-to-end GoVisit testing.

## Limits and remaining findings

- A Claude model conversation was not run because this machine has no Claude
  login. Its actual native install/update/removal paths were exercised.
- Destination-scoped place name search timed out in a real conversation and a
  separate reproduction. Global name search and the profile reader succeeded.
  Track the runtime investigation in
  [public runtime issue](https://github.com/inhotel-io/govisit-toolkit/issues/3).
  This record does not claim all scoped search combinations passed.
- The optional third-party Claude directory artwork check warns about a missing
  listing icon; native validation and installation pass.
- The full web suite retains ten unrelated UI assertion failures reproduced on
  the unchanged baseline. Focused distribution checks and production builds pass.

The manual Python examples identify their client with a GoVisit Toolkit
User-Agent: Cloudflare rejects Python urllib's default User-Agent with error
1010. The identifying header was tested successfully; no security configuration
or access permission was weakened.

Temporary test plugin installations and marketplaces were removed. Installed
skills remain snapshots until explicitly updated. For portable removal, run the
installer in the project and remove all applicable targets so a shared canonical
skill copy is not retained for another target.
