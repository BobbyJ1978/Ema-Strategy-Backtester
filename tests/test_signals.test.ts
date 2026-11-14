import { describe, expect, it } from "vitest";
import { evaluateSignalAt, type IndicatorSeries } from "@/lib/backtester/strategy/signals";
import { makeCandles } from "./helpers";

function ind(partial: Partial<IndicatorSeries>, n: number): IndicatorSeries {
  return {
    emaFast: partial.emaFast ?? new Array(n).fill(100),
    emaMid: partial.emaMid ?? new Array(n).fill(100),
    smaTrend: partial.smaTrend ?? new Array(n).fill(100),
    atr: partial.atr ?? new Array(n).fill(1),
  };
}

const cfg = {
  symbol: "BTCUSDT",
  timeframeMinutes: 15,
  emaFast: 4,
  emaMid: 16,
  smaTrend: 64,
  smaSlopeLookback: 4,
  atrPeriod: 14,
  allowLong: true,
  allowShort: true,
  maxOpenPositions: 1,
  stopAtrMultiple: 1.5,
  rewardRiskRatio: 2.0,
  oppositeCrossExit: true,
  dailyClose: true,
};

describe("signal detection", () => {
  it("detects a long cross with satisfied filter", () => {
    const n = 10;
    const candles = makeCandles(Array.from({ length: n }, () => ({ open: 101, high: 102, low: 100, close: 101 })));
    const series = ind(
      {
        emaFast: [...new Array(8).fill(99), 100, 101.5],
        emaMid: [...new Array(8).fill(100), 100, 100.5],
        smaTrend: [...new Array(8).fill(99), 99.5, 100],
        atr: new Array(n).fill(1),
      },
      n
    );
    const sig = evaluateSignalAt(candles, series, cfg, 9);
    expect(sig).not.toBeNull();
    expect(sig!.side).toBe("long");
  });

  it("rejects a long cross when the trend filter fails", () => {
    const n = 10;
    const candles = makeCandles(Array.from({ length: n }, () => ({ open: 101, high: 102, low: 100, close: 101 })));
    const series = ind(
      {
        emaFast: [...new Array(8).fill(99), 100.5, 101.5],
        emaMid: [...new Array(8).fill(100), 100, 100],
        smaTrend: [...new Array(8).fill(102), 102, 102],
        atr: new Array(n).fill(1),
      },
      n
    );
    expect(evaluateSignalAt(candles, series, cfg, 9)).toBeNull();
  });

  it("detects a short cross with satisfied filter", () => {
    const n = 10;
    const candles = makeCandles(Array.from({ length: n }, () => ({ open: 99, high: 100, low: 98, close: 99 })));
    const series = ind(
      {
        emaFast: [...new Array(8).fill(101), 100, 98.5],
        emaMid: [...new Array(8).fill(100), 100, 100.5],
        smaTrend: [...new Array(8).fill(102), 101.5, 101],
        atr: new Array(n).fill(1),
      },
      n
    );
    const sig = evaluateSignalAt(candles, series, cfg, 9);
    expect(sig).not.toBeNull();
    expect(sig!.side).toBe("short");
  });

  it("does not signal without a fresh cross (flat fast EMA on one side)", () => {
    const n = 10;
    const candles = makeCandles(Array.from({ length: n }, () => ({ open: 101, high: 102, low: 100, close: 101 })));
    const series = ind(
      {
        emaFast: new Array(n).fill(101.5),
        emaMid: new Array(n).fill(100),
        smaTrend: new Array(n).fill(99),
        atr: new Array(n).fill(1),
      },
      n
    );
    expect(evaluateSignalAt(candles, series, cfg, 9)).toBeNull();
  });
});
