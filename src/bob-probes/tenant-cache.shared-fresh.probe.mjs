#!/usr/bin/env node
/**
 * Derived audit probe based on Bob's tenant-cache.probe.mjs.
 * It keeps the original task artifact untouched and adds an independent fresh
 * catalog observation: beta after alpha must equal beta from a new instance.
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const catalogURL = pathToFileURL(join(process.cwd(), 'src', 'catalog.js')).href;
const { createCatalog } = await import(catalogURL);
const SKU = 'notebook';
const options = {
  globalPrices: { [SKU]: 100 },
  tenantPrices: { alpha: { [SKU]: 90 } },
};

const shared = createCatalog(options);
shared.getPrice({ tenant: 'alpha', sku: SKU });
const sharedBeta = shared.getPrice({ tenant: 'beta', sku: SKU });
const freshBeta = createCatalog(options).getPrice({ tenant: 'beta', sku: SKU });
const status = sharedBeta === freshBeta && freshBeta === 100 ? 'pass' : 'fail';
process.stdout.write(`${JSON.stringify({ status, evidence: { expected: freshBeta, observed: sharedBeta, freshBeta } })}\n`);
