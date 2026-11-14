import { describe, expect, it } from "vitest";
import {
  validateAndNormalize,
  dropIncompleteLastCandle,
  excludeGappedSegments,
  assertWarmup,
  DataValidationError,
} from "@/lib/backtester/data/validator";
import { makeCandles, flat } from "./helpers";

describe("data validation", () => {
  it("removes duplicate timestamps", () => {
    const base = flat(5, 100);
    const raw = [...base, base[2]];
    const { candles, report } = validateAndNormalize(raw, 15, "BTCUSDT", "test");
    expect(candles).toHaveLength(5);
    expect(report.duplicateTimestampsRemoved).toBe(1);
  });

  it("counts invalid OHLC rows", () => {
    const base = flat(5, 100);
    const bad = { ...base[1], high: 1, low: 200 };
    const { report } = validateAndNormalize([base[0], bad, ...base.slice(2)], 15, "BTCUSDT", "test");
    expect(report.invalidOhlcRows).toBe(1);
  });

  it("detects gaps", () => {
    const base = flat(5, 100);
    const withGap = [...base.slice(0, 3), base[4]];
    const { report } = validateAndNormalize(withGap, 15, "BTCUSDT", "test");
    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0].missingBars).toBe(1);
  });

  it("sorts unsorted input", () => {
    const base = flat(5, 100);
    const { candles, report } = validateAndNormalize([base[2], base[0], base[1], base[4], base[3]], 15, "BTCUSDT", "test");
    expect(candles.map((c) => c.openTime)).toEqual([...candles.map((c) => c.openTime)].sort((a, b) => a - b));
    expect(report.unsortedRows).toBeGreaterThan(0);
  });

  it("drops the incomplete last candle", () => {
    const base = flat(5, 100);
    const now = base[4].openTime + 10 * 60_000;
    const { candles, dropped } = dropIncompleteLastCandle(base, 15, now);
    expect(dropped).toBe(true);
    expect(candles).toHaveLength(4);
  });

  it("keeps the largest contiguous segment under exclude_segment policy", () => {
    const a = flat(10, 100);
    const b = makeCandles(Array.from({ length: 5 }, () => ({ open: 100, high: 100, low: 100, close: 100 })), a[9].openTime + 3 * 15 * 60_000);
    const { candles } = excludeGappedSegments([...a, ...b], 15);
    expect(candles).toHaveLength(10);
  });

  it("throws when there is not enough data for warm-up", () => {
    expect(() => assertWarmup(flat(10, 100), 200)).toThrow(DataValidationError);
  });
});
