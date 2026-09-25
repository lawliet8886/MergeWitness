/**
 * Browser-safe adapter for a catalog implementation exported by an actual
 * fixture snapshot. It deliberately owns no business logic or "repaired"
 * variant: the caller supplies that snapshot's createCatalog function.
 */
export function runTrace(createCatalog, steps, catalogOptions = {}) {
  if (typeof createCatalog !== 'function') throw new TypeError('createCatalog must be supplied by a fixture snapshot.');
  const catalog = createCatalog(catalogOptions);
  if (typeof catalog?.getPrice !== 'function' || typeof catalog?.getSourceCalls !== 'function') {
    throw new TypeError('Catalog must expose getPrice and getSourceCalls.');
  }
  const trace = steps.map((input) => ({ ...input, observed: catalog.getPrice(input), sourceCalls: catalog.getSourceCalls() }));
  return { trace, sourceCalls: catalog.getSourceCalls() };
}
