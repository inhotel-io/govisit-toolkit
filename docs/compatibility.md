# Verification record

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
