# MergeWitness — presentation package

This is the final six-slide presentation and 96-second English judge video. The tenant-cache scenario is measured with a synthetic fixture. The video uses actual browser states, two real IBM Bob IDE task-summary captures, and Google Sulafat narration. A third Bob task on the priority/cursor fixture is separately evidenced in the repository.

## Submission constraints

- MP4 duration: at most 3 minutes, with narration.
- At least 90 seconds must show the solution in action on screen.
- The browser laboratory remains visible throughout the 96-second video; real Bob IDE evidence appears as labeled picture-in-picture during the Bob segment.

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

## Final 96-second edit

| Time | Visible evidence |
| --- | --- |
| 00:00–00:12 | Running app hero, branch relationship, and comparison action. |
| 00:12–00:28 | Four snapshot results from the browser workers; base/A/B pass and combined finds the 100-versus-90 witness. |
| 00:28–00:55 | Scroll to the frozen Alpha-then-Beta sequence and its observed report. |
| 00:55–01:01 | Bob task 1 summary appears over the running app, labeled as the original probe and checks. |
| 01:01–01:14 | Bob task 2 summary appears over the repair tab, labeled as the proposed repair. |
| 01:14–01:29 | Fresh browser candidate run and visible pass for tenant pricing and cache retention. |
| 01:29–01:36 | Verified outcome and live-demo address; narration finishes at 01:35. |

The captions are sentence-aligned to the 95.32-second narration and are burned
into the MP4. The video shows Bob's actual IDE summaries as evidence, while the
candidate checks and audit are attributed to independent validation. No new
Bob activity is simulated in the browser.

## Recording rules

- Keep real Bob clips distinguishable from browser replays or mockups.
- Recheck the deployed demo after each published UI revision.
- Keep the raw browser capture manifest and script reproducible.
- Keep the narration transcript and captions in sync with the MP4.
