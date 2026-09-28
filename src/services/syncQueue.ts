type RetryQueueOptions = {
  attempts?: number;
  delaysMs?: number[];
  shouldRetry?: (error: unknown) => boolean;
};

export function createSerializedRetryQueue(options: RetryQueueOptions = {}) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delaysMs = options.delaysMs ?? [300, 900];
  const shouldRetry = options.shouldRetry ?? (() => true);
  let tail: Promise<void> = Promise.resolve();

  return function enqueue<T>(operation: () => Promise<T>) {
    const run = tail.then(
      () => runWithRetries(operation, attempts, delaysMs, shouldRetry),
      () => runWithRetries(operation, attempts, delaysMs, shouldRetry),
    );
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

async function runWithRetries<T>(
  operation: () => Promise<T>,
  attempts: number,
  delaysMs: number[],
  shouldRetry: (error: unknown) => boolean,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      await delay(delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0);
    }
  }
  throw lastError;
}

function delay(milliseconds: number) {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
