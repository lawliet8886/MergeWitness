# MergeWitness — LabLab submission record

**Status:** submitted on 25 September 2026. LabLab displayed “You have successfully submitted your project for the IBM Bob 2.0 hackathon event!” and published the [MergeWitness submission](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/signal-foundry/mergewitness). The live submission page is authoritative; the prose below is the working copy prepared for its form.

## Form fields observed on 25 September 2026

- Title: 5–50 characters
- Short description: 50–255 characters
- Problem & Solution Statement: 500–4,000 characters and at most 500 words
- IBM Bob Usage Statement: 500–4,000 characters and at most 500 words

The later form steps require a public repository, all relevant Bob session screenshots, application URL, cover image, slides, and narrated MP4 video of at most 3 minutes with at least 90 seconds showing the solution in action. The event deadline is **27 September 2026, 15:00 UTC / 12:00 BRT**.

## Title

`MergeWitness`

## Short description (179 characters)

`MergeWitness catches bugs created when two passing changes meet. IBM Bob authored interaction probes and a focused repair; independent verification shows both features still work.`

## Long description

Merging two changes can be deceptively reassuring: each branch passes its own tests, the text merge is clean, and the existing suite stays green. Yet the two features can still interfere when they run together. That leaves maintainers with a hard-to-explain production defect and a costly manual investigation.

MergeWitness is a developer workflow for making that interaction visible before release. It prepares four reproducible snapshots—base, change A, change B, and their combined version—and runs the same explicit behavior rule on each one. The measured demo uses a synthetic catalog. One change introduces tenant-specific prices; another introduces a product cache. Each works alone. In the combined version, a price cached for Alpha leaks to Beta. Existing tests exit with code 0 in all four snapshots, but the new rule fails: serving Alpha must not change Beta's price.

The focused probe ran three times in each snapshot. It passed in Base, Change A, and Change B. It failed three times in the combined snapshot, where Beta should receive 100 but observed 90. MergeWitness classified that result as an interaction witness. IBM Bob assisted the original probe investigation and authored a nested-Map repair. An independent audit later strengthened derivative probe and cache checks for final verification. The repaired disposable candidate passed at commit `17ed2d8ca9997293383ad589119879c9eb59d94e`: the ordinary suite exited with code 0, the strengthened frozen probe passed, and checks confirmed both tenant pricing and the cache remained active.

The public laboratory lets a judge run the scenario, inspect the exact input sequence and expected versus observed result, and see the verified repair. A local CLI/MCP workflow produces the same report for trusted JavaScript/TypeScript fixtures. The project reports only measured executions from its synthetic scenarios. A passing probe means that no failure was found by that probe; it never certifies a merge as safe.

A second synthetic priority/cursor case tests a different interaction: priority ordering and an ID-based page cursor each pass alone, but their clean combination skips an item. Bob authored that probe and two feature checks. Independent measurement found the probe passing 3/3 in Base/A/B and failing 3/3 in Combined, while ordinary tests stayed green. No repair is claimed for this second case.

## IBM Bob Usage Statement

IBM Bob was a core part of MergeWitness's developer workflow, used through the verified IBM Bob IDE tasks recorded below. The work is documented as separate, reviewed tasks so that the project can show what Bob was asked to do, what it produced, and how the result was checked.

**Task 1 `fad890dd4396030a3cdd86588dbbf59f` — tenant-cache probe.** Bob assisted the original interaction-test investigation for the synthetic tenant-pricing and cache changes. The task consumed 0.953 Bobcoins. Its original probe established the failure that passed three times in Base, Change A, and Change B, and failed three times in the clean combined merge with expected value 100 and observed value 90. Evidence: `bob_sessions/01-tenant-cache-probe-summary.png` and `reports/tenant-cache-evaluation.public.json`. The strengthened frozen probe and cache proxy check in the final audit are independently authored derivatives and are not attributed to Bob.

**Task 2 `d09305949f41fdff62b67e8e966d6c74` — nested-Map repair.** Bob authored the nested-Map repair for the tenant-cache interaction and consumed 0.637 Bobcoins. The audited disposable candidate is `17ed2d8ca9997293383ad589119879c9eb59d94e`, with the same repaired tree retained for verification. Its verification passed: ordinary tests exited with code 0, the independently authored strengthened frozen probe passed, and the tenant-pricing and cache proxy checks passed. Evidence: `bob_sessions/02-tenant-cache-repair-summary.png`, `reports/tenant-cache-repair.public.json`, and `REPAIR_RATIONALE.md`.

**Task 3 `4901e274fb4230386d1463da9b82ce4f` — second interaction probe.** Bob authored the priority/cursor probe and priority-order and ID-cursor retention checks with IDE file tools; the task consumed 0.552 Bobcoins. An independent run froze that probe, confirmed normal tests exit 0 in all four snapshots, and observed Base/A/B pass 3/3 while Combined fails 3/3 because item `a` is skipped. Both retention checks pass in Combined. Evidence: `bob_sessions/03-priority-cursor-probe-summary.png` and `reports/priority-cursor-evaluation.public.json`. No second-case repair is claimed.

The final README maps each screenshot to its task goal, input commit, output commit, files, approvals, and validation. The project uses a synthetic fixture; these checks demonstrate the executed scenario and do not certify every merge as safe.

## Tags selected in the live form

- Category: `Developer Tools`
- Technology: `IBM`

## Final artifact readback

- Cover image: `media/cover.png`, uploaded and visible in the submission form.
- Interactive demo: https://lawliet8886.github.io/MergeWitness/ — public browser run passed Base, Change A, and Change B; Combined showed the 100-versus-90 witness; the Bob repair passed in a fresh worker.
- Source repository: https://github.com/lawliet8886/MergeWitness — public, with both IBM Bob IDE task-summary screenshots in `bob_sessions/`.
- Final video: `media/mergewitness_demo.mp4`, 96 seconds, 1920×1080, with Google Sulafat narration and burned captions. It uses 96 captured application states and picture-in-picture IBM Bob IDE evidence. The revised MP4 still requires LabLab replacement and readback.
- Slides: `submission/mergewitness-deck-final-v2.pdf`; the corrected PDF still requires LabLab replacement and readback.
- Bob task evidence: three consumption-summary PNGs under `bob_sessions/`, with task goals, file hashes, and independent reports under `reports/`.
- Release verification: [GitHub Actions run 36186885563](https://github.com/lawliet8886/MergeWitness/actions/runs/36186885563) succeeded on commit `a2fe475d3b2564912d096123758235a8a5c965a8`.
- Submission readback: the [public project page](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/signal-foundry/mergewitness) shows title, team Signal Foundry, video, GitHub, Presentation, Demo, and judging status.
