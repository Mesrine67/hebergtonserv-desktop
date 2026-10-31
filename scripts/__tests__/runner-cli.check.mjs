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
