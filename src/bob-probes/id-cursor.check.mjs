#!/usr/bin/env node
/**
 * Feature-retention check: ID-cursor pagination must be active.
 *
 * After receiving the first page with limit 2, the nextCursor must be a
 * string ID (not a numeric offset and not null) so that a caller can resume
 * from that position.  This ensures a repair cannot simply revert `pager.js`
 * to the numeric-offset scheme to make the invariant probe pass.
 *
 * Invoked by MergeWitness from each snapshot worktree root via:
 *   node <frozen-check-path>
 *
 * Prints one final JSON line and exits with code 0.
 *   Pass:  {"status":"pass"}
 *   Fail:  {"status":"fail","evidence":{"expected":"string","observedType":<type>,"observedValue":<value>}}
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const pagerURL = pathToFileURL(join(process.cwd(), 'src', 'pager.js')).href;
const { createPager } = await import(pagerURL);

// Three items so a page of limit 2 is definitely not the final page;
// nextCursor must therefore be non-null.
const ITEMS = [
  { id: 'a', priority: 1 },
  { id: 'b', priority: 3 },
  { id: 'c', priority: 2 },
];

const pager = createPager(ITEMS);
const { nextCursor } = pager.listPage({ limit: 2 });

// A valid ID cursor is a non-empty string.
const isStringCursor = typeof nextCursor === 'string' && nextCursor.length > 0;

if (isStringCursor) {
  process.stdout.write(JSON.stringify({ status: 'pass' }) + '\n');
} else {
  process.stdout.write(
    JSON.stringify({
      status: 'fail',
      evidence: {
        expected: 'string',
        observedType: typeof nextCursor,
        observedValue: nextCursor,
      },
    }) + '\n',
  );
}
process.exit(0);
