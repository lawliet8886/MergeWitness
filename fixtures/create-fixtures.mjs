#!/usr/bin/env node
// Generates trusted, synthetic Git histories. Run manually; it never touches a user repository.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const generatedRoot = resolve('fixtures/.generated');
const target = resolve(process.argv[2] ?? join(generatedRoot, 'tenant-cache-history'));
const targetRelative = relative(generatedRoot, target);
if (!targetRelative || targetRelative.startsWith(`..${sep}`) || targetRelative === '..' || targetRelative.includes(`${sep}..${sep}`)) {
  throw new Error('Fixture target must be a child directory of fixtures/.generated.');
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

function exec(cwd, command, ...args) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stderr}`);
}
function put(root, file, content) {
  const path = join(root, file);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, content);
}
function commit(root, message) {
  exec(root, 'git', 'add', '.');
  exec(root, 'git', '-c', 'user.name=MergeWitness Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', message);
}

const repo = target;
mkdirSync(repo, { recursive: true });
exec(repo, 'git', 'init', '-b', 'base');
put(repo, 'package.json', JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }, null, 2));
put(repo, 'src/pricing.js', `export function resolvePrice({ sku, globalPrices }) {\n  return globalPrices[sku];\n}\n`);
put(repo, 'src/catalog.js', `import { resolvePrice } from './pricing.js';\n\nexport function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {\n  let sourceCalls = 0;\n  return {\n    getPrice({ tenant, sku }) {\n      sourceCalls += 1;\n      return resolvePrice({ tenant, sku, globalPrices, tenantPrices });\n    },\n    getSourceCalls() { return sourceCalls; },\n  };\n}\n`);
put(repo, 'test/catalog.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createCatalog } from '../src/catalog.js';\n\ntest('returns the global price', () => {\n  assert.equal(createCatalog().getPrice({ tenant: 'alpha', sku: 'notebook' }), 100);\n});\n`);
commit(repo, 'base global catalog');

exec(repo, 'git', 'checkout', '-b', 'tenant-pricing');
put(repo, 'src/pricing.js', `export function resolvePrice({ tenant, sku, globalPrices, tenantPrices }) {\n  return tenantPrices[tenant]?.[sku] ?? globalPrices[sku];\n}\n`);
put(repo, 'test/tenant-pricing.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createCatalog } from '../src/catalog.js';\n\ntest('uses a tenant price', () => {\n  const catalog = createCatalog({ tenantPrices: { alpha: { notebook: 90 } } });\n  assert.equal(catalog.getPrice({ tenant: 'alpha', sku: 'notebook' }), 90);\n});\n`);
commit(repo, 'add tenant-specific pricing');

exec(repo, 'git', 'checkout', 'base');
exec(repo, 'git', 'checkout', '-b', 'sku-cache');
put(repo, 'src/catalog.js', `import { resolvePrice } from './pricing.js';\n\nexport function createCatalog({ globalPrices = { notebook: 100 }, tenantPrices = {} } = {}) {\n  let sourceCalls = 0;\n  const cache = new Map();\n  return {\n    getPrice({ tenant, sku }) {\n      if (!cache.has(sku)) {\n        sourceCalls += 1;\n        cache.set(sku, resolvePrice({ tenant, sku, globalPrices, tenantPrices }));\n      }\n      return cache.get(sku);\n    },\n    getSourceCalls() { return sourceCalls; },\n  };\n}\n`);
put(repo, 'test/sku-cache.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createCatalog } from '../src/catalog.js';\n\ntest('caches repeated SKU lookups', () => {\n  const catalog = createCatalog();\n  catalog.getPrice({ tenant: 'alpha', sku: 'notebook' });\n  catalog.getPrice({ tenant: 'alpha', sku: 'notebook' });\n  assert.equal(catalog.getSourceCalls(), 1);\n});\n`);
commit(repo, 'cache products by SKU');
exec(repo, 'git', 'checkout', 'base');

const priorityRepo = join(dirname(repo), 'priority-cursor-history');
rmSync(priorityRepo, { recursive: true, force: true });
mkdirSync(priorityRepo, { recursive: true });
exec(priorityRepo, 'git', 'init', '-b', 'base');
put(priorityRepo, 'package.json', JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }, null, 2));
put(priorityRepo, 'src/order.js', `export function orderItems(items) {\n  return [...items].sort((left, right) => left.id.localeCompare(right.id));\n}\n`);
put(priorityRepo, 'src/pager.js', `import { orderItems } from './order.js';\n\nexport function createPager(items) {\n  const ordered = orderItems(items);\n  return {\n    listPage({ cursor = 0, limit = 2 } = {}) {\n      const nodes = ordered.slice(cursor, cursor + limit);\n      return { nodes, nextCursor: nodes.length === limit ? cursor + nodes.length : null };\n    },\n  };\n}\n`);
put(priorityRepo, 'test/base.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createPager } from '../src/pager.js';\n\ntest('lists items in id order', () => {\n  assert.deepEqual(createPager([{ id: 'b' }, { id: 'a' }]).listPage().nodes.map((item) => item.id), ['a', 'b']);\n});\n`);
commit(priorityRepo, 'base offset pager');

exec(priorityRepo, 'git', 'checkout', '-b', 'priority-order');
put(priorityRepo, 'src/order.js', `export function orderItems(items) {\n  return [...items].sort((left, right) => (right.priority - left.priority) || left.id.localeCompare(right.id));\n}\n`);
put(priorityRepo, 'test/priority.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createPager } from '../src/pager.js';\n\ntest('puts high priority first', () => {\n  assert.equal(createPager([{ id: 'a', priority: 1 }, { id: 'b', priority: 3 }]).listPage().nodes[0].id, 'b');\n});\n`);
commit(priorityRepo, 'order by priority');

exec(priorityRepo, 'git', 'checkout', 'base');
exec(priorityRepo, 'git', 'checkout', '-b', 'id-cursor');
put(priorityRepo, 'src/pager.js', `import { orderItems } from './order.js';\n\nexport function createPager(items) {\n  const ordered = orderItems(items);\n  return {\n    listPage({ cursor = null, limit = 2 } = {}) {\n      const start = cursor === null ? 0 : ordered.findIndex((item) => item.id > cursor);\n      const nodes = ordered.slice(start < 0 ? ordered.length : start, (start < 0 ? ordered.length : start) + limit);\n      return { nodes, nextCursor: nodes.length === limit ? nodes.at(-1).id : null };\n    },\n  };\n}\n`);
put(priorityRepo, 'test/cursor.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createPager } from '../src/pager.js';\n\ntest('uses the last id as a cursor', () => {\n  const pager = createPager([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);\n  assert.deepEqual(pager.listPage({ limit: 2 }).nodes.map((item) => item.id), ['a', 'b']);\n  assert.deepEqual(pager.listPage({ cursor: 'b', limit: 2 }).nodes.map((item) => item.id), ['c']);\n});\n`);
commit(priorityRepo, 'use id cursor');
exec(priorityRepo, 'git', 'checkout', 'base');

console.log(JSON.stringify({ tenantCache: { repo, refs: ['base', 'tenant-pricing', 'sku-cache'] }, priorityCursor: { repo: priorityRepo, refs: ['base', 'priority-order', 'id-cursor'] } }, null, 2));
