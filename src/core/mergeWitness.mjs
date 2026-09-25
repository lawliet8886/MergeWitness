import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const analyses = new Map();

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeoutMs ?? 30_000,
    env: { ...process.env, ...options.env },
  });
  return {
    command: [command, ...args],
    exitCode: result.status ?? (result.error ? -1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error?.message ?? ''),
    timedOut: result.signal === 'SIGTERM' || result.signal === 'SIGKILL',
  };
}

function git(cwd, ...args) {
  const result = run('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function assertTrustedDirectory(path) {
  if (!path || !existsSync(path)) throw new Error('A trusted local repository path is required.');
  if (git(path, 'rev-parse', '--is-inside-work-tree') !== 'true') {
    throw new Error('repoPath must be a local Git work tree.');
  }
}

function resolveRef(repoPath, ref) {
  return git(repoPath, 'rev-parse', `${ref}^{commit}`);
}

function createWorktree(clonePath, label, commit) {
  const path = join(clonePath, 'snapshots', label);
  git(clonePath, 'worktree', 'add', '--detach', path, commit);
  return path;
}

function runCommand(cwd, command, args) {
  return run(command, args, { cwd, timeoutMs: 30_000 });
}

function testSnapshot(path, testCommand) {
  const [command, ...args] = testCommand;
  return runCommand(path, command, args);
}

function publicAnalysis(analysis) {
  return {
    analysisId: analysis.id,
    source: analysis.source,
    refs: analysis.refs,
    commits: analysis.commits,
    paths: analysis.paths,
    normalTests: analysis.normalTests,
    merge: analysis.merge,
    statePath: analysis.statePath,
  };
}

function saveState(analysis) {
  analysis.statePath ??= join(analysis.root, 'analysis-state.json');
  const serializable = {
    id: analysis.id, source: analysis.source, root: analysis.root, clonePath: analysis.clonePath,
    refs: analysis.refs, commits: analysis.commits, paths: analysis.paths, merge: analysis.merge,
    normalTests: analysis.normalTests, testCommand: analysis.testCommand, trees: analysis.trees,
    frozen: analysis.frozen ?? null, statePath: analysis.statePath,
  };
  writeFileSync(analysis.statePath, `${JSON.stringify(serializable, null, 2)}\n`);
}

function loadAnalysis(analysisId, statePath) {
  if (!statePath) return getAnalysis(analysisId);
  const resolvedState = resolve(statePath);
  if (!existsSync(resolvedState)) throw new Error(`Analysis state does not exist: ${resolvedState}`);
  const loaded = JSON.parse(readFileSync(resolvedState, 'utf8'));
  if (loaded.id !== analysisId) throw new Error('analysisId does not match the supplied statePath.');
  if (!existsSync(loaded.clonePath)) throw new Error('Disposable analysis clone is no longer available.');
  analyses.set(loaded.id, loaded);
  return loaded;
}

function treeId(path, commit) {
  return git(path, 'rev-parse', `${commit}^{tree}`);
}

/**
 * Creates disposable worktrees from a trusted local repository. It never writes
 * to the source repository: all merge work happens in the private clone.
 */
export function prepare({ repoPath, baseRef, branchARef, branchBRef, testCommand = ['node', '--test'] }) {
  const source = resolve(repoPath);
  assertTrustedDirectory(source);
  if (!Array.isArray(testCommand) || testCommand.length === 0) throw new Error('testCommand must be a non-empty argv array.');

  const commits = {
    base: resolveRef(source, baseRef),
    branchA: resolveRef(source, branchARef),
    branchB: resolveRef(source, branchBRef),
  };
  const root = mkdtempSync(join(tmpdir(), 'mergewitness-'));
  const clonePath = join(root, 'clone');
  const clone = run('git', ['clone', '--no-local', '--no-hardlinks', source, clonePath]);
  if (clone.exitCode !== 0) throw new Error(`Could not create isolated clone: ${clone.stderr.trim()}`);
  mkdirSync(join(clonePath, 'snapshots'));

  const paths = {
    base: createWorktree(clonePath, 'base', commits.base),
    branchA: createWorktree(clonePath, 'branch-a', commits.branchA),
    branchB: createWorktree(clonePath, 'branch-b', commits.branchB),
    merged: createWorktree(clonePath, 'merged', commits.base),
  };
  const mergeA = run('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'merge', '--no-ff', '--no-commit', commits.branchA], { cwd: paths.merged });
  let merge;
  if (mergeA.exitCode !== 0) {
    merge = { clean: false, stage: 'branchA', ...mergeA };
  } else {
    const commitA = run('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'MergeWitness snapshot branch A'], { cwd: paths.merged });
    if (commitA.exitCode !== 0) throw new Error(`Could not commit disposable branch A snapshot: ${commitA.stderr.trim()}`);
    const mergeB = run('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'merge', '--no-ff', '--no-commit', commits.branchB], { cwd: paths.merged });
    if (mergeB.exitCode !== 0) {
      merge = { clean: false, stage: 'branchB', ...mergeB };
    } else {
      const commit = run('git', ['-c', 'user.name=MergeWitness', '-c', 'user.email=merge@example.invalid', 'commit', '-m', 'MergeWitness combined snapshot'], { cwd: paths.merged });
      if (commit.exitCode !== 0) throw new Error(`Could not commit disposable merge: ${commit.stderr.trim()}`);
      commits.merged = git(paths.merged, 'rev-parse', 'HEAD');
      merge = { clean: true, commit: commits.merged };
    }
  }

  const normalTests = {};
  for (const key of ['base', 'branchA', 'branchB']) normalTests[key] = testSnapshot(paths[key], testCommand);
  normalTests.merged = merge.clean ? testSnapshot(paths.merged, testCommand) : { exitCode: null, stdout: '', stderr: merge.stderr, skipped: true };

  const id = randomUUID();
  const analysis = {
    id, source, root, clonePath, refs: { baseRef, branchARef, branchBRef }, commits,
    paths, merge, normalTests, testCommand, frozen: null,
  };
  analysis.trees = Object.fromEntries(Object.entries(commits).map(([name, commit]) => [name, treeId(clonePath, commit)]));
  analyses.set(id, analysis);
  saveState(analysis);
  return publicAnalysis(analysis);
}

function getAnalysis(id) {
  const analysis = analyses.get(id);
  if (!analysis) throw new Error(`Unknown analysisId ${id}. Analyses are local to this process.`);
  return analysis;
}

function readProbeStatus(runResult) {
  if (runResult.timedOut) return { kind: 'inconclusive', reason: 'timeout' };
  if (runResult.exitCode !== 0) return { kind: 'inconclusive', reason: 'nonzero_exit' };
  const lastLine = runResult.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!lastLine) return { kind: 'inconclusive', reason: 'missing_structured_result' };
  try {
    const payload = JSON.parse(lastLine);
    if (payload?.status === 'pass' || payload?.status === 'fail') return { kind: payload.status, payload };
    return { kind: 'inconclusive', reason: 'invalid_status' };
  } catch {
    return { kind: 'inconclusive', reason: 'invalid_json' };
  }
}

function probeSnapshot(path, probePath, repetitions) {
  const runs = [];
  for (let index = 0; index < repetitions; index += 1) {
    const result = run('node', [probePath], { cwd: path, timeoutMs: 15_000 });
    runs.push({ ...result, probe: readProbeStatus(result) });
  }
  const signatures = new Set(runs.map((entry) => JSON.stringify(entry.probe)));
  const consistent = signatures.size === 1;
  const kind = consistent ? runs[0].probe.kind : 'inconclusive';
  return { kind, consistent, runs };
}

function normalTestsAllPass(analysis) {
  return Object.values(analysis.normalTests).every((entry) => entry.exitCode === 0);
}

function freezeProbe(analysis, probePath, probeDependencies) {
  const originalProbe = resolve(probePath);
  const originalDir = dirname(originalProbe);
  const frozenRoot = join(analysis.root, 'frozen-probe');
  mkdirSync(frozenRoot, { recursive: true });
  const files = [originalProbe, ...probeDependencies.map((entry) => resolve(entry))];
  const manifest = [];
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`Probe file does not exist: ${file}`);
    const rel = relative(originalDir, file);
    if (rel.startsWith(`..${sep}`) || rel === '..' || rel.includes(`${sep}..${sep}`)) {
      throw new Error('Probe dependencies must live under the probe directory.');
    }
    const destination = join(frozenRoot, rel || basename(file));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file, destination);
    manifest.push({ source: file, frozen: destination, hash: sha256(destination) });
  }
  return { probePath: join(frozenRoot, basename(originalProbe)), manifest };
}

function freezeFeatureChecks(analysis, featureCheckPaths) {
  const frozenRoot = join(analysis.root, 'frozen-feature-checks');
  mkdirSync(frozenRoot, { recursive: true });
  const seen = new Set();
  return featureCheckPaths.map((input) => {
    const source = resolve(input);
    if (!existsSync(source)) throw new Error(`Feature check does not exist: ${input}`);
    const name = basename(source);
    if (seen.has(name)) throw new Error(`Feature checks must have distinct basenames: ${name}`);
    seen.add(name);
    const frozen = join(frozenRoot, name);
    copyFileSync(source, frozen);
    return { source, frozen, hash: sha256(frozen) };
  });
}

export function evaluate({ analysisId, statePath, probePath, probeDependencies = [], featureCheckPaths = [], repetitions = 3 }) {
  const analysis = loadAnalysis(analysisId, statePath);
  if (!Array.isArray(probeDependencies) || !Array.isArray(featureCheckPaths)) throw new Error('probeDependencies and featureCheckPaths must be arrays.');
  if (!analysis.merge.clean) return { analysisId, classification: 'text_conflict', merge: analysis.merge };
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error('repetitions must be an integer from 1 to 10.');

  const frozen = freezeProbe(analysis, probePath, probeDependencies);
  const frozenFeatureChecks = freezeFeatureChecks(analysis, featureCheckPaths);
  const frozenProbe = frozen.probePath;
  const probeHash = sha256(frozenProbe);
  const matrix = {};
  for (const key of ['base', 'branchA', 'branchB', 'merged']) matrix[key] = probeSnapshot(analysis.paths[key], frozenProbe, repetitions);

  let classification;
  if (!normalTestsAllPass(analysis)) classification = 'ordinary_test_failure';
  else if (Object.values(matrix).some((entry) => entry.kind === 'inconclusive')) classification = 'inconclusive';
  else if (matrix.base.kind === 'fail') classification = 'preexisting_violation';
  else if (matrix.branchA.kind === 'fail' || matrix.branchB.kind === 'fail') classification = 'branch_violation';
  else if (matrix.merged.kind === 'fail') classification = 'interaction_witness';
  else classification = 'no_witness_found';

  analysis.frozen = { probePath: frozenProbe, probeHash, manifest: frozen.manifest, featureChecks: frozenFeatureChecks, repetitions, matrix, classification };
  saveState(analysis);
  const report = { version: 1, analysisId, refs: analysis.refs, commits: analysis.commits, trees: analysis.trees, merge: analysis.merge, normalTests: analysis.normalTests, probe: analysis.frozen };
  const reportPath = join(analysis.root, 'evaluation-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { analysisId, classification, probePath: frozenProbe, probeHash, probeManifest: frozen.manifest, repetitions, matrix, normalTests: analysis.normalTests, reportPath, report };
}

export function verifyRepair({ analysisId, statePath, candidatePath }) {
  const analysis = loadAnalysis(analysisId, statePath);
  if (!analysis.frozen) throw new Error('evaluate must freeze a probe before verifyRepair.');
  const candidate = resolve(candidatePath);
  if (!existsSync(candidate)) throw new Error('candidatePath does not exist.');
  if (!candidate.startsWith(`${analysis.clonePath}${sep}`) && candidate !== analysis.clonePath) {
    throw new Error('candidatePath must be a disposable worktree inside this analysis clone.');
  }
  if (git(candidate, 'merge-base', '--is-ancestor', analysis.commits.merged, 'HEAD') !== '') {
    throw new Error('candidatePath must descend from the combined snapshot.');
  }
  if (sha256(analysis.frozen.probePath) !== analysis.frozen.probeHash) {
    throw new Error('Frozen probe changed after evaluation; repair verification is invalid.');
  }
  if (analysis.frozen.featureChecks.length === 0) {
    throw new Error('At least one independent feature check is required for repair verification.');
  }
  const dirty = git(candidate, 'status', '--porcelain=v1');
  if (dirty) throw new Error('Candidate worktree must be committed and clean before repair verification.');
  const changed = new Set(git(candidate, 'diff', '--name-only', `${analysis.commits.merged}..HEAD`).split(/\r?\n/).filter(Boolean));
  const protectedChange = [...changed].find((file) => /(^|\/)(test|tests|bob-probes)\/|(^|\/)(package(?:-lock)?\.json|tsconfig.*\.json|vite\.config\.|.*\.config\.[cm]?[jt]s$)/.test(file));
  if (protectedChange) throw new Error(`Candidate changes protected test, probe, harness, or configuration file: ${protectedChange}`);
  const normalTests = testSnapshot(candidate, analysis.testCommand);
  const probe = probeSnapshot(candidate, analysis.frozen.probePath, analysis.frozen.repetitions);
  const featureChecks = analysis.frozen.featureChecks.map((entry) => {
    if (sha256(entry.frozen) !== entry.hash) throw new Error(`Frozen feature check changed: ${entry.frozen}`);
    return { ...entry, result: probeSnapshot(candidate, entry.frozen, 1) };
  });
  const passed = normalTests.exitCode === 0 && probe.kind === 'pass' && probe.consistent && featureChecks.every((entry) => entry.result.kind === 'pass' && entry.result.consistent);
  const report = {
    version: 1,
    analysisId,
    candidatePath: candidate,
    candidateHead: git(candidate, 'rev-parse', 'HEAD'),
    candidateTree: treeId(candidate, 'HEAD'),
    sourceMergedCommit: analysis.commits.merged,
    sourceMergedTree: analysis.trees.merged,
    evaluationClassification: analysis.frozen.classification,
    changedFiles: [...changed],
    frozenProbeHash: analysis.frozen.probeHash,
    normalTests,
    probe,
    featureChecks,
    passed,
  };
  const reportPath = join(analysis.root, 'repair-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { ...report, reportPath };
}

export function dispose({ analysisId }) {
  const analysis = getAnalysis(analysisId);
  rmSync(analysis.root, { recursive: true, force: true });
  analyses.delete(analysisId);
  return { analysisId, disposed: true };
}

export const __testing = { analyses, basename };
