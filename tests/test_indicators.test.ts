import { describe, expect, it } from "vitest";
import { ema } from "@/lib/backtester/indicators/ema";
import { sma } from "@/lib/backtester/indicators/sma";
import { atrWilder } from "@/lib/backtester/indicators/atr";
import { makeCandles } from "./helpers";

describe("SMA", () => {
  it("computes simple moving average", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out).toEqual([null, null, 2, 3, 4]);
  });
});

describe("EMA", () => {
  it("seeds with SMA and applies alpha = 2/(period+1)", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(4);
  });
});

describe("ATR (Wilder)", () => {
  it("computes ATR with Wilder smoothing", () => {
    const candles = makeCandles([
      { open: 9, high: 10, low: 8, close: 9 },
      { open: 9, high: 11, low: 9, close: 10 },
      { open: 10, high: 12, low: 10, close: 11 },
      { open: 11, high: 13, low: 11, close: 12 },
      { open: 12, high: 15, low: 12, close: 14 },
    ]);
    const out = atrWilder(candles, 3);
    expect(out[2]).toBeNull();
    expect(out[3]).toBeCloseTo(2);
    expect(out[4]).toBeCloseTo((2 * 2 + 3) / 3);
  });
});
