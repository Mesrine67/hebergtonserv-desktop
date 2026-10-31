import test from 'node:test';
import assert from 'node:assert/strict';
import { syncProject } from '../project-sync.mjs';

const repo = 'Mesrine67/hebergtonserv-desktop';
const u = (n) => 'https://github.com/Mesrine67/hebergtonserv-desktop/issues/' + n;
const mk = (already = [1]) => ({
  project: { items: already.map((n) => ({ content: { url: u(n) } })) },
  issues: [1, 2, 3].map((n) => ({ number: n, url: u(n), title: 'Test ' + n }))
});

test('dry-run reports missing issues but never mutates GitHub', async () => {
  const data = mk();
  let mutated = 0;
  const report = await syncProject({
    repo, projectNumber: 3,
    gh: async (args) => args[0] === 'project' ? data.project : data.issues,
    addItem: async () => { mutated += 1; }
  });
  assert.equal(report.dryRun, true);
  assert.equal(report.applied, 0);
  assert.deepEqual(report.missing.map((x) => x.number), [2, 3]);
  assert.equal(mutated, 0);
});

test('apply adds only absent issues, does not duplicate existing items', async () => {
  const data = mk([1, 2]);
  const added = [];
  const report = await syncProject({
    repo, projectNumber: 3, apply: true,
    gh: async (args) => args[0] === 'project' ? data.project : data.issues,
    addItem: async (args) => { added.push(args.at(-1)); }
  });
  assert.deepEqual(added, [u(3)]);
  assert.equal(report.applied, 1);
});

test('offline, invalid repository and invalid API payloads fail closed', async () => {
  await assert.rejects(syncProject({ repo, projectNumber: 3, offline: true }), /mode --offline/);
  await assert.rejects(syncProject({ repo: '../../bad', projectNumber: 3 }), /invalide/);
  await assert.rejects(syncProject({
    repo, projectNumber: 3,
    gh: async () => ({ unexpected: true }),
  }), /illisible/);
});
