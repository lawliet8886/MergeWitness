// The browser bundle is generated from trusted fixture Git refs. A missing
// artifact fails the build, avoiding a silent substitute implementation.
// @ts-expect-error JavaScript artifact is generated from fixture refs.
import { tenantCacheSnapshots } from './generated/tenantCacheSnapshots.mjs'
// @ts-expect-error This browser module is generated from the independently verified Bob candidate.
import { createCatalog as createBobRepairCatalog } from './generated/tenantCacheBobRepair.mjs'
// @ts-expect-error Browser-safe core module has no declaration file yet.
import { runTrace } from '../../src/core/scenario.mjs'

export type Variant = 'base' | 'pricing' | 'cache' | 'combined' | 'repaired'
export type CheckStatus = 'pass' | 'fail'
export interface TraceRow { tenant: string; sku: string; expected: number; observed: number; sourceCalls: number }
export interface ScenarioResult {
  variant: Variant
  behaviorChecks: { name: string; status: CheckStatus; detail: string }[]
  probe: { status: CheckStatus; expected: number; observed: number; detail: string }
  features: { name: string; status: CheckStatus; detail: string }[]
  trace: TraceRow[]
  safeCacheKey?: string
}

type CatalogFactory = (options?: Record<string, unknown>) => { getPrice(input: { tenant: string; sku: string }): number; getSourceCalls(): number }
type FixtureOptions = { globalPrices: Record<string, number>; tenantPrices: Record<string, Record<string, number>> }
const fixtureOptions: FixtureOptions = { globalPrices: { notebook: 100 }, tenantPrices: { alpha: { notebook: 90 } } }
const snapshotFactories: Record<Exclude<Variant, 'repaired'>, CatalogFactory> = {
  base: tenantCacheSnapshots.base.createCatalog,
  pricing: tenantCacheSnapshots.tenantPricing.createCatalog,
  cache: tenantCacheSnapshots.skuCache.createCatalog,
  combined: tenantCacheSnapshots.combined.createCatalog,
}
const readOne = (factory: CatalogFactory, steps: { tenant: string; sku: string }[]) => runTrace(factory, steps, fixtureOptions)

export function runScenario(variant: Variant): ScenarioResult {
  const factory = variant === 'repaired' ? createBobRepairCatalog : snapshotFactories[variant]
  const directAlpha = readOne(factory, [{ tenant: 'alpha', sku: 'notebook' }])
  const repeatedAlpha = readOne(factory, [{ tenant: 'alpha', sku: 'notebook' }, { tenant: 'alpha', sku: 'notebook' }])
  const contaminated = readOne(factory, [{ tenant: 'alpha', sku: 'notebook' }, { tenant: 'beta', sku: 'notebook' }])
  const freshBeta = readOne(factory, [{ tenant: 'beta', sku: 'notebook' }])
  const alpha = directAlpha.trace[0].observed
  const betaAfterAlpha = contaminated.trace[1].observed
  const betaFresh = freshBeta.trace[0].observed
  const cacheCalls = repeatedAlpha.sourceCalls
  const hasTenantPricing = variant === 'pricing' || variant === 'combined' || variant === 'repaired'
  const hasCache = variant === 'cache' || variant === 'combined' || variant === 'repaired'
  const pricePassed = alpha === (hasTenantPricing ? 90 : 100)
  const cachePassed = !hasCache || cacheCalls === 1
  const tenantFeaturePassed = !hasTenantPricing || (alpha === 90 && betaFresh === 100)
  const cacheFeaturePassed = !hasCache || cacheCalls === 1
  const probePassed = betaAfterAlpha === betaFresh
  return {
    variant,
    behaviorChecks: [
      { name: 'Browser price behavior', status: pricePassed ? 'pass' : 'fail', detail: `Alpha returns $${alpha}` },
      { name: 'Browser cache behavior', status: cachePassed ? 'pass' : 'fail', detail: hasCache ? `Two identical requests used ${cacheCalls} source call${cacheCalls === 1 ? '' : 's'}` : 'No cache in this snapshot' },
    ],
    probe: { status: probePassed ? 'pass' : 'fail', expected: betaFresh, observed: betaAfterAlpha, detail: probePassed ? 'Beta remains independent after serving Alpha.' : 'Beta read Alpha’s cached value after a clean merge.' },
    features: [
      { name: 'Tenant pricing retained', status: tenantFeaturePassed ? 'pass' : 'fail', detail: `Alpha $${alpha} / Beta fresh $${betaFresh}` },
      { name: 'Cache retained', status: cacheFeaturePassed ? 'pass' : 'fail', detail: `Two repeated requests used ${cacheCalls} source call${cacheCalls === 1 ? '' : 's'}` },
    ],
    trace: [
      { tenant: 'alpha', sku: 'notebook', expected: hasTenantPricing ? 90 : 100, observed: contaminated.trace[0].observed, sourceCalls: contaminated.trace[0].sourceCalls },
      { tenant: 'beta', sku: 'notebook', expected: betaFresh, observed: betaAfterAlpha, sourceCalls: contaminated.trace[1].sourceCalls },
      { tenant: 'beta', sku: 'notebook', expected: betaFresh, observed: betaFresh, sourceCalls: freshBeta.trace[0].sourceCalls },
    ],
    safeCacheKey: variant === 'repaired' ? 'nested Map: tenant → sku' : undefined,
  }
}
