# Repair Rationale — tenant-cache interaction bug

## Scenario

- **Fixture:** `synthetic tenant-cache-history`
- **Merge type:** clean Git merge (no textual conflicts)
- **Classification:** `interaction_witness` — the bug is invisible to ordinary tests because neither branch alone exposed it; it only manifests when both features operate together in the merged code.

## What the two branches contributed

| Branch | Ref | Change |
|---|---|---|
| `tenant-pricing` (A) | `878a90c` | Added `resolvePrice` in `pricing.js`; wires `tenantPrices` so each tenant can receive a price override instead of the global price. |
| `sku-cache` (B) | `ea60c01` | Added an in-process `Map` cache inside `createCatalog`; each unique SKU is resolved at most once, with `sourceCalls` incremented only on a cache miss. |

Both features were independently correct and their unit tests passed on every branch (exit code 0 in base, A, B, and merged).

## Root cause

The merged `catalog.js` (commit `535fe0a`) cached by **SKU alone**:

```js
// merged — BUGGY
if (!cache.has(sku)) {
    sourceCalls += 1;
    cache.set(sku, resolvePrice({ tenant, sku, globalPrices, tenantPrices }));
}
return cache.get(sku);
```

When the first tenant to request a SKU happens to have a tenant-specific price override,
that overridden price is stored in the cache under the bare SKU key.  All subsequent
tenants — regardless of whether they have their own override — receive the first tenant's
price from the cache without ever calling `resolvePrice`.

### Probe evidence

```
alpha requests 'notebook'  →  resolvePrice called  →  returns 90 (alpha override)
                               cache.set('notebook', 90)

beta requests 'notebook'   →  cache.has('notebook') === true
                               cache.get('notebook') === 90   ← WRONG, expected 100
```

Observed `betaPrice = 90`; expected `GLOBAL_PRICE = 100`.  Probe failed 3/3 runs with
identical evidence `{expected:100, observed:90}`.

## Key-design decision: why a nested Map, not a flat encoded string

An obvious first fix is a flat composite key such as `` `${tenant}:${sku}` ``.
That approach is **rejected** because it introduces a collision class:

| tenant | sku | flat key |
|--------|-----|----------|
| `"a:b"` | `"c"` | `"a:b:c"` |
| `"a"` | `"b:c"` | `"a:b:c"` ← same key, different lookup |

Any separator character (`:`, `/`, `\0`, …) can appear in a tenant or SKU value;
no single-character separator is universally safe, and escaping schemes add complexity.

A **nested `Map`** (outer key = tenant, inner key = sku) uses JavaScript object identity
as the key boundary rather than string encoding, so no collision is possible regardless
of what characters tenant or SKU identifiers contain.

## The fix

```js
// fixed — catalog.fixed.js
const cache = new Map();           // outer: tenant → Map
return {
  getPrice({ tenant, sku }) {
    if (!cache.has(tenant)) {
      cache.set(tenant, new Map()); // inner: sku → price
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
```

No other change is made.  `pricing.js` is entirely correct and untouched.

## Why this satisfies all three constraints simultaneously

### 1. Probe passes (`tenant-cache.probe.mjs`)

Alpha's lookup is stored in the inner Map at `cache.get('alpha').get('notebook')`.
When beta requests `'notebook'`, `cache.has('beta')` is false → a fresh inner Map is
created → `resolvePrice` is called with `tenant='beta'` → returns
`globalPrices['notebook'] = 100` → `betaPrice === GLOBAL_PRICE` ✓

### 2. SKU-cache feature retained (`sku-cache.check.mjs`)

The check creates a catalog with **no tenant overrides** and calls
`getPrice({ tenant: 'alpha', sku: 'notebook' })` twice.  Both calls resolve to the
same inner Map at `cache.get('alpha')`.  The second call finds `tenantCache.has('notebook')
=== true` → cache hit → `sourceCalls` stays at 1 ✓

### 3. Tenant-pricing feature retained (`tenant-pricing.check.mjs`)

A catalog with `tenantPrices: { alpha: { notebook: 90 } }` is queried for alpha.
`cache.has('alpha')` is false → inner Map created → `tenantCache.has('notebook')` is
false → `resolvePrice` called with `tenant='alpha'` → returns the tenant override 90 ✓

## Scope of change

- **One file changed:** `catalog.js` only.
- The flat `Map` is replaced by a nested `Map`; the cache-miss branch now lazily
  initialises the inner Map before setting the resolved price.
- `pricing.js` is unchanged.
- The public API (`createCatalog`, `getPrice`, `getSourceCalls`) is preserved exactly.
- No new imports or dependencies.

## Limits and honesty

The analysis is grounded solely on the four source files read (`catalog.before.js`,
`pricing.before.js`, `tenant-cache.probe.mjs`, `sku-cache.check.mjs`,
`tenant-pricing.check.mjs`) and the evaluation report.  If the actual merged
`src/catalog.js` in the worktree contains additional artefacts beyond what
`catalog.before.js` represents, the independent run will reveal that; the logical
diagnosis above still identifies the correct fix.

## Measured validation

Independent verification was performed by copying `catalog.fixed.js` unchanged into
the disposable merged worktree as `src/catalog.js` and committing it.  Results are
recorded in `reports/tenant-cache-repair.public.json`.

| Item | Predicted | Measured |
|---|---|---|
| Overall verdict | pass | **pass** |
| Normal test suite exit code | 0 | **0** |
| Frozen probe (`tenant-cache.probe.mjs`) | pass / consistent | **pass / consistent** |
| `tenant-pricing.check.mjs` retention | pass / consistent | **pass / consistent** |
| `sku-cache.check.mjs` retention | pass / consistent | **pass / consistent** |
| Changed files | `src/catalog.js` only | **`src/catalog.js` only** |

**Candidate commit:** `f3e8ad58f201253de5b6544bda01baf76bc6f05c`  
**Candidate tree:** `5851388015e4d345e5c95de891ae64c38adf03c7`  
**Frozen probe SHA-256:** `c9c4e6bbe923d71af63fa2ebbba34e0abc6c9a235c7c4b3933c238728c417b7d`
(matches the evaluation-phase hash — same unmodified probe used throughout)

All three predictions matched the measured outcomes exactly.  No discrepancies to
report.  The "Limits and honesty" caveat about possible extra artefacts in the merged
worktree did not materialise; `catalog.before.js` was a faithful copy of the merged
source.
