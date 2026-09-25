#!/usr/bin/env node
/**
 * Derived audit check based on Bob's sku-cache.check.mjs.
 * The original Bob artifact remains intact. This version observes price-source
 * reads externally through a Proxy instead of relying only on an internal
 * counter exposed by the catalog.
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const catalogURL = pathToFileURL(join(process.cwd(), 'src', 'catalog.js')).href;
const { createCatalog } = await import(catalogURL);
const SKU = 'notebook';
let observedPriceReads = 0;
const globalPrices = new Proxy({ [SKU]: 100 }, {
  get(target, property, receiver) {
    if (property === SKU) observedPriceReads += 1;
    return Reflect.get(target, property, receiver);
  },
});
const catalog = createCatalog({ globalPrices });
catalog.getPrice({ tenant: 'alpha', sku: SKU });
catalog.getPrice({ tenant: 'alpha', sku: SKU });
const internalSourceCalls = catalog.getSourceCalls();
const status = observedPriceReads === 1 && internalSourceCalls === 1 ? 'pass' : 'fail';
process.stdout.write(`${JSON.stringify({ status, evidence: { expectedPriceReads: 1, observedPriceReads, expectedSourceCalls: 1, internalSourceCalls } })}\n`);
