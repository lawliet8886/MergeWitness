import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [candidateArgument, pricingArgument, outputArgument] = process.argv.slice(2);
if (!candidateArgument || !pricingArgument || !outputArgument) {
  throw new Error('Usage: node scripts/export-bob-repair.mjs <candidate> <pricing> <output>');
}

const candidate = readFileSync(resolve(candidateArgument), 'utf8')
  .replace("import { resolvePrice } from './pricing.js';\n\n", '')
  .replace('export function createCatalog', 'function createCatalog');
const pricing = readFileSync(resolve(pricingArgument), 'utf8')
  .replace('export function resolvePrice', 'function resolvePrice');
const output = resolve(outputArgument);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `// Generated from the Bob repair candidate committed as 17ed2d8ca9997293383ad589119879c9eb59d94e.\n${pricing}\n\n${candidate}\n\nexport { createCatalog };\n`);
