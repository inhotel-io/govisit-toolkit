import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildToolkit } from "../scripts/lib/toolkit-build.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));

test("public release verification accepts exact assets and rejects corrupted or missing downloads", async () => {
  const { verifyRelease } = await import("../scripts/verify-release.mjs");
  const output = await buildToolkit({ root });
  const manifest = JSON.parse(output.assets["release-manifest.json"]);
  const fetchAsset = async url => output.assets[new URL(url).pathname.split("/").pop()];
  assert.equal(await verifyRelease({ manifest, index: output.index, fetchAsset }), manifest.assets.length + 2);
  await assert.rejects(verifyRelease({ manifest, index: output.index, fetchAsset: async () => Buffer.from("corrupted") }), /digest|size/i);
  await assert.rejects(verifyRelease({ manifest, index: output.index, fetchAsset: async () => { throw new Error("missing asset"); } }), /missing asset/i);
});
test("release verification fails closed on moving URLs, incomplete inventory and different index bytes", async () => {
  const { verifyRelease } = await import("../scripts/verify-release.mjs");
  const output = await buildToolkit({ root });
  const original = JSON.parse(output.assets["release-manifest.json"]);
  const fetchAsset = async url => output.assets[new URL(url).pathname.split("/").pop()];
  const moving = structuredClone(original); moving.assets[0].url = moving.assets[0].url.replace(`/${original.release.tag}/`, "/latest/");
  await assert.rejects(verifyRelease({ manifest: moving, index: output.index, fetchAsset }), /pinned|URL/i);
  const missing = structuredClone(original); missing.assets = missing.assets.filter(a => a.filename !== "govisit-skill-search-places.tar.gz");
  await assert.rejects(verifyRelease({ manifest: missing, index: output.index, fetchAsset }), /inventory|missing/i);
  const changed = structuredClone(output.index); changed.skills[0].description = "different";
  await assert.rejects(verifyRelease({ manifest: original, index: changed, fetchAsset }), /index|discovery/i);
});

test("release verification checks both public metadata assets against reviewed bytes", async () => {
  const { verifyRelease } = await import("../scripts/verify-release.mjs");
  const output = await buildToolkit({ root });
  const manifest = JSON.parse(output.assets["release-manifest.json"]);
  for (const filename of ["release-manifest.json", "SHA256SUMS"]) {
    for (const bad of [undefined, Buffer.from("corrupt metadata")]) {
      const fetchAsset = async url => {
        const file = new URL(url).pathname.split("/").pop();
        if (file === filename) { if (!bad) throw new Error("missing metadata"); return bad; }
        return output.assets[file];
      };
      await assert.rejects(verifyRelease({ manifest, index: output.index, fetchAsset }), /metadata|digest|size/i);
    }
  }
});

test("release verification rejects a non-immutable toolkit revision", async () => {
  const { verifyRelease } = await import("../scripts/verify-release.mjs");
  const output = await buildToolkit({ root, revision: "1234567890abcdef1234567890abcdef12345678" });
  const manifest = JSON.parse(output.assets["release-manifest.json"]);
  assert.equal(manifest.release.revision, "1234567890abcdef1234567890abcdef12345678");
  manifest.release.revision = "main";
  await assert.rejects(verifyRelease({ manifest, index: output.index, fetchAsset: async url => output.assets[new URL(url).pathname.split("/").pop()] }), /revision/i);
});
