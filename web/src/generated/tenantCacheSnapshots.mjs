function createCatalog_base(options) {
function resolvePrice({ sku, globalPrices }) {
  return globalPrices[sku];
}

function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {
  let sourceCalls = 0;
  return {
    getPrice({ tenant, sku }) {
      sourceCalls += 1;
      return resolvePrice({ tenant, sku, globalPrices, tenantPrices });
    },
    getSourceCalls() { return sourceCalls; },
  };
}

  return createCatalog(options);
}

function createCatalog_tenantPricing(options) {
function resolvePrice({ tenant, sku, globalPrices, tenantPrices }) {
  return tenantPrices[tenant]?.[sku] ?? globalPrices[sku];
}

function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {
  let sourceCalls = 0;
  return {
    getPrice({ tenant, sku }) {
      sourceCalls += 1;
      return resolvePrice({ tenant, sku, globalPrices, tenantPrices });
    },
    getSourceCalls() { return sourceCalls; },
  };
}

  return createCatalog(options);
}

function createCatalog_skuCache(options) {
function resolvePrice({ sku, globalPrices }) {
  return globalPrices[sku];
}

function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {
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

  return createCatalog(options);
}

function createCatalog_combined(options) {
function resolvePrice({ tenant, sku, globalPrices, tenantPrices }) {
  return tenantPrices[tenant]?.[sku] ?? globalPrices[sku];
}

function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {
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

  return createCatalog(options);
}

export const tenantCacheSnapshots = Object.freeze({
  base: Object.freeze({ createCatalog: createCatalog_base }),
  tenantPricing: Object.freeze({ createCatalog: createCatalog_tenantPricing }),
  skuCache: Object.freeze({ createCatalog: createCatalog_skuCache }),
  combined: Object.freeze({ createCatalog: createCatalog_combined }),
});

