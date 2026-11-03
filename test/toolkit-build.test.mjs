import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, readFile, writeFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const cli = (target, check = false) => spawnSync(process.execPath, [path.join(root, "scripts/build.mjs"), "--root", target, ...(check ? ["--check"] : [])], { encoding: "utf8" });
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "govisit-native-"));
  for (const name of ["skills", "config", "upstream.json", "LICENSE", "SERVICE_TERMS.md"]) await cp(path.join(root, name), path.join(dir, name), { recursive: true });
  return dir;
}
test("native packages are complete, selected once, and archives match approved digests", async () => {
  const dir = await fixture();
  try {
    const result = cli(dir); assert.equal(result.status, 0, result.stderr);
    const pluginEntries = await readdir(path.join(dir, "plugins"), { withFileTypes: true });
    assert.deepEqual(pluginEntries.filter(entry => entry.isDirectory() && entry.name !== "assets").map(entry => entry.name).sort(), ["govisit", "govisit-destination", "govisit-local-business", "govisit-travel-planner"]);
    assert.match(await readFile(path.join(dir, "plugins/assets/marketplace.svg"), "utf8"), /^<svg\b/);
    assert.equal((await readdir(path.join(dir, "plugins/govisit/skills"))).length, 22);
    assert.equal((await readdir(path.join(dir, "plugins/govisit-travel-planner/skills"))).length, 18);
    const portable = JSON.parse(await readFile(path.join(dir, "plugins/govisit/plugin.json")));
    const claude = JSON.parse(await readFile(path.join(dir, "plugins/govisit/.claude-plugin/plugin.json")));
    assert.equal(portable.name, claude.name); assert.equal(portable.version, JSON.parse(await readFile(path.join(dir, "config/release.json"))).tag.slice(1));
    assert.equal(portable.version, claude.version);
    const native = JSON.parse(await readFile(path.join(dir, ".agents/plugins/marketplace.json")));
    assert.equal(native.plugins[0].source.source, "git-subdir");
    assert.equal(native.plugins[0].source.ref, JSON.parse(await readFile(path.join(dir, "config/release.json"))).tag);
    assert.equal(native.plugins[0].source.path, "./plugins/govisit");
    const index = JSON.parse(await readFile(path.join(dir, "dist/index.json")));
    for (const entry of index.skills) {
      const bytes = await readFile(path.join(dir, "dist", path.basename(new URL(entry.url).pathname)));
      assert.equal("sha256:" + createHash("sha256").update(bytes).digest("hex"), entry.digest);
    }
    const listing = execFileSync("tar", ["-tzf", path.join(dir, "dist/govisit-plugin-all.tar.gz")], { encoding: "utf8" });
    assert.ok(listing.includes(".claude-plugin/plugin.json"));
    assert.ok(listing.includes("skills/govisit-search-places/references/contract.json"));
    assert.ok(!listing.includes("../"));
    assert.equal(cli(dir, true).status, 0);
    await writeFile(path.join(dir, "plugins/govisit/skills/govisit-search-places/SKILL.md"), "drift");
    const stale = cli(dir, true); assert.notEqual(stale.status, 0); assert.match(stale.stderr, /drift|stale/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("tampered canonical packages fail before generated outputs are replaced", async () => {
  const dir = await fixture();
  try {
    assert.equal(cli(dir).status, 0);
    const plugin = await readFile(path.join(dir, "plugins/govisit/plugin.json"), "utf8");
    await writeFile(path.join(dir, "skills/govisit-search-places/SKILL.md"), "tampered");
    const result = cli(dir); assert.notEqual(result.status, 0); assert.match(result.stderr, /identity|digest|metadata/i);
    assert.equal(await readFile(path.join(dir, "plugins/govisit/plugin.json"), "utf8"), plugin);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("escaping resource symlinks and unsafe plugin names are rejected", async () => {
  const dir = await fixture();
  try {
    await symlink(path.join(dir, "LICENSE"), path.join(dir, "skills/govisit-search-places/secret"));
    let result = cli(dir); assert.notEqual(result.status, 0); assert.match(result.stderr, /symbolic|symlink|unexpected/i);
    await rm(path.join(dir, "skills/govisit-search-places/secret"));
    const packs = JSON.parse(await readFile(path.join(dir, "config/packs.json")));
    packs[0].name = "../escape"; await writeFile(path.join(dir, "config/packs.json"), JSON.stringify(packs));
    result = cli(dir); assert.notEqual(result.status, 0); assert.match(result.stderr, /pack|name|path/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
