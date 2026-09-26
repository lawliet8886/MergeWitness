# MergeWitness

**Two green changes. One broken price.** MergeWitness exposes a behavior that fails only after two individually passing changes are combined. It gives a maintainer a reproducible counterexample and verifies a repair against an unchanged interaction probe and separate feature-retention checks.

Built by **Signal Foundry** for the IBM Bob 2.0 Hackathon, 25–27 September 2026. This repository contains newly authored, synthetic examples. The earlier `IBMBob2026` preparation room contributed planning templates and an evidence protocol, not implementation code.

## Measured result

The main fixture is a small JavaScript catalog. Change A adds tenant-specific prices; Change B adds a SKU cache. They merge without a textual conflict, and the ordinary Node test suite exits successfully in all four snapshots. The cache in the combined version is keyed only by SKU, so after Alpha requests `notebook` at 90, Beta receives Alpha's cached 90 instead of its own price of 100.

| Snapshot | Ordinary tests | Frozen audit probe |
| --- | --- | --- |
| Base | Pass | Pass, 3/3 runs |
| Change A: tenant pricing | Pass | Pass, 3/3 runs |
| Change B: SKU cache | Pass | Pass, 3/3 runs |
| Clean combination | Pass | **Fail, 3/3 runs: expected 100, observed 90** |

The [Bob-original probe report](reports/tenant-cache-bob-original.public.json) records a separate run of Bob's untouched probe: Base/A/B passed 3/3 and Combined failed 3/3 with 100 expected and 90 observed. The [audit evaluation report](reports/tenant-cache-evaluation.public.json) records the same result for an independently strengthened probe, which also compares Beta after Alpha with Beta in a fresh catalog. Both reports record source trees, probe hashes, and ordinary test exit codes. The [verified repair report](reports/tenant-cache-repair.public.json) records a one-file Bob-assisted fix: the ordinary suite passes, the frozen audit probe passes, and tenant-pricing and externally observed caching checks pass. The candidate commit is `17ed2d8ca9997293383ad589119879c9eb59d94e` inside the disposable fixture clone; its source hash matches [the retained Bob repair](src/bob-repairs/tenant-cache/catalog.fixed.js). See the [audit addendum](docs/AUDIT_ADDENDUM.md) for provenance and limits.

## Run it

Use Node.js 24 (Node 22 or newer is supported by the core). From the repository root:

```sh
node scripts/run-lab.mjs
```

The command regenerates two synthetic Git histories, creates an isolated clone for the tenant-cache case, runs ordinary tests and the audit-strengthened probe across the four snapshots, then writes `reports/tenant-cache-evaluation.public.json`. It prints a private temporary `statePath` and merged `candidatePath` to the terminal for the repair stage; those local paths are deliberately omitted from the public report.

To measure Bob's original probe separately on the generated tenant-cache history, run `node scripts/run-bob-original-lab.mjs`. It writes `reports/tenant-cache-bob-original.public.json`. The two reports have matching source trees; their disposable merge commit IDs can differ because each run creates its own merge commit.

After generating the histories, `node scripts/run-priority-lab.mjs` independently
runs Bob's second-scenario probe across the four priority/cursor snapshots. Its
[public report](reports/priority-cursor-evaluation.public.json) records the
clean merge, green ordinary suite, 3/3 witness matrix, Bob-original file hashes,
and separate priority-order and ID-cursor feature checks.

To reproduce the repair verification, copy `src/bob-repairs/tenant-cache/catalog.fixed.js` over `src/catalog.js` **in the disposable merged candidate only**, commit that one change, then run `node scripts/run-lab.mjs --state <statePath> --candidate <candidatePath> --retained-artifact src/bob-repairs/tenant-cache/catalog.fixed.js`. The verifier requires a clean, committed candidate, rejects changes to protected tests, probes, and configuration, and executes the frozen probe and feature checks again. Only the default `node --test` command is supported; custom runners and extra arguments are rejected, including in saved analyses. The [CLI](src/cli/mergewitness.mjs) and [MCP server](src/mcp/server.mjs) also expose the prepare/evaluate/verify-repair stages separately; see [fixture instructions](fixtures/README.md).

Run the core regression suite and the report-binding and cross-platform evidence
checks from the repository root. These tests use disposable fixtures and do not
replace the published reports:

```sh
node --test tests/core.test.mjs tests/report-binding.test.mjs tests/evidence-checkout.test.mjs
node --test web/tests/workerRun.test.mjs
```

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

IBM Bob was used in its own IDE for three scoped tasks. In task `fad890dd4396030a3cdd86588dbbf59f`, Bob inspected the fixture and wrote the [original interaction probe](src/bob-probes/tenant-cache.probe.mjs) plus [tenant-pricing](src/bob-probes/tenant-pricing.check.mjs) and [cache](src/bob-probes/sku-cache.check.mjs) retention checks. The task consumed 0.953 Bobcoins; its [consumption-summary screenshot](bob_sessions/01-tenant-cache-probe-summary.png) is preserved. The [separate original-probe report](reports/tenant-cache-bob-original.public.json) measures that exact probe. Independent audit subsequently added a [shared-versus-fresh probe](src/bob-probes/tenant-cache.shared-fresh.probe.mjs) and [Proxy-observed cache check](src/bob-probes/sku-cache.proxy.check.mjs), while leaving Bob's originals untouched. The final evaluator froze those strengthened files by hash before repair verification.

In task `d09305949f41fdff62b67e8e966d6c74`, Bob proposed a tenant-aware cache. Independent Codex review caught a separator-collision risk in the first proposed key; Bob revised it to nested maps keyed by tenant and SKU. The final candidate was copied unchanged into the disposable merged snapshot and verified by the frozen strengthened checks. Bob then read the earlier measured report and documented that observed result. This task consumed 0.637 Bobcoins; its [consumption-summary screenshot](bob_sessions/02-tenant-cache-repair-summary.png) is preserved.

In task `4901e274fb4230386d1463da9b82ce4f`, Bob authored a
[priority/cursor interaction probe](src/bob-probes/priority-cursor.probe.mjs)
and two feature checks for the second synthetic fixture, using only IDE file
tools. It consumed 0.552 Bobcoins; its [IDE consumption summary](bob_sessions/03-priority-cursor-probe-summary.png)
is preserved. The independent [report](reports/priority-cursor-evaluation.public.json)
shows ordinary tests passing in all four snapshots, while the frozen Bob probe
passes 3/3 in Base/A/B and fails 3/3 in Combined because item `a` is skipped.
Both feature checks pass in the combined snapshot. No repair is claimed for
this second scenario.

## Boundaries

This is a synthetic demonstration, not a proof that arbitrary Git merges are safe. A passing probe only means that particular probe found no failure in that run. The CLI executes trusted local fixture code; process isolation and browser workers do not make untrusted repositories safe to run. The local `analysis-state.json` must remain intact; tampering with it invalidates the chain of evidence. The priority/cursor fixture demonstrates a second Bob-authored witness; the tenant-cache fixture is the completed proof-and-repair sequence.

MergeWitness is a concrete workflow rather than a claim that semantic merge conflicts are new. The [judging and related-work notes](docs/JUDGING_AND_RELATED_WORK.md) discuss earlier approaches, including QuietClash and semantic merge research.

## Sources and licenses

All project source, fixture data, visuals, and slides were authored for this event; project software is [MIT licensed](LICENSE). The web app uses pinned public dependencies: [React](https://react.dev/) and React DOM 19.3.0 (MIT), [Vite](https://vite.dev/) 8.3.1 and its React plugin 6.1.1 (MIT), [TypeScript](https://www.typescriptlang.org/) 7.0.2 (Apache-2.0), and DefinitelyTyped React typings 19.3.0 (MIT). Exact packages are in [web/package-lock.json](web/package-lock.json). No prior competition project code is incorporated.
