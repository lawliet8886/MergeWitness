export function resolvePrice({ tenant, sku, globalPrices, tenantPrices }) {
  return tenantPrices[tenant]?.[sku] ?? globalPrices[sku];
}
