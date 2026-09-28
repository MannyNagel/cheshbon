import assert from 'node:assert/strict';
import test from 'node:test';

import { createSerializedRetryQueue } from '../src/services/syncQueue.ts';

test('retries a transient failure before succeeding', async () => {
  const enqueue = createSerializedRetryQueue({ attempts: 3, delaysMs: [0, 0] });
  let attempts = 0;
  const result = await enqueue(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('temporary failure');
    return 'synced';
  });

  assert.equal(result, 'synced');
  assert.equal(attempts, 3);
});

test('runs cloud operations one at a time and keeps their order', async () => {
  const enqueue = createSerializedRetryQueue({ attempts: 1 });
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = enqueue(async () => {
    events.push('first:start');
    await firstGate;
    events.push('first:end');
  });
  const second = enqueue(async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await Promise.resolve();
  assert.deepEqual(events, ['first:start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('does not retry errors marked permanent', async () => {
  const enqueue = createSerializedRetryQueue({
    attempts: 3,
    delaysMs: [0, 0],
    shouldRetry: () => false,
  });
  let attempts = 0;

  await assert.rejects(
    enqueue(async () => {
      attempts += 1;
      throw new Error('permanent failure');
    }),
    /permanent failure/,
  );
  assert.equal(attempts, 1);
});

test('continues processing after an earlier queued operation fails', async () => {
  const enqueue = createSerializedRetryQueue({ attempts: 1 });
  const failed = enqueue(async () => {
    throw new Error('first failed');
  });
  const next = enqueue(async () => 'second succeeded');

  await assert.rejects(failed, /first failed/);
  assert.equal(await next, 'second succeeded');
});
