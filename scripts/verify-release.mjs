import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, json } from "./lib/toolkit-build.mjs";

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
async function download(url, limit) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "follow" });
  if (!response.ok) throw new Error(`Asset download failed: HTTP ${response.status} ${url}`);
  const final = new URL(response.url);
  if (final.protocol !== "https:" || !["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(final.hostname)) throw new Error("Unexpected asset redirect host");
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) { await response.body.cancel?.().catch(() => {}); throw new Error("Asset size limit exceeded"); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function verifyRelease({ manifest, index, fetchAsset = download }) {
  const release = manifest?.release;
  if (release?.repository !== "inhotel-io/govisit-toolkit" || !/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(release.tag || "")) throw new Error("Invalid pinned release");
  if (release.revision !== undefined && !/^[a-f0-9]{40}$/.test(release.revision)) throw new Error("Invalid toolkit build revision");
  const base = `https://github.com/${release.repository}/releases/download/${release.tag}/`;
  if (!Array.isArray(manifest.assets) || !manifest.assets.length || !Array.isArray(index?.skills) || !index.skills.length) throw new Error("Missing release inventory");
  const inventory = new Map();
  for (const asset of manifest.assets) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(asset.filename || "") || inventory.has(asset.filename) || asset.url !== base + asset.filename) throw new Error("Asset URL must be pinned to this release with a unique filename");
    if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest || "") || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_ASSET_BYTES) throw new Error("Invalid asset digest or size");
    inventory.set(asset.filename, asset);
  }
  const names = new Set();
  for (const skill of index.skills) {
    if (!/^govisit-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name || "") || names.has(skill.name) || skill.type !== "archive") throw new Error("Invalid discovery identity");
    names.add(skill.name);
    const expected = `govisit-skill-${skill.name.slice(8)}.tar.gz`;
    const asset = inventory.get(expected);
    if (!asset || skill.url !== asset.url || skill.digest !== asset.digest) throw new Error(`Missing or mismatched discovery inventory: ${skill.name}`);
  }
  const discovery = inventory.get("index.json");
  if (!discovery || discovery.digest !== digest(json(index))) throw new Error("Discovery index differs from approved release");
  for (const asset of manifest.assets) {
    const bytes = Buffer.from(await fetchAsset(asset.url, asset.size));
    if (bytes.length !== asset.size || digest(bytes) !== asset.digest) throw new Error(`Asset digest/size mismatch: ${asset.filename}`);
  }
  // Metadata is checked against reviewed local bytes without a self-hash.
  const manifestBytes = Buffer.from(json(manifest));
  const sums = Buffer.from([...manifest.assets.map(a => [a.filename, a.digest]), ["release-manifest.json", digest(manifestBytes)]]
    .sort(([a], [b]) => a.localeCompare(b)).map(([file, hash]) => `${hash.slice(7)}  ${file}\n`).join(""));
  for (const [filename, expected] of [["release-manifest.json", manifestBytes], ["SHA256SUMS", sums]]) {
    const actual = Buffer.from(await fetchAsset(base + filename, expected.length));
    if (!actual.equals(expected)) throw new Error(`Release metadata mismatch: ${filename}`);
  }
  return manifest.assets.length + 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); let dir = "dist", local = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--local") local = true;
    else if (args[i] === "--dir" && args[i + 1]) dir = args[++i];
    else throw new Error(`Unknown verification option: ${args[i]}`);
  }
  const manifest = JSON.parse(await readFile(path.join(dir, "release-manifest.json")));
  const index = JSON.parse(await readFile(path.join(dir, "index.json")));
  const count = await verifyRelease({ manifest, index, ...(local ? { fetchAsset: url => readFile(path.join(dir, path.basename(new URL(url).pathname))) } : {}) });
  console.log(`Verified ${count} ${local ? "local candidate" : "public release"} assets for ${manifest.release.tag}.`);
}
