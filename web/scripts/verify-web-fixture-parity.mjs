import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runTrace } from '../../src/core/scenario.mjs';

const root = resolve(import.meta.dirname, '../..');
const fixtureRepo = join(root, 'fixtures/.generated/tenant-cache-history');
const checkedInArtifact = join(root, 'web/src/generated/tenantCacheSnapshots.mjs');
const checkedInRepair = join(root, 'web/src/generated/tenantCacheBobRepair.mjs');
const scratch = mkdtempSync(join(tmpdir(), 'mergewitness-web-parity-'));
const regenerated = join(scratch, 'snapshots.mjs');
const regeneratedRepair = join(scratch, 'repair.mjs');

try {
  const exportRun = spawnSync('node', [join(root, 'fixtures/export-web-snapshots.mjs'), fixtureRepo, regenerated], { encoding: 'utf8', shell: false });
  assert.equal(exportRun.status, 0, exportRun.stderr);
  assert.equal(readFileSync(regenerated, 'utf8'), readFileSync(checkedInArtifact, 'utf8'), 'Browser snapshot artifact is stale. Regenerate it from the Git fixture refs.');
  const repairRun = spawnSync('node', [join(root, 'web/scripts/export-bob-repair.mjs'), join(root, 'src/bob-repairs/tenant-cache/catalog.fixed.js'), join(root, 'src/bob-repairs/tenant-cache/pricing.before.js'), regeneratedRepair], { encoding: 'utf8', shell: false });
  assert.equal(repairRun.status, 0, repairRun.stderr);
  assert.equal(readFileSync(regeneratedRepair, 'utf8'), readFileSync(checkedInRepair, 'utf8'), 'Browser repair artifact is stale. Regenerate it from the verified Bob candidate.');
  const { tenantCacheSnapshots } = await import(pathToFileURL(checkedInArtifact).href);
  const { createCatalog: createBobRepairCatalog } = await import(pathToFileURL(checkedInRepair).href);
  const options = { globalPrices: { notebook: 100 }, tenantPrices: { alpha: { notebook: 90 } } };
  const steps = [{ tenant: 'alpha', sku: 'notebook' }, { tenant: 'beta', sku: 'notebook' }];
  const expected = { base: [100, 100], tenantPricing: [90, 100], skuCache: [100, 100], combined: [90, 90] };
  for (const [name, values] of Object.entries(expected)) {
    const outcome = runTrace(tenantCacheSnapshots[name].createCatalog, steps, options);
    assert.deepEqual(outcome.trace.map((entry) => entry.observed), values, `${name} output differs from its fixture ref`);
  }
  assert.deepEqual(runTrace(createBobRepairCatalog, steps, options).trace.map((entry) => entry.observed), [90, 100], 'Verified Bob repair does not preserve tenant isolation.');
  process.stdout.write('Browser fixture parity verified.\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
