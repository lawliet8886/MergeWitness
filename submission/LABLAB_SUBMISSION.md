# MergeWitness — LabLab submission record

**Status:** the prior version was submitted and updated on 25 September 2026. LabLab displayed “Submission Updated!” and “Your submission for IBM Bob 2.0 hackathon has been updated successfully.” The provenance corrections below are a local draft for the next final review; this file does not claim that those revisions are already live. The [public MergeWitness submission](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/signal-foundry/mergewitness) is authoritative for the currently published version.

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

Bob's original focused probe was independently rerun three times in each snapshot. It passed in Base, Change A, and Change B, then failed three times in the combined snapshot, where Beta should receive 100 but observed 90. An independently strengthened derivative probe found the same interaction and also compared Beta against a fresh catalog. IBM Bob authored a nested-Map repair. The repaired disposable candidate passed at commit `17ed2d8ca9997293383ad589119879c9eb59d94e`: the ordinary suite exited with code 0, the strengthened frozen probe passed, and checks confirmed both tenant pricing and the cache remained active.

The public laboratory lets a judge run the scenario, inspect the exact input sequence and expected versus observed result, and see the verified repair. The local CLI/MCP workflow evaluates trusted repositories using runnable test and probe commands; its public reports record this synthetic case. A passing probe means that no failure was found by that probe; it never certifies a merge as safe.

A second synthetic priority/cursor case tests a different interaction: priority ordering and an ID-based page cursor each pass alone, but their clean combination skips an item. Bob authored that probe and two feature checks. Independent measurement found the probe passing 3/3 in Base/A/B and failing 3/3 in Combined, while ordinary tests stayed green. No repair is claimed for this second case.

## IBM Bob Usage Statement

IBM Bob was a core part of MergeWitness's developer workflow, used through the verified IBM Bob IDE tasks recorded below. The work is documented as separate, reviewed tasks so that the project can show what Bob was asked to do, what it produced, and how the result was checked.

**Task 1 `fad890dd4396030a3cdd86588dbbf59f` — tenant-cache probe.** Bob authored the original interaction probe and tenant-pricing and cache retention checks for the synthetic fixture. The task consumed 0.953 Bobcoins. In a separate independent run, Bob's exact original probe passed 3/3 in Base, Change A, and Change B, then failed 3/3 in the clean combined merge with 100 expected and 90 observed. Evidence: `bob_sessions/01-tenant-cache-probe-summary.png` and `reports/tenant-cache-bob-original.public.json`. The later final evaluation and repair reports use independently authored, strengthened probe and cache checks; their code is not attributed to Bob.

**Task 2 `d09305949f41fdff62b67e8e966d6c74` — nested-Map repair.** Bob authored the nested-Map repair for the tenant-cache interaction and consumed 0.637 Bobcoins. The audited disposable candidate is `17ed2d8ca9997293383ad589119879c9eb59d94e`, with the same repaired tree retained for verification. Its verification passed: ordinary tests exited with code 0, the independently authored strengthened frozen probe passed, and the tenant-pricing and cache proxy checks passed. Evidence: `bob_sessions/02-tenant-cache-repair-summary.png`, `reports/tenant-cache-repair.public.json`, and `REPAIR_RATIONALE.md`.

**Task 3 `4901e274fb4230386d1463da9b82ce4f` — second interaction probe.** Bob authored the priority/cursor probe and priority-order and ID-cursor retention checks with IDE file tools; the task consumed 0.552 Bobcoins. An independent run froze that probe, confirmed normal tests exit 0 in all four snapshots, and observed Base/A/B pass 3/3 while Combined fails 3/3 because item `a` is skipped. Both retention checks pass in Combined. Evidence: `bob_sessions/03-priority-cursor-probe-summary.png` and `reports/priority-cursor-evaluation.public.json`. No second-case repair is claimed.

The Bob evidence README maps each screenshot to its task goal, input and output commits, files, and validation. The project uses synthetic fixtures; these checks demonstrate the executed scenarios and do not certify every merge as safe.

## Tags selected in the live form

- Category: `Developer Tools`
- Technology: `IBM`

## Published artifact readback (before the pending replacement)

- Cover image: `media/cover.png`, 1440×810 with crop-safe margins; its four cards and headline were visually read back in the public video poster at `image_expwbft8buhv1a25vptuqojx.jpg`.
- Interactive demo: https://lawliet8886.github.io/MergeWitness/ — fresh public browser run passed Base, Change A, and Change B; Combined showed the 100-versus-90 witness; the Bob repair passed in a fresh worker. The Bob tab showed all three task screenshots and the second-case report links.
- Source repository: https://github.com/lawliet8886/MergeWitness — public, with all three IBM Bob IDE task-summary screenshots in `bob_sessions/`.
- Published video: the [public MP4](https://storage.googleapis.com/lablab-video-submissions/submissions/k33cja4qh4z9ldarcmzuxye2/r2u9hq0fcbuvy3yyge5w4qxf/video/video_d67r2zgzhbyme9397a80ec3g.mp4) is the earlier 96-second, 1920×1080 Sulafat edit made from 96 captured application states. Its verified SHA-256 was `20a0c9e823b7f39afa5c98b3e82007b6909a8e599ff404e2f4442eae42e7d03c` (6,187,303 bytes). The local `media/mergewitness_demo.mp4` has been replaced by a continuous browser recording and is not yet the published video.
- Slides: [public PDF](https://storage.googleapis.com/lablab-static-eu/submissions/k33cja4qh4z9ldarcmzuxye2/r2u9hq0fcbuvy3yyge5w4qxf/presentation/presentation_cia9x0da4f4ey94jclgrkkav.pdf) matched `submission/mergewitness-deck-final-v2.pdf` byte for byte: SHA-256 `5ae7df8c627f6e9e8ea13a8cc124d6727aa7460ed0348380ea28400741b75bcc` (86,984 bytes).
- Bob task evidence: three consumption-summary PNGs under `bob_sessions/`, with task goals, file hashes, and independent reports under `reports/`.
- Release verification: [GitHub Actions run 36193477058](https://github.com/lawliet8886/MergeWitness/actions/runs/36193477058) succeeded on commit `a4e3a813c91fde7ef0c73dc398b652efe7d3dcf8`.
- Submission readback: the [public project page](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/signal-foundry/mergewitness) shows the updated second-case paragraph, title, team Signal Foundry, new video poster and 96-second player, GitHub, new Presentation, Demo, and judging status.

## Local correction package awaiting final review

The repository now separates Bob's exact original probe result from the independently strengthened audit result. The responsive UI and verification integrity checks have also been revised locally. Each re-evaluation isolates its frozen files and preserves prior evidence if the attempt fails. Browser workers time out after 15 seconds and permit retry. A replacement video records a continuous browser session with live comparison and repair actions and enlarges the actual repair checks for legibility. Its local artifact details and validation belong in `media/README.md`; the published URLs and SHA above remain historical readback until the final update is explicitly made and verified.

Local replacement MP4: 150 seconds, 1920×1080, H.264/AAC, SHA-256 `24a595443aef626ee271e6902916dff27e672c193d839d568b7073a2cd6cc7c3` (10,623,837 bytes). It passed a full decode and visual inspection at the opening comparison, matrix, counterexample, Bob evidence, enlarged repaired-candidate checks, second case, and closing frame.

Local replacement slides: `submission/mergewitness-deck-final-v3.pdf`, SHA-256 `923cc3633ce9ae93657926e521f5f51a60db5456e10d8d75a5c79e4cba68196f` (86,344 bytes). The editable PPTX is retained alongside it. Slides 1–5 render identically to v2; slide 6 now emphasizes the demonstrated wrong price, reproducible witness, and repair that preserves both features, with scope limits still visible. The v2 files above remain unchanged as the historical public artifacts.

**The replacement video, v3 slides, code changes, and local text corrections are not yet on the public LabLab submission or GitHub.**
