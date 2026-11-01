import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildToolkit, listFiles, json } from "./lib/toolkit-build.mjs";
const args = process.argv.slice(2);
let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), check = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--check") check = true;
  else if (args[i] === "--root" && args[i + 1]) root = path.resolve(args[++i]);
  else throw new Error(`Unknown build option: ${args[i]}`);
}
const output = await buildToolkit({ root });
if (check) {
  const actual = (await listFiles(path.join(root, "plugins"))).map(p => `plugins/${p}`);
  const expected = Object.keys(output.generated).filter(p => p.startsWith("plugins/")).sort();
  if (json(actual) !== json(expected)) throw new Error("Stale generated plugin inventory");
  for (const [file, bytes] of Object.entries(output.generated)) {
    let actual; try { actual = await readFile(path.join(root, file)); } catch { throw new Error(`Missing generated file: ${file}`); }
    if (!actual.equals(Buffer.from(bytes))) throw new Error(`Generated content drift: ${file}`);
  }
  console.log(`Verified ${output.index.skills.length} canonical skills and ${output.plugins.length} native packages.`);
} else {
  await rm(path.join(root, "plugins"), { recursive: true, force: true });
  await rm(path.join(root, "dist"), { recursive: true, force: true });
  for (const [file, bytes] of Object.entries({ ...output.generated, ...Object.fromEntries(Object.entries(output.assets).map(([file, bytes]) => [`dist/${file}`, bytes])) })) {
    const target = path.join(root, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  }
  console.log(`Built ${output.index.skills.length} skills, ${output.plugins.length} native packages, and ${Object.keys(output.assets).length} release assets.`);
}
