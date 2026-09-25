#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { prepare, evaluate, verifyRepair } from '../core/mergeWitness.mjs';

function usage() {
  console.error('Usage: node src/cli/mergewitness.mjs <prepare|evaluate|verify-repair|workflow> <request.json> [response.json]');
  process.exitCode = 2;
}

const [operation, requestFile, responseFile] = process.argv.slice(2);
if (!operation || !requestFile) usage();
else {
  try {
    const request = JSON.parse(readFileSync(requestFile, 'utf8'));
    const handlers = { prepare, evaluate, 'verify-repair': verifyRepair };
    let result;
    if (operation === 'workflow') {
      const prepared = prepare(request.prepare);
      const evaluated = evaluate({ analysisId: prepared.analysisId, ...request.evaluate });
      const verified = request.verifyRepair ? verifyRepair({ analysisId: prepared.analysisId, ...request.verifyRepair }) : undefined;
      result = { prepared, evaluated, ...(verified ? { verified } : {}) };
    } else {
      if (!handlers[operation]) throw new Error(`Unknown operation: ${operation}`);
      result = handlers[operation](request);
    }
    const text = `${JSON.stringify(result, null, 2)}\n`;
    if (responseFile) writeFileSync(responseFile, text);
    else process.stdout.write(text);
    if (operation === 'verify-repair' && result.passed === false) process.exitCode = 1;
    if (operation === 'workflow' && result.verified?.passed === false) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
