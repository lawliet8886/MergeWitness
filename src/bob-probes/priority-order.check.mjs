#!/usr/bin/env node
/**
 * Feature-retention check: priority ordering must be active.
 *
 * The first item on the first page must be the highest-priority item.  This
 * ensures a repair cannot simply revert `order.js` to alphabetical ordering
 * to make the invariant probe pass.
 *
 * Invoked by MergeWitness from each snapshot worktree root via:
 *   node <frozen-check-path>
 *
 * Prints one final JSON line and exits with code 0.
 *   Pass:  {"status":"pass"}
 *   Fail:  {"status":"fail","evidence":{"expected":"b","observed":<id>}}
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const pagerURL = pathToFileURL(join(process.cwd(), 'src', 'pager.js')).href;
const { createPager } = await import(pagerURL);

// Items where 'b' has the highest priority; a correct priority-order
// implementation must surface it first regardless of ID ordering.
const ITEMS = [
  { id: 'a', priority: 1 },
  { id: 'b', priority: 3 },
  { id: 'c', priority: 2 },
  { id: 'd', priority: 1 },
];

const pager = createPager(ITEMS);
const { nodes } = pager.listPage({ limit: 2 });
const observed = nodes[0]?.id ?? null;
const expected = 'b'; // highest-priority item

if (observed === expected) {
  process.stdout.write(JSON.stringify({ status: 'pass' }) + '\n');
} else {
  process.stdout.write(
    JSON.stringify({
      status: 'fail',
      evidence: { expected, observed },
    }) + '\n',
  );
}
process.exit(0);
