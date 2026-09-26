#!/usr/bin/env node
// Minimal MCP-compatible JSON-RPC server. Stdout is protocol only.
import readline from 'node:readline';
import { prepare, evaluate, verifyRepair, dispose } from '../core/mergeWitness.mjs';

const definitions = [
  { name: 'prepare', description: 'Create trusted, disposable Git snapshots and run existing tests with node --test. Custom test runners are not supported.', inputSchema: { type: 'object', required: ['repoPath', 'baseRef', 'branchARef', 'branchBRef'], properties: { repoPath: { type: 'string' }, baseRef: { type: 'string' }, branchARef: { type: 'string' }, branchBRef: { type: 'string' }, testCommand: { type: 'array', items: { type: 'string' }, enum: [['node', '--test']] } } } },
  { name: 'evaluate', description: 'Freeze and execute a Bob-authored probe across Base, A, B and combined snapshots.', inputSchema: { type: 'object', required: ['analysisId', 'probePath'], properties: { analysisId: { type: 'string' }, probePath: { type: 'string' }, probeDependencies: { type: 'array', items: { type: 'string' } }, featureCheckPaths: { type: 'array', items: { type: 'string' } }, repetitions: { type: 'integer', minimum: 1, maximum: 10 } } } },
  { name: 'verifyRepair', description: 'Verify a candidate against the frozen probe and feature checks.', inputSchema: { type: 'object', required: ['analysisId', 'candidatePath'], properties: { analysisId: { type: 'string' }, candidatePath: { type: 'string' } } } },
  { name: 'dispose', description: 'Remove a disposable private analysis clone.', inputSchema: { type: 'object', required: ['analysisId'], properties: { analysisId: { type: 'string' } } } },
];
const handlers = { prepare, evaluate, verifyRepair, dispose };
function reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
function failure(id, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } })}\n`); }
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  let request;
  try {
    request = JSON.parse(line);
    if (request.method === 'notifications/initialized') continue;
    if (request.method === 'initialize') {
      reply(request.id, { protocolVersion: request.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mergewitness', version: '0.1.0' } });
    } else if (request.method === 'tools/list') {
      reply(request.id, { tools: definitions });
    } else if (request.method === 'tools/call') {
      const name = request.params?.name;
      if (!handlers[name]) throw new Error(`Unknown tool: ${name}`);
      const output = handlers[name](request.params.arguments ?? {});
      reply(request.id, { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output });
    } else {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32601, message: `Unknown method: ${request.method}` } })}\n`);
    }
  } catch (error) {
    failure(request?.id ?? null, error.message);
  }
}
