// Generated from the Bob repair candidate committed as 17ed2d8ca9997293383ad589119879c9eb59d94e.
function resolvePrice({ tenant, sku, globalPrices, tenantPrices }) {
  return tenantPrices[tenant]?.[sku] ?? globalPrices[sku];
}


function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {
  let sourceCalls = 0;
  // Outer key: tenant.  Inner key: sku.
  // A nested Map avoids any key-encoding collision that a single flat key
  // (e.g. `${tenant}:${sku}`) would introduce when tenant or sku values
  // themselves contain the separator character.
  const cache = new Map();
  return {
    getPrice({ tenant, sku }) {
      if (!cache.has(tenant)) {
        cache.set(tenant, new Map());
      }
      const tenantCache = cache.get(tenant);
      if (!tenantCache.has(sku)) {
        sourceCalls += 1;
        tenantCache.set(sku, resolvePrice({ tenant, sku, globalPrices, tenantPrices }));
      }
      return tenantCache.get(sku);
    },
    getSourceCalls() { return sourceCalls; },
  };
}


export { createCatalog };
