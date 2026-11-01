# Verification record

Candidate release: v0.1.0. Checked on 2026-11-01.

| Component | Version | Evidence |
|---|---|---|
| Node.js | 23.7.0 locally; 22 in CI | Generator, native build and verification tests; production website build |
| skills installer | 1.7.4 | Local toolkit discovery finds 22 unique skills; project-scoped Codex installation/removal succeeds and preserves package resources |
| Claude Code | 2.1.316 | All/Travel Planner manifests and marketplace validate; optional third-party-directory artwork warning remains |
| Codex CLI | 0.164.0-alpha.11.1 | Native command syntax checked; generated portable manifests and pinned Git-subdirectory catalog prepared |
| GoVisit runtime | Public destination search v1 | A read-only name lookup returned Prague with canonical URL and current search-index provenance |

These checks do not claim an authenticated model conversation or post-publication
Git-backed native install has run. Native remote sources pin v0.1.0 and must be
verified after the candidate is merged and that release tag exists, before the
website discovery/docs are promoted. No global user plugin installation was
changed during this verification.

Installed skills remain snapshots. CI validates generated packages and archives;
native support is declared for tested client versions rather than all products
sharing the Claude or ChatGPT names.
