# Releasing the toolkit

The reviewed read-tool contracts and package generator live in `inhotel-io/govisit-web`.
From that checkout, export into an isolated toolkit checkout:

```sh
node scripts/export-toolkit.mjs --target /absolute/path/to/govisit-toolkit
```

Inspect `upstream.json`, the canonical skill diff, and the public file inventory.
Generated plugin packages are derived from `skills/` and `config/packs.json`.
They are never edited independently. Destination/Local Business packages remain
unavailable until their required authoring skills exist.

## Prepare and review

1. Agree on an unused version/tag in both repositories' release configuration.
   Keep `package.json`, package-lock version, native manifests, and release notes
   aligned. A published tag is never reused or overwritten.
2. Run `npm ci --ignore-scripts`, `npm test`, `npm run build`, `npm run check`, and
   `npm run verify:release -- --local`.
3. Review the candidate assets, SHA256SUMS, source revision, native packages, and
   matching website discovery/docs changes. Run supported native/portable clients;
   schema/manifest validation alone does not prove an end-to-end task succeeded.
4. Merge the reviewed toolkit change before publishing its release. Keep website
   discovery and documentation changes pending until public asset verification.

## Publish

Enable immutable releases in the toolkit repository settings **before publication**.
See [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
The manual `Prepare draft release` workflow uploads all verified assets to a new
draft and deliberately stops before public publication. Existing releases cause
creation to fail; there is no clobber/update path.

After reviewing the draft and immutable-release setting, publish it using GitHub
or `gh release edit v0.1.0 --draft=false --repo inhotel-io/govisit-toolkit`.
Then run:

```sh
gh release verify v0.1.0 --repo inhotel-io/govisit-toolkit
npm run verify:release
```

The first command verifies immutability/attestation. The second downloads every
asset referenced by the approved local release manifest and compares its size
and SHA-256 digest. It must run from the reviewed candidate checkout after build.
For additional verification, use `gh release verify-asset` on the local archives.

Only after these checks pass should the matching GoVisit discovery projection
and all public installation/reference pages be deployed. Verify public index
entries, native Git subdirectory sources, clean installs, and representative live
documentation after deployment.

## Integrity, capacity, and rollback

Archives are release assets, not binaries in Git source history. The website
stores the small discovery projection; it does not host duplicate archives.
Published immutable assets retain their bytes. Roll back a later bad release by
promoting the prior approved discovery/docs metadata, never by replacing assets.
There is no legacy-archive redirect requirement for the undistributed pre-launch
website packages.

MIT applies to toolkit files. Service access and returned data are governed by
the separate [GoVisit Data Use License](https://govisit.ai/en/docs/general/data-use-license).
Coordinate license changes using the internal licensing maintenance standard.
