#!/usr/bin/env node
/**
 * Interaction-invariant probe: a full traversal of priority-ordered pages via
 * an ID cursor must visit every input item exactly once.
 *
 * The clean combined merge of `priority-order` and `id-cursor` introduces a
 * latent defect: the ID-cursor uses alphabetical comparison
 * (`item.id > cursor`) against a priority-ordered sequence, so items whose
 * ID sorts lexicographically before the last-returned ID are silently skipped
 * on the next page.
 *
 * Invoked by MergeWitness from each snapshot worktree root via:
 *   node <frozen-probe-path>
 *
 * MergeWitness sets cwd to the snapshot root before spawning, so we import
 * src/pager.js relative to process.cwd() so the same frozen file works in
 * every snapshot.
 *
 * Must print one final JSON line on stdout and exit with code 0.
 *   Pass:  {"status":"pass"}
 *   Fail:  {"status":"fail","evidence":{"missing":[...ids],"extra":[...ids],"pages":[[...ids],...]}}
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const pagerURL = pathToFileURL(join(process.cwd(), 'src', 'pager.js')).href;
const { createPager } = await import(pagerURL);

// ── Fixture items ────────────────────────────────────────────────────────────
const ITEMS = [
  { id: 'a', priority: 1 },
  { id: 'b', priority: 3 },
  { id: 'c', priority: 2 },
  { id: 'd', priority: 1 },
];
const INPUT_IDS = new Set(ITEMS.map((item) => item.id));

// ── Full traversal via nextCursor ────────────────────────────────────────────
const LIMIT = 2;
const pager = createPager(ITEMS);
const pages = [];
let cursor = null;          // works for both null-initialised and 0-initialised pagers
let guard = 0;
const MAX_PAGES = INPUT_IDS.size + 1; // more pages than items means infinite loop

while (guard < MAX_PAGES) {
  guard += 1;
  const { nodes, nextCursor } = pager.listPage({ cursor, limit: LIMIT });
  pages.push(nodes.map((item) => item.id));
  if (nextCursor === null || nextCursor === undefined) break;
  cursor = nextCursor;
}

// ── Invariant: every input ID appears exactly once ───────────────────────────
const seen = pages.flat();
const observedSet = new Set(seen);

const missing = [...INPUT_IDS].filter((id) => !observedSet.has(id));
const extra   = seen.filter((id, idx) => seen.indexOf(id) !== idx); // duplicates (first occurrence retained)

if (missing.length === 0 && extra.length === 0) {
  process.stdout.write(JSON.stringify({ status: 'pass' }) + '\n');
} else {
  process.stdout.write(
    JSON.stringify({
      status: 'fail',
      evidence: { missing, extra, pages },
    }) + '\n',
  );
}
// Always exit 0 – both pass and structured fail are valid witness outcomes.
process.exit(0);
