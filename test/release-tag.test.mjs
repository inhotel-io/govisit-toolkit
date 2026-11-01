import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

test("draft preparation refuses an existing tag at another commit", async () => {
  const { assertReleaseTagTarget } = await import("../scripts/check-release-tag.mjs");
  const root = await mkdtemp(path.join(tmpdir(), "govisit-tag-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet"); git("config", "user.email", "test@example.test"); git("config", "user.name", "Test");
    git("commit", "--allow-empty", "-m", "old"); git("tag", "v0.1.0");
    git("commit", "--allow-empty", "-m", "reviewed"); const sha = git("rev-parse", "HEAD");
    assert.throws(() => assertReleaseTagTarget({ root, tag: "v0.1.0", sha }), /different|mismatch/i);
    git("tag", "-d", "v0.1.0"); assertReleaseTagTarget({ root, tag: "v0.1.0", sha });
    git("tag", "-a", "v0.1.0", "-m", "reviewed"); assertReleaseTagTarget({ root, tag: "v0.1.0", sha });
    const workflow = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
    assert.match(workflow, /fetch-depth: 0/);
    assert.ok(workflow.indexOf("node scripts/check-release-tag.mjs") < workflow.indexOf("gh release create"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
