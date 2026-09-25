#!/usr/bin/env node
// Measure Bob's untouched tenant-cache probe separately from the audit probe.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, prepare } from '../src/core/mergeWitness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'fixtures', '.generated', 'tenant-cache-history');
if (!existsSync(fixture)) throw new Error('Generate the synthetic fixtures first: node scripts/run-lab.mjs');

// Trust only this generated fixture in this process, without changing Git's global config.
const configIndex = Number(process.env.GIT_CONFIG_COUNT ?? 0);
if (!Number.isSafeInteger(configIndex) || configIndex < 0) throw new Error('Invalid GIT_CONFIG_COUNT');
process.env[`GIT_CONFIG_KEY_${configIndex}`] = 'safe.directory';
process.env[`GIT_CONFIG_VALUE_${configIndex}`] = fixture.replaceAll('\\', '/');
process.env.GIT_CONFIG_COUNT = String(configIndex + 1);

const probe = join(root, 'src', 'bob-probes', 'tenant-cache.probe.mjs');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const prepared = prepare({
  repoPath: fixture,
  baseRef: 'base',
  branchARef: 'tenant-pricing',
  branchBRef: 'sku-cache',
  testCommand: ['node', '--test'],
});
const evaluated = evaluate({
  analysisId: prepared.analysisId,
  statePath: prepared.statePath,
  probePath: probe,
  repetitions: 3,
});
const matrix = Object.fromEntries(Object.entries(evaluated.matrix).map(([name, entry]) => [name, {
  status: entry.kind,
  consistent: entry.consistent,
  evidence: entry.runs.map((run) => run.probe.payload?.evidence ?? null),
}]));
const passed = prepared.merge.clean
  && Object.values(prepared.normalTests).every((entry) => entry.exitCode === 0)
  && evaluated.classification === 'interaction_witness'
  && evaluated.probeHash === hash(probe)
  && ['base', 'branchA', 'branchB'].every((name) => matrix[name].status === 'pass' && matrix[name].consistent && matrix[name].evidence.length === 3)
  && matrix.merged.status === 'fail' && matrix.merged.consistent
  && matrix.merged.evidence.length === 3
  && matrix.merged.evidence.every((entry) => entry?.expected === 100 && entry?.observed === 90);
const report = {
  version: 1,
  scenario: 'tenant-cache',
  stage: 'Bob-original-probe-evaluation',
  passed,
  bobTaskId: 'fad890dd4396030a3cdd86588dbbf59f',
  bobTaskSummary: 'bob_sessions/01-tenant-cache-probe-summary.png',
  source: {
    fixture: 'synthetic tenant-cache-history',
    refs: prepared.refs,
    commits: prepared.commits,
    trees: evaluated.report.trees,
  },
  merge: { clean: prepared.merge.clean, commit: prepared.merge.commit },
  normalTests: Object.fromEntries(Object.entries(prepared.normalTests).map(([name, entry]) => [name, { exitCode: entry.exitCode }])),
  classification: evaluated.classification,
  repetitions: evaluated.repetitions,
  bobOriginalProbe: { name: 'tenant-cache.probe.mjs', sha256: hash(probe) },
  frozenProbe: {
    sha256: evaluated.probeHash,
    files: evaluated.probeManifest.map((entry) => ({ name: entry.frozen.split(/[\\/]/).at(-1), sha256: entry.hash })),
  },
  matrix,
  limitation: 'This is a separate measurement of Bob\'s original fixed-price probe. The final repair verification uses an independently strengthened derivative and independent cache check.',
};
mkdirSync(join(root, 'reports'), { recursive: true });
const output = join(root, 'reports', 'tenant-cache-bob-original.public.json');
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ report: 'reports/tenant-cache-bob-original.public.json', passed, classification: report.classification, matrix: Object.fromEntries(Object.entries(matrix).map(([name, entry]) => [name, entry.status])) }, null, 2)}\n`);
process.exitCode = passed ? 0 : 1;
