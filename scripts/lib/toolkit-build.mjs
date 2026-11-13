import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { createSkillArchive } from "../generated/skill-archive.mjs";

export const json = value => JSON.stringify(value, null, 2) + "\n";
export const digest = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const safeName = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function squareIconSvg(source) {
  const match = source.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  const viewBoxMatch = match?.[1].match(/\bviewBox="([^"]+)"/i);
  if (!match || !viewBoxMatch) throw new Error("Plugin icon must be an SVG with a viewBox");
  const viewBox = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error("Plugin icon has an invalid viewBox");
  const [minX, minY, width, height] = viewBox;
  const scale = Math.min(48 / width, 48 / height);
  const renderedWidth = width * scale, renderedHeight = height * scale;
  const x = (48 - renderedWidth) / 2, y = (48 - renderedHeight) / 2;
  const content = match[2].replace(/\bcurrentColor\b/g, "#202124");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><svg x="${x}" y="${y}" width="${renderedWidth}" height="${renderedHeight}" viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet">${content}</svg></svg>\n`;
}
export async function listFiles(root, prefix = "") {
  let entries;
  try { entries = await readdir(path.join(root, prefix), { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Symbolic resource is forbidden: ${prefix}${entry.name}`);
    if (entry.isDirectory()) files.push(...await listFiles(root, `${prefix}${entry.name}/`));
    else if (entry.isFile()) files.push(`${prefix}${entry.name}`);
    else throw new Error("Unexpected resource type");
  }
  return files.sort();
}

export async function buildToolkit({ root, release, packs, revision } = {}) {
  if (!root) throw new Error("Toolkit root is required");
  release ||= JSON.parse(await readFile(path.join(root, "config/release.json")));
  packs ||= JSON.parse(await readFile(path.join(root, "config/packs.json")));
  if (release.repository !== "inhotel-io/govisit-toolkit" || !/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(release.tag || "")) throw new Error("Invalid pinned release identity");
  if (revision !== undefined && !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Invalid toolkit build revision");
  const version = release.tag.slice(1);
  const upstream = JSON.parse(await readFile(path.join(root, "upstream.json")));
  const index = JSON.parse(await readFile(path.join(root, "config/discovery-index.json")));
  if (upstream.source?.repository !== "inhotel-io/govisit-web" || !/^[a-f0-9]{40}$/.test(upstream.source.revision)) throw new Error("Invalid upstream provenance");
  if (!Array.isArray(upstream.packages) || !upstream.packages.length) throw new Error("Missing package inventory");
  const expectedResources = ["LICENSE", "SKILL.md", "references/contract.json"];
  const packageFiles = new Map(), assets = {}, generated = {};
  const base = `https://github.com/${release.repository}/releases/download/${release.tag}/`;
  const names = upstream.packages.map(p => p.name);
  if (names.some(name => !safeName(name) || !name.startsWith("govisit-")) || new Set(names).size !== names.length) throw new Error("Invalid package identity");
  const actualNames = (await readdir(path.join(root, "skills"))).sort();
  if (json(actualNames) !== json([...names].sort())) throw new Error("Unexpected canonical skill inventory");
  if (!Array.isArray(index.skills) || index.skills.length !== names.length || new Set(index.skills.map(s => s.name)).size !== names.length) throw new Error("Invalid discovery inventory");
  for (const pkg of upstream.packages) {
    const skillRoot = path.join(root, "skills", pkg.name);
    if ((await lstat(skillRoot)).isSymbolicLink()) throw new Error("Symbolic skill root is forbidden");
    if (json(await listFiles(skillRoot)) !== json(expectedResources)) throw new Error(`Unexpected resources for ${pkg.name}`);
    const files = {};
    for (const name of expectedResources) files[name] = await readFile(path.join(skillRoot, name));
    const text = files["SKILL.md"].toString();
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
    const metadata = frontmatter ? parse(frontmatter[1]) : null;
    const contract = JSON.parse(files["references/contract.json"]);
    if (metadata?.name !== pkg.name || metadata?.license !== "MIT" || metadata?.metadata?.tool !== pkg.tool || metadata?.metadata?.version !== contract.version) throw new Error(`Invalid package identity/metadata: ${pkg.name}`);
    if (contract.sourceDigest !== upstream.sourceDigest || contract.tool !== pkg.tool) throw new Error("Contract provenance mismatch");
    const filename = `govisit-skill-${pkg.name.slice(8)}.tar.gz`;
    const bytes = createSkillArchive(files);
    const entry = index.skills.find(s => s.name === pkg.name);
    if (entry?.url !== base + filename || entry.type !== "archive" || entry.description !== metadata.description || digest(bytes) !== entry.digest || entry.digest !== pkg.digest) throw new Error(`Archive digest or metadata mismatch: ${pkg.name}`);
    assets[filename] = bytes;
    packageFiles.set(pkg.name, files);
  }
  const license = await readFile(path.join(root, "LICENSE"));
  const serviceTerms = await readFile(path.join(root, "SERVICE_TERMS.md"));
  const selected = [], seen = new Set();
  if (!Array.isArray(packs)) throw new Error("Invalid pack definitions");
  for (const pack of packs) {
    if (!safeName(pack.name) || seen.has(pack.name) || !Array.isArray(pack.requires) || !Array.isArray(pack.exclude) || (pack.include !== "all" && !Array.isArray(pack.include))) throw new Error("Invalid pack name or selection");
    seen.add(pack.name);
    if (pack.requires.some(name => !packageFiles.has(name))) continue;
    const members = (pack.include === "all" ? names : pack.include).filter(name => !pack.exclude.includes(name));
    if (!members.length || new Set(members).size !== members.length || members.some(name => !packageFiles.has(name))) throw new Error(`Invalid package selection: ${pack.name}`);
    for (const [field, max] of [["shortDescription", 30], ["longDescription", 4000]]) {
      if (typeof pack[field] !== "string" || !pack[field].trim() || pack[field].length > max) throw new Error(`Invalid listing ${field} for ${pack.name}`);
    }
    if (typeof pack.icon !== "string" || path.basename(pack.icon) !== pack.icon || !pack.icon.endsWith(".svg")) throw new Error(`Invalid icon source for ${pack.name}`);
    const iconSource = await readFile(path.join(root, "config/plugin-icons", pack.icon), "utf8");
    const icon = squareIconSvg(iconSource);
    const identity = { name: pack.name, version, description: pack.description, author: { name: "inHotel Sàrl" }, homepage: "https://govisit.ai/en/docs/developers/agent-skills/overview", repository: `https://github.com/${release.repository}`, license: "MIT" };
    const portable = { $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", ...identity,
      extensions: { "com.openai": { interface: { displayName: `GoVisit — ${pack.label}`, shortDescription: pack.shortDescription, longDescription: pack.longDescription, developerName: "inHotel Sàrl", category: "Travel", capabilities: ["Read"], websiteURL: "https://govisit.ai", supportURL: `https://github.com/${release.repository}/issues`, composerIcon: "./assets/icon.svg", logo: "./assets/icon.svg" } } } };
    const pluginFiles = { "plugin.json": json(portable), ".claude-plugin/plugin.json": json(identity), "LICENSE": license, "SERVICE_TERMS.md": serviceTerms, "assets/icon.svg": icon };
    for (const name of members) for (const [file, contents] of Object.entries(packageFiles.get(name))) pluginFiles[`skills/${name}/${file}`] = contents;
    for (const [file, contents] of Object.entries(pluginFiles)) generated[`plugins/${pack.name}/${file}`] = contents;
    const label = pack.name === "govisit" ? "all" : pack.name.slice(8);
    assets[`govisit-plugin-${label}.tar.gz`] = createSkillArchive(pluginFiles);
    const bundle = {};
    for (const name of members) for (const [file, contents] of Object.entries(packageFiles.get(name))) bundle[`${name}/${file}`] = contents;
    assets[`govisit-skills-${label}.tar.gz`] = createSkillArchive(bundle);
    selected.push({ ...pack, members });
  }
  const marketplace = { name: "govisit-toolkit", description: "GoVisit travel discovery skills and native agent packages.", owner: { name: "inHotel Sàrl" }, plugins: selected.map(p => ({ name: p.name, source: `./plugins/${p.name}`, description: p.description })) };
  generated[".claude-plugin/marketplace.json"] = json(marketplace);
  generated[".agents/plugins/marketplace.json"] = json({ name: "govisit-toolkit", interface: { displayName: "GoVisit Toolkit" }, plugins: selected.map(p => ({ name: p.name, source: { source: "local", path: `./plugins/${p.name}` }, policy: { installation: "AVAILABLE", authentication: "ON_USE" }, category: "Travel" })) });
  const marketplaceIcon = await readFile(path.join(root, "config/plugin-icons/marketplace.svg"), "utf8");
  generated["plugins/assets/marketplace.svg"] = Buffer.from(squareIconSvg(marketplaceIcon));
  assets["index.json"] = Buffer.from(json(index));
  const assetInventory = Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)).map(([filename, bytes]) => ({ filename, url: base + filename, digest: digest(bytes), size: bytes.length }));
  assets["release-manifest.json"] = Buffer.from(json({ formatVersion: 1, release: { ...release, ...(revision ? { revision } : {}) }, source: upstream.source, sourceDigest: upstream.sourceDigest, assets: assetInventory, plugins: selected.map(({ name, members }) => ({ name, skills: members })) }));
  assets["SHA256SUMS"] = Buffer.from(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => `${digest(bytes).slice(7)}  ${file}\n`).join(""));
  return { index, assets, generated, plugins: selected.map(p => p.name) };
}
