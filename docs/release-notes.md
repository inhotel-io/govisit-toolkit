# GoVisit Toolkit v0.2.1

Completes marketplace listing metadata for all four native packages, with concise
subtitles, audience-specific descriptions, usage limitations, and support links.
Every native archive now includes its declared square SVG listing and composer icon.

Native marketplaces resolve plugins inside the selected repository checkout.
The README pins native installation to v0.2.1 and documents exact-commit selection,
upgrades from older marketplace sources, and the optional main development channel.
Pinning a marketplace no longer fetches plugin contents separately from main.

Release metadata records the toolkit build commit in addition to the existing
upstream web revision. SHA256SUMS covers the release manifest and all payload
archives; release verification checks the complete public asset inventory.

Includes the same 22 public read skills and audience selections as v0.2.0:
All (22), Travel Planner (18), Destination (13), and Local Business (10).
Portable skill bytes, HTTP contracts, and their digests are unchanged. Destination
and place editing remain planned; no write permissions or booking workflows are added.

v0.1.0 and v0.2.0 remain immutable. MIT covers toolkit files; hosted services and
returned data retain the separate GoVisit Data Use License.
