#!/usr/bin/env node
// Independently measure Bob's second synthetic interaction probe.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, prepare } from '../src/core/mergeWitness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'fixtures', '.generated', 'priority-cursor-history');
// The generated local fixture may be owned by the sandbox account on Windows.
// Trust only this exact synthetic repo for this process and its Git children.
const configIndex = Number(process.env.GIT_CONFIG_COUNT ?? 0);
if (!Number.isSafeInteger(configIndex) || configIndex < 0) throw new Error('Invalid GIT_CONFIG_COUNT');
process.env[`GIT_CONFIG_KEY_${configIndex}`] = 'safe.directory';
process.env[`GIT_CONFIG_VALUE_${configIndex}`] = fixture.replaceAll('\\', '/');
process.env.GIT_CONFIG_COUNT = String(configIndex + 1);
const probe = join(root, 'src', 'bob-probes', 'priority-cursor.probe.mjs');
const checks = ['priority-order.check.mjs', 'id-cursor.check.mjs'].map((name) => join(root, 'src', 'bob-probes', name));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function runCheck(path, file) {
  const run = spawnSync('node', [file], { cwd: path, encoding: 'utf8', shell: false, timeout: 30_000 });
  const lines = (run.stdout ?? '').trim().split(/\r?\n/);
  let result;
  try { result = JSON.parse(lines.at(-1)); } catch { result = null; }
  return { exitCode: run.status, status: result?.status ?? 'invalid_output', evidence: result?.evidence ?? null };
}

const prepared = prepare({ repoPath: fixture, baseRef: 'base', branchARef: 'priority-order', branchBRef: 'id-cursor', testCommand: ['node', '--test'] });
const evaluated = evaluate({ analysisId: prepared.analysisId, statePath: prepared.statePath, probePath: probe, featureCheckPaths: checks, repetitions: 3 });
const matrix = Object.fromEntries(Object.entries(evaluated.matrix).map(([name, entry]) => [name, {
  status: entry.kind,
  consistent: entry.consistent,
  evidence: entry.runs.map((run) => run.probe.payload?.evidence ?? null),
}]));
const featureChecks = checks.map((file) => ({ name: file.split(/[\\/]/).at(-1), sha256: hash(file), ...runCheck(prepared.paths.merged, file) }));
const passed = evaluated.classification === 'interaction_witness'
  && Object.values(prepared.normalTests).every((entry) => entry.exitCode === 0)
  && featureChecks.every((entry) => entry.exitCode === 0 && entry.status === 'pass');
const report = {
  version: 1,
  scenario: 'priority-cursor',
  stage: 'Bob-original-probe-evaluation',
  passed,
  bobTaskId: '4901e274fb4230386d1463da9b82ce4f',
  bobTaskSummary: 'bob_sessions/03-priority-cursor-probe-summary.png',
  source: { fixture: 'synthetic priority-cursor-history', refs: prepared.refs, commits: prepared.commits, trees: evaluated.report.trees },
  merge: { clean: prepared.merge.clean, commit: prepared.merge.commit },
  normalTests: Object.fromEntries(Object.entries(prepared.normalTests).map(([name, entry]) => [name, { exitCode: entry.exitCode }])),
  classification: evaluated.classification,
  repetitions: evaluated.repetitions,
  bobOriginals: [{ name: 'priority-cursor.probe.mjs', sha256: hash(probe) }, ...checks.map((file) => ({ name: file.split(/[\\/]/).at(-1), sha256: hash(file) }))],
  frozenProbe: { sha256: evaluated.probeHash, files: evaluated.probeManifest.map((entry) => ({ name: entry.frozen.split(/[\\/]/).at(-1), sha256: entry.hash })) },
  matrix,
  featureChecks,
  limitation: 'One synthetic fixture and one explicitly authored invariant; no general merge-safety guarantee or repair verification for this second scenario.',
};
mkdirSync(join(root, 'reports'), { recursive: true });
const output = join(root, 'reports', 'priority-cursor-evaluation.public.json');
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ report: 'reports/priority-cursor-evaluation.public.json', passed, classification: report.classification, matrix: Object.fromEntries(Object.entries(matrix).map(([k, v]) => [k, v.status])) }, null, 2)}\n`);
process.exitCode = passed ? 0 : 1;
