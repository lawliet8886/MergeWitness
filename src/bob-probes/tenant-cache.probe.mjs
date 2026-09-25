#!/usr/bin/env node
/**
 * Interaction-invariant probe: a beta tenant must receive the global catalog
 * price for a SKU even after an alpha tenant (with a lower tenant-specific
 * override) has already looked up the same SKU in the same catalog instance.
 *
 * Invoked by MergeWitness from each snapshot worktree root via:
 *   node <frozen-probe-path>
 *
 * Must print one final JSON line on stdout and exit with code 0.
 *   Pass:  {"status":"pass"}
 *   Fail:  {"status":"fail","evidence":{"expected":<n>,"observed":<n>}}
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

// Load catalog.js from the worktree under test.  MergeWitness sets cwd to the
// snapshot root before spawning us, so we derive the import path from cwd.
const catalogURL = pathToFileURL(join(process.cwd(), 'src', 'catalog.js')).href;
const { createCatalog } = await import(catalogURL);

// Scenario configuration ─────────────────────────────────────────────────────
const SKU = 'notebook';
const ALPHA_TENANT = 'alpha';
const BETA_TENANT = 'beta';
const ALPHA_PRICE = 90;   // tenant-specific override for alpha
const GLOBAL_PRICE = 100; // expected price for beta (no override)

// Build a shared catalog with a tenant-specific price for alpha only.
const catalog = createCatalog({
  globalPrices: { [SKU]: GLOBAL_PRICE },
  tenantPrices: { [ALPHA_TENANT]: { [SKU]: ALPHA_PRICE } },
});

// Step 1: alpha requests the SKU – this seeds any internal cache that may exist.
const alphaPrice = catalog.getPrice({ tenant: ALPHA_TENANT, sku: SKU });

// Step 2: beta requests the same SKU in the same catalog instance.
// Without a bug: beta should get GLOBAL_PRICE.
// With the interaction bug (sku-cache keyed only on sku): beta gets alphaPrice.
const betaPrice = catalog.getPrice({ tenant: BETA_TENANT, sku: SKU });

// Invariant evaluation ────────────────────────────────────────────────────────
if (betaPrice === GLOBAL_PRICE) {
  process.stdout.write(JSON.stringify({ status: 'pass' }) + '\n');
} else {
  process.stdout.write(
    JSON.stringify({
      status: 'fail',
      evidence: { expected: GLOBAL_PRICE, observed: betaPrice },
    }) + '\n',
  );
}
// Always exit 0 – both pass and structured fail are valid witness outcomes.
process.exit(0);
