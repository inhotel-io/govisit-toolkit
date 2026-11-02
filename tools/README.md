# Open-source tools

Standalone tools live under `tools/<name>/`. Each directory is an independently
buildable project with its own README, dependency manifests and lockfiles,
license notices, tests, and deployment examples.

| Tool | Description |
| --- | --- |
| [Floating Chat](floating-chat/README.md) | A floating chatbot optimized for travel and hospitality websites and A2A-compatible agents |

## Adding a tool

- Use a descriptive directory name in lowercase with hyphens and a human-readable
  name in the tool's README.
- Document installation, configuration, development, build, tests, deployment,
  external service requirements, and maintenance status inside that directory.
- Apply the repository's MIT license to contributed code and preserve upstream
  copyright and license notices. Include the notices in standalone distributions.
- Keep dependencies and build output inside the tool directory. Keep secrets and
  environment-specific production deployment credentials outside the repository.
- Add a workflow under the repository's `.github/workflows/` that runs the tool's
  checks. Nested workflow directories are not executed by GitHub Actions.
- Give each tool its own version and release assets when releases are needed.
  The root release pipeline currently distributes agent skills and plugins.

`skills/` holds canonical portable Agent Skills and `plugins/` holds generated
native agent packages. The root build regenerates `plugins/` and root `dist/`;
tool artifacts belong in their own directory or separately named release assets.
Root `npm test` runs the toolkit distribution tests; run each tool's documented
commands from its directory. A root dependency workspace is not required to add
a standalone tool.
