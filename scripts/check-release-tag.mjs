import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function assertReleaseTagTarget({ root = process.cwd(), tag, sha }) {
  if (!/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(tag || "") || !/^[a-f0-9]{40}$/.test(sha || "")) throw new Error("Invalid release tag or reviewed commit");
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try { git("show-ref", "--verify", "--quiet", `refs/tags/${tag}`); }
  catch (error) { if (error.status === 1) return; throw error; }
  const target = git("rev-parse", `refs/tags/${tag}^{commit}`);
  if (target !== sha) throw new Error(`Release tag ${tag} points at a different commit (${target}); expected ${sha}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertReleaseTagTarget({ tag: process.env.RELEASE_TAG, sha: process.env.GITHUB_SHA });
}
