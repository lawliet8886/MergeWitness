# MergeWitness — judging map and related work

## Judging map

The event publishes four dimensions without public weights. This map explains what final evidence must support each one; it is not a prediction of score.

| Dimension | Claim to demonstrate | Required final evidence |
|---|---|---|
| Application of technology | IBM Bob participates in planning, probe design, diagnosis, repair, and review in a coherent developer workflow. | Real task IDs, task outputs, reviewed commits, consumption-summary PNGs in `bob_sessions/`, and reproducible checks. |
| Presentation | A judge can understand the failure, run it, see the counterexample, and inspect the repair quickly. | Public demo, one primary scenario, concise video, accessible labeled states, repository README, and a verified deployment. |
| Business value | The workflow reduces rework caused by clean merges whose current test suite misses a feature interaction. | A concrete maintainer release workflow, measured scenario outcomes, reproduction commands, and careful limits. |
| Originality | The project combines a frozen interaction invariant, four-version witness, stateful counterexample, and repair-preservation checks in one understandable workflow. | Clear comparison to prior art, a functioning end-to-end flow, controls, and no unsupported novelty claim. |

## Related work and positioning

MergeWitness should acknowledge related systems directly in the README, presentation, and final submission.

### QuietClash

[QuietClash](https://github.com/arbade/quietclash) studies clean merges whose branches pass independently but whose combined behavior can differ. Its repository describes executable probes and witnesses for JavaScript/TypeScript programs. MergeWitness must not claim to be the first to compare branches and a merge, nor that every existing tool only performs static analysis.

The proposed project focus is narrower and demonstrable: a human-readable, stateful invariant across four snapshots; a browser laboratory exposing the counterexample; and repair verification that preserves the two original features. Treat this as product positioning, not a benchmark claim against QuietClash.

### Semantic conflict research

The paper [Semantic Conflict Detection for Merges](https://arxiv.org/abs/2310.02395) describes research on semantic conflicts and test generation. The accompanying [SAM project page](https://spgroup.github.io/papers/sam-semantic-merge-tool.html) provides further context. MergeWitness is a hackathon prototype using synthetic fixtures, not a replacement for that research and not a claim of complete semantic-conflict detection.

[TOM](https://arxiv.org/abs/2003.00154) is further research on detecting higher-order conflicts with tests. Cite it if discussing prior test-based semantic-conflict work.

### Merge queues

[Graphite's merge-queue documentation](https://graphite.com/docs/merge-queue-optimizations) describes testing combined commits such as A, A+B, and A+B+C. GitHub also documents its [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), which validates a temporary merge group with required checks. MergeWitness does not claim that merge queues ignore combined changes. Its demo asks a more specific question: whether an explicitly chosen interaction rule holds in the four versions and after a candidate repair.

## Safe language for the final materials

Use:

- “finds a demonstrated interaction failure in the executed scenario”
- “reports no witness from this probe”
- “verifies this candidate repair against the frozen checks”
- “uses synthetic fixtures to make the workflow reproducible”

Avoid:

- “proves every merge is safe”
- “first semantic-merge detector”
- “beats merge queues”
- “reduces production incidents by [number]” without a measured study
- “fully autonomous repair” if a human shaped the test, constraints, or review
