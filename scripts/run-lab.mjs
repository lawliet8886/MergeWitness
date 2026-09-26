#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { evaluate, prepare, verifyRepair } from '../src/core/mergeWitness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reports = join(root, 'reports');
const bobProbes = join(root, 'src', 'bob-probes');
const args = process.argv.slice(2);
const valueAfter = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const statePath = valueAfter('--state');
const candidatePath = valueAfter('--candidate');
const retainedArtifactPath = valueAfter('--retained-artifact');

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeReport(name, payload) {
  mkdirSync(reports, { recursive: true });
  const path = join(reports, name);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

function publicMatrix(matrix) {
  return Object.fromEntries(Object.entries(matrix).map(([snapshot, entry]) => [snapshot, {
    status: entry.kind,
    consistent: entry.consistent,
    evidence: entry.runs.map((run) => run.probe.payload?.evidence ?? null),
  }]));
}

function readMatchingEvaluationReport(state, path) {
  if (!existsSync(path)) throw new Error('Run evaluation before repair verification so its public report can be attested.');
  if (!state.frozen) throw new Error('The supplied analysis state has no frozen evaluation.');
  const bytes = readFileSync(path);
  const report = JSON.parse(bytes.toString('utf8'));
  const expected = {
    version: 1,
    scenario: 'tenant-cache',
    stage: 'evaluation',
    refs: state.refs,
    commits: state.commits,
    trees: state.trees,
    merge: { clean: state.merge.clean, commit: state.merge.commit },
    normalTests: Object.fromEntries(Object.entries(state.normalTests).map(([name, result]) => [name, { exitCode: result.exitCode }])),
    classification: state.frozen.classification,
    repetitions: state.frozen.repetitions,
    probe: { sha256: state.frozen.probeHash, files: state.frozen.manifest.map((entry) => ({ name: basename(entry.frozen), sha256: entry.hash })) },
    featureChecks: state.frozen.featureChecks.map((entry) => ({ name: basename(entry.frozen), sha256: entry.hash })),
    matrix: publicMatrix(state.frozen.matrix),
  };
  const observed = { ...report, refs: report.source?.refs, commits: report.source?.commits, trees: report.source?.trees };
  for (const [field, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(observed[field], value)) {
      throw new Error(`Public evaluation report does not match the supplied analysis state (${field}). Restore the evaluation report for this state before verifying its repair.`);
    }
  }
  return bytes;
}

if (candidatePath) {
  if (!statePath) throw new Error('--candidate requires --state <analysis-state.json>.');
  const state = JSON.parse(readFileSync(resolve(statePath), 'utf8'));
  const evaluationReportPath = join(reports, 'tenant-cache-evaluation.public.json');
  const evaluationReportBytes = readMatchingEvaluationReport(state, evaluationReportPath);
  const verified = verifyRepair({ analysisId: state.id, statePath, candidatePath });
  if (!readFileSync(evaluationReportPath).equals(evaluationReportBytes)) {
    throw new Error('Public evaluation report changed during repair verification. No public repair report was written.');
  }
  const candidateCatalog = join(resolve(candidatePath), 'src', 'catalog.js');
  if (!existsSync(candidateCatalog)) throw new Error('Candidate does not contain src/catalog.js.');
  const retainedArtifact = retainedArtifactPath ? resolve(retainedArtifactPath) : null;
  if (retainedArtifact && !existsSync(retainedArtifact)) throw new Error('retained artifact does not exist.');
  const retainedMatchesCandidate = retainedArtifact ? sha256(retainedArtifact) === sha256(candidateCatalog) : false;
  const passed = verified.passed && retainedMatchesCandidate;
  const report = {
    version: 1,
    scenario: 'tenant-cache',
    stage: 'repair-verification',
    passed,
    coreVerificationPassed: verified.passed,
    normalTestsExitCode: verified.normalTests.exitCode,
    probe: { status: verified.probe.kind, consistent: verified.probe.consistent },
    featureChecks: verified.featureChecks.map((check) => ({ name: basename(check.source), sha256: check.hash, status: check.result.kind, consistent: check.result.consistent })),
    changedFiles: verified.changedFiles,
    candidateCommit: verified.candidateHead,
    candidateTree: verified.candidateTree,
    sourceMergedCommit: verified.sourceMergedCommit,
    sourceMergedTree: verified.sourceMergedTree,
    evaluationClassification: verified.evaluationClassification,
    evaluationPublicReportSha256: createHash('sha256').update(evaluationReportBytes).digest('hex'),
    testedCatalog: { path: 'src/catalog.js', sha256: sha256(candidateCatalog) },
    retainedArtifact: retainedArtifact
      ? { name: basename(retainedArtifact), sha256: sha256(retainedArtifact), matchesTestedCatalog: retainedMatchesCandidate }
      : { status: 'not_supplied' },
    frozenProbeHash: verified.frozenProbeHash,
  };
  const path = writeReport('tenant-cache-repair.public.json', report);
  process.stdout.write(`${JSON.stringify({ report: 'reports/tenant-cache-repair.public.json', passed, statePath, candidatePath }, null, 2)}\n`);
  process.exitCode = passed ? 0 : 1;
} else {
  const generated = spawnSync('node', ['fixtures/create-fixtures.mjs'], { cwd: root, encoding: 'utf8', shell: false });
  if (generated.status !== 0) throw new Error(generated.stderr.trim());
  const prepared = prepare({
    repoPath: join(root, 'fixtures', '.generated', 'tenant-cache-history'),
    baseRef: 'base',
    branchARef: 'tenant-pricing',
    branchBRef: 'sku-cache',
    testCommand: ['node', '--test'],
  });
  const evaluated = evaluate({
    analysisId: prepared.analysisId,
    statePath: prepared.statePath,
    probePath: join(root, 'src', 'bob-probes', 'tenant-cache.shared-fresh.probe.mjs'),
    featureCheckPaths: [
      join(root, 'src', 'bob-probes', 'tenant-pricing.check.mjs'),
      join(root, 'src', 'bob-probes', 'sku-cache.proxy.check.mjs'),
    ],
    repetitions: 3,
  });
  const report = {
    version: 1,
    scenario: 'tenant-cache',
    stage: 'evaluation',
    source: { fixture: 'synthetic tenant-cache-history', refs: prepared.refs, commits: prepared.commits, trees: evaluated.report.trees },
    merge: { clean: prepared.merge.clean, commit: prepared.merge.commit },
    normalTests: Object.fromEntries(Object.entries(prepared.normalTests).map(([name, result]) => [name, { exitCode: result.exitCode }])),
    classification: evaluated.classification,
    repetitions: evaluated.repetitions,
    bobTaskArtifacts: {
      untouchedOriginals: [
        { name: 'tenant-cache.probe.mjs', sha256: sha256(join(bobProbes, 'tenant-cache.probe.mjs')) },
        { name: 'sku-cache.check.mjs', sha256: sha256(join(bobProbes, 'sku-cache.check.mjs')) },
      ],
      auditDerivatives: [
        { name: 'tenant-cache.shared-fresh.probe.mjs', sha256: sha256(join(bobProbes, 'tenant-cache.shared-fresh.probe.mjs')) },
        { name: 'sku-cache.proxy.check.mjs', sha256: sha256(join(bobProbes, 'sku-cache.proxy.check.mjs')) },
      ],
    },
    probe: { sha256: evaluated.probeHash, files: evaluated.probeManifest.map((entry) => ({ name: basename(entry.frozen), sha256: entry.hash })) },
    featureChecks: evaluated.probeManifest ? evaluated.report.probe.featureChecks.map((entry) => ({ name: basename(entry.frozen), sha256: entry.hash })) : [],
    matrix: publicMatrix(evaluated.matrix),
  };
  writeReport('tenant-cache-evaluation.public.json', report);
  process.stdout.write(`${JSON.stringify({ report: 'reports/tenant-cache-evaluation.public.json', classification: evaluated.classification, statePath: prepared.statePath, candidatePath: prepared.paths.merged }, null, 2)}\n`);
  process.exitCode = evaluated.classification === 'interaction_witness' ? 0 : 1;
}
