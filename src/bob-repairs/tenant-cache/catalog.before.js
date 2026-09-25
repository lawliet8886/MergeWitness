import { resolvePrice } from './pricing.js';

export function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {
  let sourceCalls = 0;
  const cache = new Map();
  return {
    getPrice({ tenant, sku }) {
      if (!cache.has(sku)) {
        sourceCalls += 1;
        cache.set(sku, resolvePrice({ tenant, sku, globalPrices, tenantPrices }));
      }
      return cache.get(sku);
    },
    getSourceCalls() { return sourceCalls; },
  };
}
