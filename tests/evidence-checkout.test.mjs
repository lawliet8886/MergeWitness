import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function git(cwd, ...args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}

test('published evidence hashes survive fresh LF and CRLF-configured checkouts', async (t) => {
  const repair = readJson(join(repository, 'reports/tenant-cache-repair.public.json'));
  const evaluation = readJson(join(repository, 'reports/tenant-cache-evaluation.public.json'));
  const original = readJson(join(repository, 'reports/tenant-cache-bob-original.public.json'));
  const priority = readJson(join(repository, 'reports/priority-cursor-evaluation.public.json'));
  const mediaReadme = readFileSync(join(repository, 'media/README.md'), 'utf8');
  const mediaHash = mediaReadme.match(/SHA-256 is `([a-f0-9]{64})`/)?.[1];
  assert.ok(mediaHash, 'The published video hash must be recorded in media/README.md.');

  const expected = new Map([
    ['reports/tenant-cache-evaluation.public.json', repair.evaluationPublicReportSha256],
    ['src/bob-probes/tenant-cache.shared-fresh.probe.mjs', repair.frozenProbeHash],
    [`src/bob-repairs/tenant-cache/${repair.retainedArtifact.name}`, repair.retainedArtifact.sha256],
    ['media/mergewitness_demo.mp4', mediaHash],
  ]);
  for (const artifact of [
    ...evaluation.bobTaskArtifacts.untouchedOriginals,
    ...evaluation.bobTaskArtifacts.auditDerivatives,
    original.bobOriginalProbe,
    ...priority.bobOriginals,
    ...repair.featureChecks,
  ]) {
    const file = `src/bob-probes/${artifact.name}`;
    if (expected.has(file)) assert.equal(expected.get(file), artifact.sha256, `Reports disagree: ${file}`);
    expected.set(file, artifact.sha256);
  }
  for (const [file, hash] of expected) {
    assert.equal(sha256(join(repository, file)), hash, `Published source hash differs: ${file}`);
  }
  assert.equal(repair.testedCatalog.sha256, repair.retainedArtifact.sha256);
  assert.equal(original.frozenProbe.sha256, original.bobOriginalProbe.sha256);

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mergewitness-evidence-checkout-'));
  try {
    // Stage a minimal candidate repository, including the current attributes file,
    // so this gate can validate an uncommitted policy change without changing HEAD.
    const seed = join(temporaryRoot, 'seed');
    mkdirSync(seed);
    for (const file of ['.gitattributes', ...expected.keys()]) {
      const destination = join(seed, file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(repository, file), destination);
    }
    git(seed, 'init', '-b', 'evidence');
    git(seed, '-c', 'core.autocrlf=false', 'add', '.');
    git(seed, '-c', 'user.name=MergeWitness Evidence Test', '-c', 'user.email=evidence@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '-m', 'Evidence checkout fixture');

    for (const autocrlf of ['false', 'true']) {
      await t.test(`core.autocrlf=${autocrlf}`, () => {
        const clone = join(temporaryRoot, `checkout-${autocrlf}`);
        git(temporaryRoot, 'clone', '--no-hardlinks', '--no-checkout', seed, clone);
        git(clone, '-c', `core.autocrlf=${autocrlf}`, 'checkout', '--force', 'HEAD');
        for (const [file, hash] of expected) {
          assert.equal(sha256(join(clone, file)), hash, `Checkout changed evidence bytes: ${file}`);
        }
        assert.equal(git(clone, '-c', `core.autocrlf=${autocrlf}`, 'status', '--porcelain'), '');
      });
    }
  } finally {
    const ownedPath = relative(resolve(tmpdir()), resolve(temporaryRoot));
    assert.ok(ownedPath.startsWith('mergewitness-evidence-checkout-') && !ownedPath.includes(sep),
      'Only remove this test-owned temporary directory.');
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
