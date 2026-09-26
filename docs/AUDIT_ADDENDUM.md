# Independent audit addendum

The three IBM Bob IDE tasks and their untouched outputs are preserved under
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

The [separate original-probe report](../reports/tenant-cache-bob-original.public.json)
freezes Bob's exact `tenant-cache.probe.mjs` (SHA-256
`c9c4e6bbe923d71af63fa2ebbba34e0abc6c9a235c7c4b3933c238728c417b7d`)
and measures Base/A/B passing 3/3, then Combined failing 3/3 with 100 expected
and 90 observed. The [audit evaluation](../reports/tenant-cache-evaluation.public.json)
and [repair report](../reports/tenant-cache-repair.public.json) instead use the
independently authored derivative (SHA-256
`cbe0359d761a44e8c9387a67e1581a3c8738abb9d5e49b742a55881c2853854a`). They
do **not** attribute derivative code to IBM Bob. The two evaluations have
matching source trees; their generated commit IDs differ because each run
creates a disposable merge. The original probe hash matches its frozen copy in
the separate report, and the audit report records hashes of Bob's other
originals alongside its derivative hashes. The verifier also
rejects a dirty candidate worktree and compares the complete structured
evidence from repeated runs.

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

The repair verifier reads changed Git paths as NUL-delimited records with rename
detection disabled. This preserves Unicode filenames and checks both the old
and new paths of a rename, so moving or renaming a protected test cannot bypass
the candidate gate. Git command failures stop verification.

The public repair workflow checks that the public evaluation report matches the
supplied analysis state before running the repair. It compares source commits
and trees, ordinary-test results, classification, frozen probe and feature-check
hashes, repetition count, and matrix evidence. It also rejects report changes
during verification and hashes the exact validated bytes. A mismatched report
leaves any existing public repair artifact untouched.

Repository attributes keep text files at LF on checkout and treat media as
binary. A regression test checks the recorded evaluation, probe, repair, and
video hashes in fresh Git clones with both `core.autocrlf=true` and `false`.

Each evaluation attempt uses a new directory for its frozen probe, dependencies,
feature checks, and report. Re-evaluating an analysis cannot inherit files omitted
from the new manifest. The state file is replaced atomically after evaluation
completes; a failed attempt preserves the prior frozen files, report, and state.
Callers should use the returned `reportPath`, since reports are retained per
evaluation instead of overwriting one shared file.

Browser checks have a 15-second timeout. Success, error, cancellation, and timeout
terminate the worker and clear its timer and listeners. A failed comparison
cancels the remaining workers in its batch and lets the user retry.
