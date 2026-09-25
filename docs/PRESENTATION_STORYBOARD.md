# MergeWitness — presentation package

This is the six-slide presentation and the local, roughly 150-second replacement judge video awaiting final review. The tenant-cache scenario is measured with a synthetic fixture. The new video uses continuous browser capture, all three real IBM Bob IDE task-summary screenshots, and Google Sulafat narration. The public LabLab player still contains the earlier 96-second video until the final submission update.

## Submission constraints

- MP4 duration: at most 3 minutes, with narration.
- At least 90 seconds must show the solution in action on screen.
- The browser laboratory remains visible throughout the replacement video; real Bob IDE evidence appears as labeled picture-in-picture during the Bob segments.

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

## Replacement continuous edit (local, pending publication)

| Time | Visible evidence |
| --- | --- |
| 00:00–00:09 | Live browser opens and runs the comparison within the opening seconds. |
| 00:09–00:31 | Four fresh browser-worker results; Base/A/B pass and Combined exposes the 100-versus-90 witness. |
| 00:31–01:01 | Inspect the frozen Alpha-then-Beta sequence and expected versus observed output. |
| 01:01–01:25 | Open Bob evidence tab; actual task 1 IDE screenshot appears, with original Bob probe distinguished from audit derivative. |
| 01:25–01:51 | Open repair tab; actual task 2 IDE screenshot and a fresh browser candidate run show retained behavior. |
| 01:51–02:16 | Show the second synthetic priority/cursor witness, task 3 IDE evidence, and its no-repair boundary. |
| 02:16–02:30 | Return to verified outcome and the live-demo address. |

The captions are aligned to the measured 146.24-second narration and burned
into the MP4. The video shows Bob's actual IDE summaries as evidence, while the
candidate checks and audit are attributed to independent validation. No new
Bob activity is simulated in the browser.

## Recording rules

- Keep real Bob clips distinguishable from browser replays or mockups.
- Recheck the deployed demo after each published UI revision.
- Keep the raw browser capture manifest and script reproducible.
- Keep the narration transcript and captions in sync with the MP4.
