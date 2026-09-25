#!/usr/bin/env node
// Builds browser-safe modules directly from the synthetic Git fixture refs.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [repoArgument, outputArgument] = process.argv.slice(2);
if (!repoArgument || !outputArgument) {
  throw new Error('Usage: node fixtures/export-web-snapshots.mjs <fixture-repo> <output-module>');
}
const repo = resolve(repoArgument);
const output = resolve(outputArgument);
if (!existsSync(repo)) throw new Error('Fixture repository does not exist. Generate it first.');

function show(ref, path) {
  const result = spawnSync('git', ['show', `${ref}:${path}`], { cwd: repo, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout;
}
function bundle(ref, name) {
  const pricing = show(ref, 'src/pricing.js').replace('export function resolvePrice', 'function resolvePrice');
  const catalog = show(ref, 'src/catalog.js').replace("import { resolvePrice } from './pricing.js';\n\n", '');
  return `function createCatalog_${name}(options) {\n${pricing}\n${catalog.replace('export function createCatalog', 'function createCatalog')}\n  return createCatalog(options);\n}`;
}

const refs = [['base', 'base'], ['tenant-pricing', 'tenantPricing'], ['sku-cache', 'skuCache']];
const parts = refs.map(([ref, name]) => bundle(ref, name));
// The combined source is the exact clean merge of the two fixture branches.
const merged = spawnSync('git', ['merge-tree', '--write-tree', 'tenant-pricing', 'sku-cache'], { cwd: repo, encoding: 'utf8', shell: false });
if (merged.status !== 0) throw new Error(`Could not construct clean merged tree: ${merged.stderr.trim()}`);
const mergedTree = merged.stdout.trim().split(/\s+/)[0];
function showTree(path) {
  const result = spawnSync('git', ['show', `${mergedTree}:${path}`], { cwd: repo, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout;
}
const mergedPricing = showTree('src/pricing.js').replace('export function resolvePrice', 'function resolvePrice');
const mergedCatalog = showTree('src/catalog.js').replace("import { resolvePrice } from './pricing.js';\n\n", '').replace('export function createCatalog', 'function createCatalog');
parts.push(`function createCatalog_combined(options) {\n${mergedPricing}\n${mergedCatalog}\n  return createCatalog(options);\n}`);
parts.push(`export const tenantCacheSnapshots = Object.freeze({\n  base: Object.freeze({ createCatalog: createCatalog_base }),\n  tenantPricing: Object.freeze({ createCatalog: createCatalog_tenantPricing }),\n  skuCache: Object.freeze({ createCatalog: createCatalog_skuCache }),\n  combined: Object.freeze({ createCatalog: createCatalog_combined }),\n});\n`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${parts.join('\n\n')}\n`);
