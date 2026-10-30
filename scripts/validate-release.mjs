import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8")).version;
const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8")
  .match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const lock = readFileSync("src-tauri/Cargo.lock", "utf8");
const appLock = lock.match(/name = "hebergtonserv-desktop"\s+version = "([^"]+)"/)?.[1];

if (!pkg || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg)) {
  throw new Error("Invalid application version");
}
if (pkg !== tauri || pkg !== cargo || pkg !== appLock) {
  throw new Error(`Version mismatch: package=${pkg}, tauri=${tauri}, cargo=${cargo}, lock=${appLock}`);
}
if (process.env.RELEASE_EVENT === "push" && process.env.RELEASE_REF !== `v${pkg}`) {
  throw new Error(`Tag ${process.env.RELEASE_REF} must equal v${pkg}`);
}
if (process.env.RELEASE_EVENT === "push") {
  const branch = execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  execFileSync("git", ["merge-base", "--is-ancestor", head, branch]);
}
console.log(`Verified release version ${pkg}`);
