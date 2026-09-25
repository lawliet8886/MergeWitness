# Independent audit addendum

The two IBM Bob IDE tasks and their untouched outputs are preserved under
`src/bob-probes/`, `src/bob-repairs/tenant-cache/`, and `bob_sessions/`. Bob's
original tenant-cache probe and cache check were useful for discovering and
repairing the interaction, but an independent audit identified two ways to
strengthen the verification:

- `tenant-cache.shared-fresh.probe.mjs` compares Beta's result after an Alpha
  request with Beta's result in a fresh catalog. This tests tenant isolation
  directly instead of relying only on the fixture's fixed expected price.
- `sku-cache.proxy.check.mjs` counts reads of the source price through an
  external `Proxy`. This checks that a second identical request actually uses
  the cache rather than trusting a metric returned by the candidate.

The final public evaluation and repair reports use those independently authored
derivatives. They do **not** attribute the derivative code to IBM Bob. The
original Bob files remain byte-for-byte as recorded by their hashes in the
evaluation report. The verifier also rejects a dirty candidate worktree and
compares the complete structured evidence from repeated runs.

Bob's `REPAIR_RATIONALE.md` is kept as a contemporaneous task artifact. It
refers to an earlier disposable candidate commit, `f3e8ad58…6f05c`, and the
original frozen probe. The final audit rerun uses candidate commit
`17ed2d8ca9997293383ad589119879c9eb59d94e`; both candidates have the
same repaired Git tree, `5851388015e4d345e5c95de891ae64c38adf03c7`.
The final report binds the tested `src/catalog.js` SHA-256 to Bob's retained
`catalog.fixed.js` SHA-256 and the public evaluation-report SHA-256.

Two wording corrections to the contemporaneous rationale: the ordinary suite
*present in each snapshot* passed; it was not the same combined suite in every
branch. Nested `Map` keeps tenant and SKU as separate key dimensions. Its
string keys use JavaScript `SameValueZero` comparison, not object identity.

These checks establish the measured result for this synthetic case. They do
not prove correctness for all inputs or make arbitrary repositories safe to
execute. The local `analysis-state.json` is trusted state and must not be
altered between evaluation and repair verification.
