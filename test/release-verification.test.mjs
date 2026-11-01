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
  assert.equal(await verifyRelease({ manifest, index: output.index, fetchAsset }), manifest.assets.length);
  await assert.rejects(verifyRelease({ manifest, index: output.index, fetchAsset: async () => Buffer.from("corrupted") }), /digest|size/i);
  await assert.rejects(verifyRelease({ manifest, index: output.index, fetchAsset: async () => { throw new Error("missing asset"); } }), /missing asset/i);
});
test("release verification fails closed on moving URLs, incomplete inventory and different index bytes", async () => {
  const { verifyRelease } = await import("../scripts/verify-release.mjs");
  const output = await buildToolkit({ root });
  const original = JSON.parse(output.assets["release-manifest.json"]);
  const fetchAsset = async url => output.assets[new URL(url).pathname.split("/").pop()];
  const moving = structuredClone(original); moving.assets[0].url = moving.assets[0].url.replace("/v0.1.0/", "/latest/");
  await assert.rejects(verifyRelease({ manifest: moving, index: output.index, fetchAsset }), /pinned|URL/i);
  const missing = structuredClone(original); missing.assets = missing.assets.filter(a => a.filename !== "govisit-skill-search-places.tar.gz");
  await assert.rejects(verifyRelease({ manifest: missing, index: output.index, fetchAsset }), /inventory|missing/i);
  const changed = structuredClone(output.index); changed.skills[0].description = "different";
  await assert.rejects(verifyRelease({ manifest: original, index: changed, fetchAsset }), /index|discovery/i);
});
