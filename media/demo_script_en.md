# MergeWitness final demonstration — English

Video duration: 96 seconds. The exact Sulafat narration is 95.32 seconds and reflects the independently verified tenant-cache scenario on 25 September 2026.

> Two changes can be individually correct and still fail when combined. MergeWitness makes that interaction visible before a release.
>
> This synthetic catalog starts with a global notebook price of one hundred dollars. Change A adds tenant pricing, so Alpha pays ninety dollars. Change B adds a cache by notebook SKU. Each branch passes its recorded Node test suite.
>
> The clean merge is where the hidden failure appears. Alpha requests the notebook first, and the cache stores ninety dollars under the notebook alone. Beta then requests the same notebook. Beta should receive one hundred dollars, but receives Alpha's ninety-dollar value. The browser repeats that frozen sequence across the real Git snapshots. Base, Change A, and Change B pass the invariant. The combined snapshot fails consistently.
>
> IBM Bob authored the probe and the feature checks that made this interaction explicit. Bob then produced a focused repair in catalog dot js. The repair uses a nested map: first by tenant, then by notebook. That keeps each tenant's cache entry separate without fragile string key encoding.
>
> The candidate was independently verified. The recorded Node suite passed, the frozen probe passed consistently, and both tenant-pricing and cache feature checks passed. The public report records the candidate commit and the unchanged test evidence. MergeWitness gives a maintainer one concrete witness, one repair, and a reproducible path to verify both features remain intact.
