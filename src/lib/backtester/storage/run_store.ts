import type { BacktestResult } from "../types";

const MAX_RUNS = 10;
const store = new Map<string, BacktestResult>();

export function saveRun(result: BacktestResult): void {
  store.set(result.runId, result);
  while (store.size > MAX_RUNS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function getRun(runId: string): BacktestResult | undefined {
  return store.get(runId);
}

export function latestRun(): BacktestResult | undefined {
  const keys = [...store.keys()].sort();
  return keys.length ? store.get(keys[keys.length - 1]) : undefined;
}
