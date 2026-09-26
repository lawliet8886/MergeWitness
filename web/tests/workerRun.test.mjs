import assert from 'node:assert/strict';
import test from 'node:test';
import { workerRun } from '../src/workerRun.ts';

function workerHarness(t) {
  const original = globalThis.Worker;
  const workers = [];
  globalThis.Worker = class {
    constructor() {
      this.terminateCalls = 0;
      workers.push(this);
    }
    postMessage(input) { this.input = input; }
    terminate() { this.terminateCalls += 1; }
  };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => {
    if (original === undefined) delete globalThis.Worker;
    else globalThis.Worker = original;
  });
  return workers;
}

function assertReleased(worker) {
  assert.equal(worker.terminateCalls, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
  assert.equal(worker.onmessageerror, null);
}

test('an unresponsive worker times out, is terminated, and allows a fresh retry', async (t) => {
  const workers = workerHarness(t);
  const stalled = workerRun('combined');
  const rejected = assert.rejects(stalled, /timed out after 15 seconds/);
  t.mock.timers.tick(15_000);
  await rejected;
  assertReleased(workers[0]);

  const retry = workerRun('combined');
  const result = { variant: 'combined', probe: { status: 'fail' } };
  workers[1].onmessage({ data: result });
  assert.equal(await retry, result);
  assertReleased(workers[1]);
  t.mock.timers.tick(15_000);
  assertReleased(workers[1]);
});

test('the first failure can cancel every remaining comparison worker', async (t) => {
  const workers = workerHarness(t);
  const batch = new AbortController();
  const comparison = Promise.all(['base', 'pricing', 'cache', 'combined'].map((variant) => workerRun(variant, batch.signal)))
    .finally(() => batch.abort());
  const rejected = assert.rejects(comparison, /could not complete the scenario check/);
  let prevented = false;
  workers[0].onerror({ preventDefault() { prevented = true; } });
  await rejected;
  assert.equal(prevented, true);
  for (const worker of workers) assertReleased(worker);
  t.mock.timers.tick(15_000);
  for (const worker of workers) assertReleased(worker);
});

test('successful completion detaches the worker from later batch cancellation', async (t) => {
  const workers = workerHarness(t);
  const batch = new AbortController();
  const completed = workerRun('repaired', batch.signal);
  const result = { variant: 'repaired', probe: { status: 'pass' } };
  workers[0].onmessage({ data: result });
  assert.equal(await completed, result);
  batch.abort();
  t.mock.timers.tick(15_000);
  assertReleased(workers[0]);
});

test('an already cancelled operation does not dispatch work', async (t) => {
  const workers = workerHarness(t);
  const batch = new AbortController();
  batch.abort();
  await assert.rejects(workerRun('base', batch.signal), /cancelled/);
  assert.equal(workers[0].input, undefined);
  assertReleased(workers[0]);
});
