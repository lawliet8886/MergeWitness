import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { __testing, dispose, evaluate, prepare, verifyRepair } from '../src/core/mergeWitness.mjs';
import { runTrace } from '../src/core/scenario.mjs';

function fixtureRepo() {
  mkdirSync(resolve('fixtures/.generated'), { recursive: true });
  const root = mkdtempSync(join(resolve('fixtures/.generated'), 'test-run-'));
  const generator = resolve('fixtures/create-fixtures.mjs');
  const generated = join(root, 'histories');
  const result = spawnSync('node', [generator, generated], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr);
  return { root, tenantRepo: generated, priorityRepo: join(dirname(generated), 'priority-cursor-history') };
}

test('prepare uses a disposable clean merge and preserves passing ordinary tests', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({
      repoPath: fixture.tenantRepo,
      baseRef: 'base',
      branchARef: 'tenant-pricing',
      branchBRef: 'sku-cache',
    });
    assert.equal(analysis.merge.clean, true);
    assert.equal(analysis.normalTests.base.exitCode, 0);
    assert.equal(analysis.normalTests.branchA.exitCode, 0);
    assert.equal(analysis.normalTests.branchB.exitCode, 0);
    assert.equal(analysis.normalTests.merged.exitCode, 0);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('browser-safe trace adapter executes caller supplied fixture behavior', () => {
  const trace = runTrace(
    () => ({ getPrice: ({ sku }) => sku.length, getSourceCalls: () => 1 }),
    [{ tenant: 'alpha', sku: 'notebook' }],
  );
  assert.equal(trace.trace[0].observed, 8);
  assert.equal(trace.sourceCalls, 1);
});

test('generated browser snapshots have parity with the actual Git snapshot modules', async () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const generatedModule = join(fixture.root, 'tenantCacheSnapshots.mjs');
    const exporter = resolve('fixtures/export-web-snapshots.mjs');
    const exported = spawnSync('node', [exporter, fixture.tenantRepo, generatedModule], { encoding: 'utf8', shell: false });
    assert.equal(exported.status, 0, exported.stderr);
    const keys = { base: 'base', tenantPricing: 'branchA', skuCache: 'branchB', combined: 'merged' };
    const steps = [{ tenant: 'alpha', sku: 'notebook' }, { tenant: 'beta', sku: 'notebook' }];
    const options = { tenantPrices: { alpha: { notebook: 90 }, beta: { notebook: 100 } } };
    const parityProgram = join(fixture.root, 'parity-child.mjs');
    writeFileSync(parityProgram, `
      import { join } from 'node:path';
      import { pathToFileURL } from 'node:url';
      import { tenantCacheSnapshots } from ${JSON.stringify(pathToFileURL(generatedModule).href)};
      import { runTrace } from ${JSON.stringify(pathToFileURL(resolve('src/core/scenario.mjs')).href)};
      const keys = ${JSON.stringify(keys)};
      const paths = ${JSON.stringify(analysis.paths)};
      const steps = ${JSON.stringify(steps)};
      const options = ${JSON.stringify(options)};
      const results = [];
      for (const [webKey, snapshotKey] of Object.entries(keys)) {
        const actual = await import(pathToFileURL(join(paths[snapshotKey], 'src', 'catalog.js')).href);
        results.push([webKey, runTrace(tenantCacheSnapshots[webKey].createCatalog, steps, options), runTrace(actual.createCatalog, steps, options)]);
      }
      process.stdout.write(JSON.stringify(results));
    `);
    const parity = spawnSync('node', [parityProgram], { encoding: 'utf8', shell: false });
    assert.equal(parity.status, 0, parity.stderr);
    for (const [, browserResult, gitResult] of JSON.parse(parity.stdout)) assert.deepEqual(browserResult, gitResult);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('evaluate requires a structured, consistent probe result and records immutable evidence', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'probe.mjs');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'pass', evidence: 'generic harness check' }));\n");
    __testing.analyses.delete(analysis.analysisId);
    const result = evaluate({ analysisId: analysis.analysisId, statePath: analysis.statePath, probePath: probe, repetitions: 3 });
    assert.equal(result.classification, 'no_witness_found');
    assert.equal(result.matrix.merged.consistent, true);
    assert.ok(result.report.trees.merged);
    assert.equal(result.probeManifest.length, 1);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('evaluation rejects differing structured evidence across repetitions', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'varying-evidence.probe.mjs');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'fail', evidence: { nonce: Math.random() } }));\n");
    const result = evaluate({ analysisId: analysis.analysisId, probePath: probe, repetitions: 3 });
    assert.equal(result.classification, 'inconclusive');
    assert.equal(result.matrix.base.consistent, false);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('repair verification rejects a dirty candidate before running test commands', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'passing.probe.mjs');
    const feature = join(fixture.root, 'passing.feature.mjs');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'pass' }));\n");
    writeFileSync(feature, "console.log(JSON.stringify({ status: 'pass' }));\n");
    evaluate({ analysisId: analysis.analysisId, probePath: probe, featureCheckPaths: [feature], repetitions: 3 });
    writeFileSync(join(analysis.paths.merged, 'src', 'catalog.js'), "\n// dirty candidate\n", { flag: 'a' });
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }), /committed and clean/);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('priority ordering plus an id cursor cleanly merges while losing a traversed item', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.priorityRepo, baseRef: 'base', branchARef: 'priority-order', branchBRef: 'id-cursor' });
    assert.equal(analysis.merge.clean, true);
    assert.deepEqual(Object.values(analysis.normalTests).map((entry) => entry.exitCode), [0, 0, 0, 0]);
    const probe = join(fixture.root, 'priority-child.mjs');
    writeFileSync(probe, `
      import { createPager } from ${JSON.stringify(pathToFileURL(join(analysis.paths.merged, 'src', 'pager.js')).href)};
      const pager = createPager([{ id: 'a', priority: 1 }, { id: 'b', priority: 3 }, { id: 'c', priority: 2 }, { id: 'd', priority: 1 }]);
      const first = pager.listPage({ limit: 2 });
      const second = pager.listPage({ cursor: first.nextCursor, limit: 2 });
      process.stdout.write(JSON.stringify([...first.nodes, ...second.nodes].map((item) => item.id)));
    `);
    const result = spawnSync('node', [probe], { encoding: 'utf8', shell: false });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['b', 'c', 'd']);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
