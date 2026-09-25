# MergeWitness — presentation package

This material is an English draft for a 2 minute 50 second narrated MP4 and a six-slide PDF. The tenant-cache scenario is measured with a synthetic fixture. Both relevant Bob task summaries are recorded.

## Submission constraints

- MP4 duration: at most 3 minutes, with narration.
- At least 90 seconds must show the solution in action on screen.
- This storyboard reserves 115 seconds, from 0:35 to 2:30, for the running laboratory, IBM Bob evidence, reports, and repair verification.

## Six-slide outline

### 1. Two green changes can still break each other

**On screen:** A small branch graph: Base splits into Tenant Pricing and Product Cache, which meet in Combined. Each branch and the ordinary suite are green; Combined receives a red interaction marker.

**Say:** “A clean merge and green branch tests do not always mean the two features behave correctly together. MergeWitness finds the interaction that the existing suite missed.”

### 2. The concrete failure

**On screen:** Alpha requests SKU-1 and receives 90. Beta then requests SKU-1 and incorrectly receives 90 instead of 100. Show the same cache key crossing the two customers.

**Say:** “Tenant pricing and caching each work in isolation. When merged, the cache stores a price by product alone. Alpha’s price leaks to Beta.”

### 3. One invariant across four versions

**On screen:** Base, A, B, Combined matrix. Ordinary tests exit with code 0 in all four; the invariant passes three times in Base/A/B and fails three times in Combined. Include expected 100 and observed 90.

**Say:** “We freeze one behavior rule and execute it in all four snapshots. The rule is simple: serving Alpha must not change Beta’s price.”

### 4. IBM Bob in the workflow

**On screen:** The Task 1 consumption-summary screenshot and ID `fad890dd4396030a3cdd86588dbbf59f`, with 0.953 Bobcoins; then the Task 2 screenshot and ID `d09305949f41fdff62b67e8e966d6c74`, with 0.637 Bobcoins.

**Say:** “IBM Bob assisted the probe investigation in Task 1 and authored the nested-Map repair in Task 2. We kept the probe frozen before evaluating the repair. Both task summaries are included in the repository.”

### 5. Repair verified without losing either feature

**On screen:** Before/after cache structure, then three verified checks: ordinary suite exit code 0, tenant pricing preserved, and cache remains effective. Identify audited disposable candidate `17ed2d8ca9997293383ad589119879c9eb59d94e`.

**Say:** “Bob authored the nested-Map repair. An independent audit strengthened derivative probe and cache checks, then verified the repaired candidate. Tenant-specific prices remain distinct, repeated requests still use the cache, and the ordinary suite exits with code zero.”

### 6. A careful release decision

**On screen:** Public laboratory URL, CLI/MCP report sample, limitations box, and final evidence links.

**Say:** “MergeWitness gives maintainers a reproducible interaction witness before release. It does not certify every merge as safe; it reports exactly what the executed probe found.”

## 2:50 narration storyboard

| Time | Visual | Narration |
|---|---|---|
| 0:00–0:15 | Branch graph and ordinary test results. | “Two green changes can still fail together. A clean text merge and green existing tests do not prove that the features behave correctly when combined.” |
| 0:15–0:35 | Synthetic catalog setup and the behavior rule. | “MergeWitness compares base, change A, change B, and the clean combined merge using the same explicit rule: serving Alpha must not change Beta’s price.” |
| 0:35–1:05 | **Running laboratory:** execute Alpha then Beta. | “This tenant-cache fixture adds tenant pricing and product caching. In the combined version, Alpha receives ninety. Beta should receive one hundred and receives ninety from the shared product cache.” |
| 1:05–1:35 | **Running laboratory:** four-snapshot matrix and report. | “Original tests exit with code zero in all four snapshots. The frozen probe passes three times in base and both individual changes. It fails three times in the combined version, classified as an interaction witness.” |
| 1:35–2:05 | **IBM Bob evidence on screen:** Task 1 and Task 2 summaries, then report. | “IBM Bob is central to this workflow. Task 1 assisted the probe investigation and consumed 0.953 Bobcoins. Task 2 authored the nested-Map repair and consumed 0.637 Bobcoins. Both task summaries are in the repository.” |
| 2:05–2:30 | **Running laboratory:** apply repair and run strengthened audit checks. | “Bob authored the nested-Map repair. The audited disposable candidate at commit `17ed2d8ca9997293383ad589119879c9eb59d94e` passes independently authored strengthened derivative checks. Tenant pricing stays distinct, the cache remains active, and the ordinary suite exits with code zero.” |
| 2:30–2:50 | Public report, links, and limit statement. | “A maintainer receives the counterexample, report, and verified repair candidate. This synthetic fixture demonstrates the executed interaction; a passing probe does not certify every merge as safe.” |

## Recording rules

- Keep real Bob clips distinguishable from browser replays or mockups.
- Record the public demo from a fresh browser session after deployment.
- Capture all commands and test outputs used in the video before editing.
- Generate English narration only after the script is reconciled with the final evidence.
