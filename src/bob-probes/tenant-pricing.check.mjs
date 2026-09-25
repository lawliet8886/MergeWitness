#!/usr/bin/env node
/**
 * Feature-retention check: tenant-specific pricing must be active.
 *
 * A catalog configured with a tenant override must return the override price
 * for that tenant, not the global price.  This ensures the repair cannot
 * simply remove tenant pricing to make the invariant probe pass.
 *
 * Prints one final JSON line and exits with code 0.
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const catalogURL = pathToFileURL(join(process.cwd(), 'src', 'catalog.js')).href;
const { createCatalog } = await import(catalogURL);

const SKU = 'notebook';
const ALPHA_PRICE = 90;
const GLOBAL_PRICE = 100;

const catalog = createCatalog({
  globalPrices: { [SKU]: GLOBAL_PRICE },
  tenantPrices: { alpha: { [SKU]: ALPHA_PRICE } },
});

const observed = catalog.getPrice({ tenant: 'alpha', sku: SKU });

if (observed === ALPHA_PRICE) {
  process.stdout.write(JSON.stringify({ status: 'pass' }) + '\n');
} else {
  process.stdout.write(
    JSON.stringify({
      status: 'fail',
      evidence: { expected: ALPHA_PRICE, observed },
    }) + '\n',
  );
}
process.exit(0);
