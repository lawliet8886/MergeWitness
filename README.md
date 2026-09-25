# MergeWitness

**Two green changes. One broken price.** MergeWitness exposes a behavior that fails only after two individually passing changes are combined. It gives a maintainer a reproducible counterexample and verifies a repair against an unchanged interaction probe and separate feature-retention checks.

Built by **Signal Foundry** for the IBM Bob 2.0 Hackathon, 25–27 September 2026. This repository contains newly authored, synthetic examples. The earlier `IBMBob2026` preparation room contributed planning templates and an evidence protocol, not implementation code.

## Measured result

The main fixture is a small JavaScript catalog. Change A adds tenant-specific prices; Change B adds a SKU cache. They merge without a textual conflict, and the ordinary Node test suite exits successfully in all four snapshots. The cache in the combined version is keyed only by SKU, so after Alpha requests `notebook` at 90, Beta receives Alpha's cached 90 instead of its own price of 100.

| Snapshot | Ordinary tests | Frozen interaction probe |
| --- | --- | --- |
| Base | Pass | Pass, 3/3 runs |
| Change A: tenant pricing | Pass | Pass, 3/3 runs |
| Change B: SKU cache | Pass | Pass, 3/3 runs |
| Clean combination | Pass | **Fail, 3/3 runs: expected 100, observed 90** |

The [evaluation report](reports/tenant-cache-evaluation.public.json) records the Git commits and trees, probe hash, ordinary test exit codes, three independent probe runs per snapshot, and classification `interaction_witness`. Bob authored the first probe; an independent audit strengthened its invariant by comparing Beta after Alpha with Beta in a fresh catalog. The separately [verified repair report](reports/tenant-cache-repair.public.json) records a one-file Bob-assisted fix: the ordinary suite passes, the frozen strengthened probe passes, and independent tenant-pricing and externally observed caching checks pass. The candidate commit is `17ed2d8ca9997293383ad589119879c9eb59d94e` inside the disposable fixture clone; its source hash matches [the retained Bob repair](src/bob-repairs/tenant-cache/catalog.fixed.js). See the [audit addendum](docs/AUDIT_ADDENDUM.md) for provenance and limits.

## Run it

Use Node.js 24 (Node 22 or newer is supported by the core). From the repository root:

```sh
node scripts/run-lab.mjs
```

The command regenerates two synthetic Git histories, creates an isolated clone for the tenant-cache case, runs ordinary tests and the audit-strengthened probe across the four snapshots, then writes `reports/tenant-cache-evaluation.public.json`. It prints a private temporary `statePath` and merged `candidatePath` to the terminal for the repair stage; those local paths are deliberately omitted from the public report.

To reproduce the repair verification, copy `src/bob-repairs/tenant-cache/catalog.fixed.js` over `src/catalog.js` **in the disposable merged candidate only**, commit that one change, then run `node scripts/run-lab.mjs --state <statePath> --candidate <candidatePath> --retained-artifact src/bob-repairs/tenant-cache/catalog.fixed.js`. The verifier requires a clean, committed candidate, rejects changes to protected tests, probes, and configuration, and executes the frozen probe and feature checks again. The [CLI](src/cli/mergewitness.mjs) and [MCP server](src/mcp/server.mjs) also expose the prepare/evaluate/verify-repair stages separately; see [fixture instructions](fixtures/README.md).

The interactive site lives under [web](web). Build and check its exported Git snapshots with:

```sh
cd web
npm ci
npm run verify:fixtures
npm run build
npm run dev
```

Its browser workers execute source exported from the actual fixture Git refs. The repository's CLI report, rather than the browser workers, is the record that the original Node test suite passed.

## How IBM Bob contributed

IBM Bob was used in its own IDE for two scoped tasks. In task `fad890dd4396030a3cdd86588dbbf59f`, Bob inspected the fixture and wrote the [original interaction probe](src/bob-probes/tenant-cache.probe.mjs) plus [tenant-pricing](src/bob-probes/tenant-pricing.check.mjs) and [cache](src/bob-probes/sku-cache.check.mjs) retention checks. The task consumed 0.953 Bobcoins; its [consumption-summary screenshot](bob_sessions/01-tenant-cache-probe-summary.png) is preserved. Independent audit subsequently added a [shared-versus-fresh probe](src/bob-probes/tenant-cache.shared-fresh.probe.mjs) and [Proxy-observed cache check](src/bob-probes/sku-cache.proxy.check.mjs), while leaving Bob's originals untouched. The final evaluator froze those strengthened files by hash before repair verification.

In task `d09305949f41fdff62b67e8e966d6c74`, Bob proposed a tenant-aware cache. Human review caught a separator-collision risk in the first proposed key; Bob revised it to nested maps keyed by tenant and SKU. The final candidate was copied unchanged into the disposable merged snapshot and verified by the frozen strengthened checks. Bob then read the earlier measured report and documented that observed result. This task consumed 0.637 Bobcoins; its [consumption-summary screenshot](bob_sessions/02-tenant-cache-repair-summary.png) is preserved.

## Boundaries

This is a synthetic demonstration, not a proof that arbitrary Git merges are safe. A passing probe only means that particular probe found no failure in that run. The CLI executes trusted local fixture code; process isolation and browser workers do not make untrusted repositories safe to run. The local `analysis-state.json` must remain intact; tampering with it invalidates the chain of evidence. A second synthetic priority/cursor fixture is included to exercise a different merge interaction, but the tenant-cache fixture is the completed Bob-assisted proof and repair.

MergeWitness is a concrete workflow rather than a claim that semantic merge conflicts are new. The [judging and related-work notes](docs/JUDGING_AND_RELATED_WORK.md) discuss earlier approaches, including QuietClash and semantic merge research.

## Sources and licenses

All project source, fixture data, visuals, and slides were authored for this event; project software is [MIT licensed](LICENSE). The web app uses pinned public dependencies: [React](https://react.dev/) and React DOM 19.3.0 (MIT), [Vite](https://vite.dev/) 8.3.1 and its React plugin 6.1.1 (MIT), [TypeScript](https://www.typescriptlang.org/) 7.0.2 (Apache-2.0), and DefinitelyTyped React typings 19.3.0 (MIT). Exact packages are in [web/package-lock.json](web/package-lock.json). No prior competition project code is incorporated.
