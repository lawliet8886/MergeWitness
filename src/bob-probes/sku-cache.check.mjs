#!/usr/bin/env node
/**
 * Feature-retention check: SKU-level caching must be active.
 *
 * In a catalog with no tenant override, repeated requests for the same SKU by
 * the same tenant must hit the underlying price source only once (i.e. the
 * cache deduplicates calls).  This ensures the repair cannot simply remove the
 * cache to make the invariant probe pass.
 *
 * Note: this check uses a catalog with no tenant overrides so that the cache
 * behaviour is unambiguous – a cache hit and a fresh lookup return the same
 * value, and only the call count distinguishes them.
 *
 * Prints one final JSON line and exits with code 0.
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const catalogURL = pathToFileURL(join(process.cwd(), 'src', 'catalog.js')).href;
const { createCatalog } = await import(catalogURL);

const SKU = 'notebook';

// No tenant overrides – cache correctness is clear.
const catalog = createCatalog({ globalPrices: { [SKU]: 100 } });

// Two requests for the same SKU by the same tenant.
catalog.getPrice({ tenant: 'alpha', sku: SKU });
catalog.getPrice({ tenant: 'alpha', sku: SKU });

const observed = catalog.getSourceCalls();
// With caching: sourceCalls === 1.  Without caching: sourceCalls === 2.
const expected = 1;

if (observed === expected) {
  process.stdout.write(JSON.stringify({ status: 'pass' }) + '\n');
} else {
  process.stdout.write(
    JSON.stringify({
      status: 'fail',
      evidence: { expected, observed },
    }) + '\n',
  );
}
process.exit(0);
