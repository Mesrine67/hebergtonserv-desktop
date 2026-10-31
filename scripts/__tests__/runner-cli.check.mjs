import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../runner.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
  encoding: "utf8",
  timeout: 10000,
  windowsHide: true,
  env: { ...process.env, HTS_RUNNER_DIR: "C:\\does-not-exist\\hts-test-runner" }
});

test("help describes the CLI without contacting GitHub", () => {
  const result = run("--help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Runner Manager/);
  assert.match(result.stdout, /--runner-dir/);
});

test("unknown command exits with nonzero code", () => {
  const result = run("not-a-command");
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Usage:/);
});

test("stop refuses destructive taskkill", () => {
  const result = run("stop");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /désactivé/);
});

test("restart also refuses forceful termination", () => {
  const result = run("restart");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Ctrl\+C/);
});

test("help documents workflows and GitHub Projects", () => {
  const result = run("--help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /workflows/);
  assert.match(result.stdout, /projects/);
  assert.match(result.stdout, /--project-number/);
});

test("open emits a safe canonical GitHub URL in JSON mode", () => {
  const result = run("open", "issue", "14", "--json");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    url: "https://github.com/Mesrine67/hebergtonserv-desktop/issues/14"
  });
});

test("open rejects invalid IDs without starting a browser", () => {
  const result = run("open", "issue", "../14", "--json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: open/);
});


test("offline status is scriptable without GitHub access", () => {
  const result = run("status", "--json", "--offline");
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.equal(status.offline, true);
  assert.equal(status.github, null);
  assert.match(status.githubError, /hors ligne/);
  assert.equal(status.executableFound, false);
});

test("offline doctor returns diagnostics without attempting an API request", () => {
  const result = run("doctor", "--json", "--offline");
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.offline, true);
  assert.equal(data.github, null);
  assert.equal(typeof data.rustToolchainPresent, "boolean");
});

test("offline GitHub job listing is empty but valid JSON", () => {
  const result = run("jobs", "--json", "--offline");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), []);
});

test("TUI gracefully refuses a non-interactive terminal", () => {
  const result = run("tui", "--offline");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /terminal interactif/);
});
