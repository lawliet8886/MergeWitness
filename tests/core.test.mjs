import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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

test('unsupported test runners are rejected by the API, CLI, and MCP before repository access', () => {
  const error = /Unsupported testCommand: only/;
  for (const testCommand of [null, [], ['node'], ['node', 'regression.mjs'], ['npm', 'test'],
    ['node', '--test', 'regression.mjs'], ['node', '--test', '--import=./runner.mjs'], 'node --test']) {
    assert.throws(() => prepare({ repoPath: 'missing-repository', testCommand }), error);
  }
  const root = mkdtempSync(join(tmpdir(), 'mergewitness-command-gate-'));
  try {
    const request = { repoPath: 'missing-repository', baseRef: 'base', branchARef: 'a', branchBRef: 'b', testCommand: ['node', 'regression.mjs'] };
    const requestPath = join(root, 'request.json');
    writeFileSync(requestPath, JSON.stringify(request));
    const cli = spawnSync(process.execPath, ['src/cli/mergewitness.mjs', 'prepare', requestPath], { encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, error);
    assert.equal(cli.stdout, '');
    const mcp = spawnSync(process.execPath, ['src/mcp/server.mjs'], {
      encoding: 'utf8', input: [
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'prepare', arguments: request } },
      ].map(JSON.stringify).join('\n') + '\n',
    });
    assert.equal(mcp.status, 0, mcp.stderr);
    const [listed, rejected] = mcp.stdout.trim().split(/\r?\n/).map(JSON.parse);
    assert.deepEqual(listed.result.tools.find((tool) => tool.name === 'prepare').inputSchema.properties.testCommand.enum, [['node', '--test']]);
    assert.match(rejected.error.message, error);
    assert.equal(rejected.result, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('prepare uses a disposable clean merge and preserves passing ordinary tests', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    const testCommand = ['node', '--test'];
    analysis = prepare({
      repoPath: fixture.tenantRepo,
      baseRef: 'base',
      branchARef: 'tenant-pricing',
      branchBRef: 'sku-cache',
      testCommand,
    });
    testCommand[1] = 'regression.mjs';
    assert.deepEqual(__testing.analyses.get(analysis.analysisId).testCommand, ['node', '--test']);
    assert.deepEqual(JSON.parse(readFileSync(analysis.statePath, 'utf8')).testCommand, ['node', '--test']);
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

test('repair verification protects root tests, renamed tests, and accented test paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'mergewitness-root-test-'));
  const repo = join(root, 'repo');
  mkdirSync(repo);
  let analysis;
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git('init');
    git('config', 'user.name', 'MergeWitness');
    git('config', 'user.email', 'merge@example.invalid');
    const catalogTest = "import test from 'node:test'; import assert from 'node:assert/strict'; test('ordinary regression', () => assert.equal(1, 1));\n";
    const secondRootTest = "const test = require('node:test'); test('second root test', () => {});\n";
    writeFileSync(join(repo, 'catalog.test.mjs'), catalogTest);
    writeFileSync(join(repo, 'test.js'), secondRootTest);
    mkdirSync(join(repo, 'test'));
    writeFileSync(join(repo, 'test', 'ação.mjs'), catalogTest);
    git('add', '.');
    git('commit', '-m', 'Base with root test');
    git('tag', 'base');
    git('checkout', '-b', 'change-a');
    writeFileSync(join(repo, 'a.txt'), 'A\n');
    git('add', '.');
    git('commit', '-m', 'Change A');
    git('checkout', '-b', 'change-b', 'base');
    writeFileSync(join(repo, 'b.txt'), 'B\n');
    git('add', '.');
    git('commit', '-m', 'Change B');

    const probe = join(root, 'probe.mjs');
    const feature = join(root, 'feature.mjs');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'pass' }));\n");
    writeFileSync(feature, "console.log(JSON.stringify({ status: 'pass' }));\n");
    analysis = prepare({ repoPath: repo, baseRef: 'base', branchARef: 'change-a', branchBRef: 'change-b' });
    evaluate({ analysisId: analysis.analysisId, probePath: probe, featureCheckPaths: [feature], repetitions: 1 });

    const candidate = analysis.paths.merged;
    // Recreate the persisted command from analyses made before custom runners were restricted.
    const supportedState = readFileSync(analysis.statePath, 'utf8');
    const legacyState = JSON.parse(supportedState);
    legacyState.testCommand = ['node', 'regression.mjs'];
    writeFileSync(analysis.statePath, JSON.stringify(legacyState));
    __testing.analyses.delete(analysis.analysisId);
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, statePath: analysis.statePath, candidatePath: candidate }), /Unsupported testCommand/);
    assert.throws(() => evaluate({ analysisId: analysis.analysisId, statePath: analysis.statePath, probePath: probe, repetitions: 1 }), /Unsupported testCommand/);
    assert.deepEqual(JSON.parse(readFileSync(analysis.statePath, 'utf8')), legacyState, 'Rejection must preserve prior state.');
    writeFileSync(analysis.statePath, supportedState);
    __testing.analyses.delete(analysis.analysisId);
    assert.equal(verifyRepair({ analysisId: analysis.analysisId, statePath: analysis.statePath, candidatePath: candidate }).passed, true);

    writeFileSync(join(candidate, 'catalog.test.mjs'), '// ordinary regression removed\n');
    const add = spawnSync('git', ['add', '.'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(add.status, 0, add.stderr);
    const commit = spawnSync('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'Remove root test'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(commit.status, 0, commit.stderr);
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: candidate }), /Candidate changes protected test.*catalog\.test\.mjs/);

    writeFileSync(join(candidate, 'catalog.test.mjs'), catalogTest);
    writeFileSync(join(candidate, 'test.js'), '// second root test removed\n');
    const addSecond = spawnSync('git', ['add', '.'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(addSecond.status, 0, addSecond.stderr);
    const commitSecond = spawnSync('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'Remove test.js'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(commitSecond.status, 0, commitSecond.stderr);
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: candidate }), /Candidate changes protected test.*test\.js/);

    writeFileSync(join(candidate, 'test.js'), secondRootTest);
    renameSync(join(candidate, 'catalog.test.mjs'), join(candidate, 'catalog-check.mjs'));
    const addRename = spawnSync('git', ['add', '.'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(addRename.status, 0, addRename.stderr);
    const commitRename = spawnSync('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'Move regression outside test discovery'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(commitRename.status, 0, commitRename.stderr);
    const renameDiff = spawnSync('git', ['diff', '--name-status', '-M', `${analysis.merge.commit}..HEAD`], { cwd: candidate, encoding: 'utf8' });
    assert.equal(renameDiff.status, 0, renameDiff.stderr);
    assert.match(renameDiff.stdout, /R100\tcatalog\.test\.mjs\tcatalog-check\.mjs/);
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: candidate }), /Candidate changes protected test.*catalog\.test\.mjs/);

    renameSync(join(candidate, 'catalog-check.mjs'), join(candidate, 'catalog.test.mjs'));
    writeFileSync(join(candidate, 'test', 'ação.mjs'), '// regression removed\n');
    const addAccented = spawnSync('git', ['add', '.'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(addAccented.status, 0, addAccented.stderr);
    const commitAccented = spawnSync('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'Remove accented-path regression'], { cwd: candidate, encoding: 'utf8' });
    assert.equal(commitAccented.status, 0, commitAccented.stderr);
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: candidate }), /Candidate changes protected test.*test\/ação\.mjs/);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(root, { recursive: true, force: true });
  }
});

test('evaluation rejects a snapshot changed after preparation, even after the change is committed', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'passing.probe.mjs');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'pass' }));\n");
    const catalog = join(analysis.paths.merged, 'src', 'catalog.js');
    writeFileSync(catalog, '\n// uncommitted change\n', { flag: 'a' });
    assert.throws(() => evaluate({ analysisId: analysis.analysisId, probePath: probe, repetitions: 1 }), /merged snapshot must remain clean/);
    const committed = spawnSync('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-am', 'Changed merged snapshot'], { cwd: analysis.paths.merged, encoding: 'utf8' });
    assert.equal(committed.status, 0, committed.stderr);
    assert.throws(() => evaluate({ analysisId: analysis.analysisId, probePath: probe, repetitions: 1 }), /merged snapshot no longer matches its recorded commit and tree/);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('re-evaluation isolates dependencies and preserves earlier evidence when an attempt fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'mergewitness-evaluation-test-'));
  const repo = join(root, 'repo');
  mkdirSync(repo);
  const prepared = [];
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git('init');
    git('config', 'user.name', 'MergeWitness');
    git('config', 'user.email', 'merge@example.invalid');
    writeFileSync(join(repo, 'test.mjs'), "import test from 'node:test'; test('ordinary regression', () => {});\n");
    git('add', '.');
    git('commit', '-m', 'Base');
    git('tag', 'base');
    for (const branch of ['a', 'b']) {
      git('checkout', '-b', branch, 'base');
      writeFileSync(join(repo, `${branch}.txt`), `${branch}\n`);
      git('add', '.');
      git('commit', '-m', branch);
    }
    const makeAnalysis = () => {
      const analysis = prepare({ repoPath: repo, baseRef: 'base', branchARef: 'a', branchBRef: 'b' });
      prepared.push(analysis);
      return analysis;
    };
    const analysis = makeAnalysis();
    const probe = join(root, 'probe.mjs');
    const helper = join(root, 'helper.mjs');
    const feature = join(root, 'feature.mjs');
    const probeSource = "import { status } from './helper.mjs'; console.log(JSON.stringify({ status }));\n";
    const featureSource = "console.log(JSON.stringify({ status: 'pass' }));\n";
    writeFileSync(probe, probeSource);
    writeFileSync(helper, "export const status = 'pass';\n");
    writeFileSync(feature, featureSource);
    const request = { analysisId: analysis.analysisId, probePath: probe, featureCheckPaths: [feature], repetitions: 1 };
    const initial = evaluate({ ...request, probeDependencies: [helper] });
    assert.equal(initial.classification, 'no_witness_found');
    const preservedPaths = [analysis.statePath, initial.reportPath, ...initial.probeManifest.map((entry) => entry.frozen), ...initial.report.probe.featureChecks.map((entry) => entry.frozen)];
    const preservedBytes = new Map(preservedPaths.map((path) => [path, readFileSync(path)]));
    const assertPreserved = () => {
      for (const [path, contents] of preservedBytes) assert.deepEqual(readFileSync(path), contents, path);
      assert.deepEqual(__testing.analyses.get(analysis.analysisId).frozen, initial.report.probe);
    };

    assert.throws(() => evaluate({ ...request, probeDependencies: null }), /must be arrays/);
    assertPreserved();
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'fail' }));\n");
    assert.throws(() => evaluate({ ...request, probeDependencies: [join(root, 'missing.mjs')] }), /Probe file does not exist/);
    assertPreserved();
    writeFileSync(feature, "console.log(JSON.stringify({ status: 'fail' }));\n");
    assert.throws(() => evaluate({ ...request, featureCheckPaths: [feature, join(root, 'missing-feature.mjs')] }), /Feature check does not exist/);
    assertPreserved();
    writeFileSync(probe, "import { appendFileSync } from 'node:fs'; appendFileSync(new URL(import.meta.url), '\\n// mutated during evaluation\\n'); console.log(JSON.stringify({ status: 'pass' }));\n");
    assert.throws(() => evaluate(request), /Frozen probe or dependency changed/);
    assertPreserved();
    assert.equal(verifyRepair({ analysisId: analysis.analysisId, statePath: analysis.statePath, candidatePath: analysis.paths.merged }).passed, true);

    writeFileSync(probe, probeSource);
    writeFileSync(feature, featureSource);
    const repeated = evaluate(request);
    const fresh = makeAnalysis();
    const freshResult = evaluate({ ...request, analysisId: fresh.analysisId });
    assert.equal(repeated.classification, 'inconclusive');
    assert.equal(freshResult.classification, repeated.classification);
    for (const key of ['base', 'branchA', 'branchB', 'merged']) {
      assert.equal(repeated.matrix[key].kind, freshResult.matrix[key].kind);
      assert.match(repeated.matrix[key].runs[0].stderr, /ERR_MODULE_NOT_FOUND/);
    }
    assert.equal(repeated.probeManifest.length, 1);
    assert.notEqual(dirname(repeated.probePath), dirname(initial.probePath));
    assert.notEqual(repeated.report.probe.featureChecks[0].frozen, initial.report.probe.featureChecks[0].frozen);
    assert.notEqual(repeated.reportPath, initial.reportPath);
    for (const [path, contents] of preservedBytes) {
      if (path !== analysis.statePath) assert.deepEqual(readFileSync(path), contents, path);
    }
    assert.equal(verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }).passed, false);
  } finally {
    for (const analysis of prepared) dispose({ analysisId: analysis.analysisId });
    rmSync(root, { recursive: true, force: true });
  }
});

test('repair verification detects frozen dependency changes before and after execution', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'dependency.probe.mjs');
    const helper = join(fixture.root, 'helper.mjs');
    const feature = join(fixture.root, 'mutating.feature.mjs');
    writeFileSync(helper, "export const status = 'pass';\n");
    writeFileSync(probe, "import { status } from './helper.mjs'; console.log(JSON.stringify({ status }));\n");
    writeFileSync(feature, `import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../frozen-probe/helper.mjs', import.meta.url), "export const status = 'pass'; // changed during verification\\n"); console.log(JSON.stringify({ status: 'pass' }));\n`);
    const evaluated = evaluate({ analysisId: analysis.analysisId, probePath: probe, probeDependencies: [helper], featureCheckPaths: [feature], repetitions: 1 });
    const frozenHelper = evaluated.probeManifest.find((entry) => entry.source === helper).frozen;
    assert.equal(evaluated.classification, 'no_witness_found');
    const frozenProbeBefore = readFileSync(evaluated.probePath, 'utf8');
    writeFileSync(frozenHelper, "export const status = 'pass'; // changed before verification\n");
    assert.equal(readFileSync(evaluated.probePath, 'utf8'), frozenProbeBefore);
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }), /Frozen probe or dependency changed/);
    writeFileSync(frozenHelper, readFileSync(helper, 'utf8'));
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }), /Frozen probe or dependency changed/);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('repair verification rejects candidate and frozen-check changes made by a passing check', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'passing.probe.mjs');
    const passingFeature = join(fixture.root, 'passing.feature.mjs');
    const mutatingFeature = join(fixture.root, 'mutating.feature.mjs');
    const modePath = join(fixture.root, 'mutation-mode.txt');
    const catalog = join(analysis.paths.merged, 'src', 'catalog.js');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'pass' }));\n");
    writeFileSync(passingFeature, "console.log(JSON.stringify({ status: 'pass' }));\n");
    writeFileSync(mutatingFeature, `
      import { appendFileSync, readFileSync } from 'node:fs';
      import { spawnSync } from 'node:child_process';
      const mode = readFileSync(${JSON.stringify(modePath)}, 'utf8').trim();
      if (mode === 'candidate' || mode === 'commit') appendFileSync(${JSON.stringify(catalog)}, ${JSON.stringify('\n// changed during verification\n')});
      if (mode === 'frozen') appendFileSync(new URL('./passing.feature.mjs', import.meta.url), ${JSON.stringify('\n// changed after its check ran\n')});
      if (mode === 'commit') {
        const add = spawnSync('git', ['add', '--', 'src/catalog.js'], { encoding: 'utf8' });
        if (add.status !== 0) throw new Error(add.stderr);
        const commit = spawnSync('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'Mutated during verification'], { encoding: 'utf8' });
        if (commit.status !== 0) throw new Error(commit.stderr);
      }
      console.log(JSON.stringify({ status: 'pass' }));
    `);
    writeFileSync(modePath, 'candidate');
    const evaluated = evaluate({ analysisId: analysis.analysisId, probePath: probe, featureCheckPaths: [passingFeature, mutatingFeature], repetitions: 1 });
    const frozenEarlierCheck = evaluated.report.probe.featureChecks.find((entry) => entry.source === passingFeature).frozen;

    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }), /Candidate worktree changed during repair verification/);
    const restore = spawnSync('git', ['restore', '--', 'src/catalog.js'], { cwd: analysis.paths.merged, encoding: 'utf8' });
    assert.equal(restore.status, 0, restore.stderr);

    writeFileSync(modePath, 'frozen');
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }), /Frozen feature check changed/);
    writeFileSync(frozenEarlierCheck, readFileSync(passingFeature, 'utf8'));

    writeFileSync(modePath, 'commit');
    assert.throws(() => verifyRepair({ analysisId: analysis.analysisId, candidatePath: analysis.paths.merged }), /Candidate commit or tree changed during repair verification/);
  } finally {
    if (analysis) dispose({ analysisId: analysis.analysisId });
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('CLI writes a failed verification report and exits nonzero', () => {
  const fixture = fixtureRepo();
  let analysis;
  try {
    analysis = prepare({ repoPath: fixture.tenantRepo, baseRef: 'base', branchARef: 'tenant-pricing', branchBRef: 'sku-cache' });
    const probe = join(fixture.root, 'failing.probe.mjs');
    const feature = join(fixture.root, 'passing.feature.mjs');
    writeFileSync(probe, "console.log(JSON.stringify({ status: 'fail', observed: 'still broken' }));\n");
    writeFileSync(feature, "console.log(JSON.stringify({ status: 'pass' }));\n");
    evaluate({ analysisId: analysis.analysisId, probePath: probe, featureCheckPaths: [feature], repetitions: 1 });
    const request = join(fixture.root, 'verify-request.json');
    const response = join(fixture.root, 'verify-response.json');
    writeFileSync(request, JSON.stringify({ analysisId: analysis.analysisId, statePath: analysis.statePath, candidatePath: analysis.paths.merged }));
    const cli = spawnSync('node', [resolve('src/cli/mergewitness.mjs'), 'verify-repair', request, response], { encoding: 'utf8', shell: false });
    assert.equal(cli.status, 1, cli.stderr);
    assert.equal(JSON.parse(readFileSync(response, 'utf8')).passed, false);
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
