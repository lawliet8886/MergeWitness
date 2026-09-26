# Synthetic fixtures

Run `node fixtures/create-fixtures.mjs` to create `fixtures/.generated/tenant-cache-history`.

Its `base`, `tenant-pricing`, and `sku-cache` branches are deliberately cleanly mergeable. The ordinary suite passes in all snapshots. The interaction probe and repair are intentionally absent: they must be created and evidenced through the real IBM Bob workflow.

The generator also creates `fixtures/.generated/priority-cursor-history`, with `base`, `priority-order`, and `id-cursor`. Its clean combined version keeps ordinary tests green while a full traversal of priority-ordered data skips an item after the ID cursor. This is the second positive fixture; the Bob-authored property probe remains separate.

## Core contract

Generate the history with `node fixtures/create-fixtures.mjs`. Analyze it through the persistent MCP server (`node src/mcp/server.mjs`) or the one-process CLI workflow. The only supported test command is `node --test`; omit `testCommand` or pass exactly `["node", "--test"]`. Custom runners, wrappers, and extra arguments are rejected because their assertion files cannot yet be protected during repair verification. Analyses previously created with a custom command must be prepared again using the supported command before evaluation or repair verification.

Create a Vite-worker-safe module directly from the actual Git refs with:

```powershell
node fixtures/export-web-snapshots.mjs fixtures/.generated/tenant-cache-history web/src/generated/tenantCacheSnapshots.mjs
```

A Bob-authored probe must print one final JSON line in every snapshot:

```json
{"status":"pass"}
```

or

```json
{"status":"fail","evidence":{"expected":100,"observed":90}}
```

MergeWitness requires the same result in three fresh Node processes. Probes use exit code zero for both structured `pass` and structured `fail`; a timeout, nonzero exit, import error, malformed JSON, or inconsistent repetitions is reported as `inconclusive`, never as a witness. Supply independent, self-contained feature checks to `evaluate` so their files are frozen before the repair is attempted.

## CLI evidence sequence

`prepare`, `evaluate`, and `verify-repair` keep their disposable clone state in the `statePath` returned by `prepare`. This permits an external repair step between commands without touching the source fixture.

```powershell
@'
{
  "repoPath": "C:/absolute/path/to/MergeWitness/fixtures/.generated/tenant-cache-history",
  "baseRef": "base",
  "branchARef": "tenant-pricing",
  "branchBRef": "sku-cache",
  "testCommand": ["node", "--test"]
}
'@ | Set-Content prepare.json
node src/cli/mergewitness.mjs prepare prepare.json prepare-result.json
```

Copy `analysisId` and `statePath` from `prepare-result.json` into `evaluate.json`, along with Bob's absolute probe and feature-check paths. Then run:

```powershell
node src/cli/mergewitness.mjs evaluate evaluate.json evaluation-result.json
```

After editing only production code in the disposable `paths.merged` shown in the prepare result, run:

```powershell
node src/cli/mergewitness.mjs verify-repair repair-request.json repair-result.json
```

Both `evaluate.json` and `repair-request.json` require the same `analysisId` and `statePath`; evaluation also requires `probePath` and `featureCheckPaths`, while repair requires `candidatePath` set to that disposable merged path.
