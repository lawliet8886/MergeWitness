import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('repair report stays bound to its original evaluation after another run', { timeout: 180_000 }, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'mergewitness-report-binding-'));
  const copiedRepo = join(scratch, 'repo');
  const analysisRoots = [];
  const run = (command, args, cwd = copiedRepo) => spawnSync(command, args, { cwd, encoding: 'utf8', shell: false, timeout: 60_000 });
  const success = (result) => {
    assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  const rememberAnalysis = (result) => {
    const analysis = JSON.parse(result.stdout);
    analysisRoots.push(dirname(analysis.statePath));
    return analysis;
  };
  try {
    mkdirSync(copiedRepo);
    cpSync(join(source, 'src'), join(copiedRepo, 'src'), { recursive: true });
    cpSync(join(source, 'scripts'), join(copiedRepo, 'scripts'), { recursive: true });
    mkdirSync(join(copiedRepo, 'fixtures'));
    copyFileSync(join(source, 'fixtures/create-fixtures.mjs'), join(copiedRepo, 'fixtures/create-fixtures.mjs'));

    const original = rememberAnalysis(success(run(process.execPath, ['scripts/run-lab.mjs'])));
    assert.equal(original.classification, 'interaction_witness');
    const evaluationPath = join(copiedRepo, 'reports/tenant-cache-evaluation.public.json');
    const originalEvaluation = readFileSync(evaluationPath);

    // A later experiment replaces the public report while the first repair is pending.
    writeFileSync(join(copiedRepo, 'src/bob-probes/tenant-cache.shared-fresh.probe.mjs'), "console.log(JSON.stringify({status:'pass',evidence:{revision:'second-probe'}}));\n");
    const secondRun = run(process.execPath, ['scripts/run-lab.mjs']);
    assert.equal(secondRun.status, 1, secondRun.stderr);
    const second = rememberAnalysis(secondRun);
    assert.equal(second.classification, 'no_witness_found');

    const retainedArtifact = join(copiedRepo, 'src/bob-repairs/tenant-cache/catalog.fixed.js');
    copyFileSync(retainedArtifact, join(original.candidatePath, 'src/catalog.js'));
    success(run('git', ['add', '--', 'src/catalog.js'], original.candidatePath));
    success(run('git', ['-c', 'user.name=MergeWitness Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Apply retained repair'], original.candidatePath));
    const repairArgs = ['scripts/run-lab.mjs', '--state', original.statePath, '--candidate', original.candidatePath, '--retained-artifact', retainedArtifact];
    const repairPath = join(copiedRepo, 'reports/tenant-cache-repair.public.json');
    const priorRepair = '{"preserve":"previous repair artifact"}\n';
    writeFileSync(repairPath, priorRepair);

    const rejected = run(process.execPath, repairArgs);
    assert.equal(rejected.status, 1, rejected.stdout);
    assert.match(rejected.stderr, /Public evaluation report does not match the supplied analysis state/);
    assert.equal(readFileSync(repairPath, 'utf8'), priorRepair, 'A rejected binding must preserve an existing public repair report.');

    writeFileSync(evaluationPath, originalEvaluation);
    const accepted = success(run(process.execPath, repairArgs));
    assert.equal(JSON.parse(accepted.stdout).passed, true);
    const report = JSON.parse(readFileSync(repairPath, 'utf8'));
    const evaluation = JSON.parse(originalEvaluation);
    assert.equal(report.passed, true);
    assert.equal(report.evaluationPublicReportSha256, createHash('sha256').update(originalEvaluation).digest('hex'));
    assert.equal(report.frozenProbeHash, evaluation.probe.sha256);
    assert.equal(report.sourceMergedCommit, evaluation.source.commits.merged);
    assert.equal(report.sourceMergedTree, evaluation.source.trees.merged);
    assert.equal(report.evaluationClassification, evaluation.classification);
  } finally {
    // Remove only roots created by this test and returned by the fixture workflow.
    for (const analysisRoot of analysisRoots) {
      const rel = relative(resolve(tmpdir()), resolve(analysisRoot));
      assert.ok(rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.includes(sep) && rel.startsWith('mergewitness-'));
      rmSync(analysisRoot, { recursive: true, force: true });
    }
    rmSync(scratch, { recursive: true, force: true });
  }
});
