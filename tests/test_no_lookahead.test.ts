import { describe, expect, it } from "vitest";
import { runBacktest } from "@/lib/backtester/engine";
import { testConfig } from "./helpers";
import type { Candle } from "@/lib/backtester/types";

function buildSeries(): Candle[] {
  const candles: Candle[] = [];
  let t = Date.UTC(2024, 0, 1);
  const push = (price: number) => {
    candles.push({ openTime: t, open: price - 0.5, high: price + 1, low: price - 1, close: price, volume: 1 });
    t += 15 * 60_000;
  };
  for (let i = 0; i < 100; i++) push(100);
  for (let i = 0; i < 20; i++) push(100 + (i + 1) * 2);
  for (let i = 0; i < 20; i++) push(140 - (i + 1) * 2);
  for (let i = 0; i < 20; i++) push(100 + (i + 1) * 2);
  for (let i = 0; i < 20; i++) push(140 - (i + 1) * 2);
  return candles;
}

describe("no look-ahead bias", () => {
  it("changing future candles does not change earlier trades", () => {
    const cfg = testConfig({ warmupBars: 100, source: "csv" });
    const original = buildSeries();
    const run1 = runBacktest(cfg, original, [], Date.UTC(2024, 5, 1));
    expect(run1.trades.length).toBeGreaterThan(0);

    const cutIndex = 150;
    const cutTime = original[cutIndex].openTime;
    const mutated = original.map((c, i) =>
      i >= cutIndex ? { ...c, open: c.open * 2, high: c.high * 2, low: c.low * 2, close: c.close * 2 } : c
    );
    const run2 = runBacktest(cfg, mutated, [], Date.UTC(2024, 5, 1));

    const before1 = run1.trades.filter((t) => t.entryTimestamp < cutTime);
    const before2 = run2.trades.filter((t) => t.entryTimestamp < cutTime);
    expect(before2).toEqual(before1);
  });

  it("produces identical results on repeated runs with identical input", () => {
    const cfg = testConfig({ warmupBars: 100, source: "csv" });
    const data = buildSeries();
    const a = runBacktest(cfg, data, [], Date.UTC(2024, 5, 1));
    const b = runBacktest(cfg, data, [], Date.UTC(2024, 5, 1));
    expect(b.trades).toEqual(a.trades);
    expect(b.metrics).toEqual(a.metrics);
  });
});
