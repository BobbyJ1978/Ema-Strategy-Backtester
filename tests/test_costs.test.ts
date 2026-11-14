import { describe, expect, it } from "vitest";
import { applySlippage, fundingPnlForPosition } from "@/lib/backtester/costs/costs";
import { makeCandles, flat, runWithSignal, BASE } from "./helpers";

describe("slippage", () => {
  it("worsens buy prices and sell prices", () => {
    expect(applySlippage(100, "buy", 10)).toBeCloseTo(100.1);
    expect(applySlippage(100, "sell", 10)).toBeCloseTo(99.9);
  });
});

describe("fees and slippage inside the simulation", () => {
  it("applies entry/exit fees and slippage to the trade", () => {
    const T0 = BASE + 70 * 15 * 60_000;
    const candles = [
      ...flat(70, 100),
      ...makeCandles(
        [
          { open: 100, high: 101, low: 99, close: 100 },
          { open: 100, high: 130, low: 99, close: 125 },
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(
      candles,
      (t) => (t === 70 ? { side: "long", index: 69, timestamp: 0, atr: 20 / 3 } : null),
      {
        costs: {
          feeRateEntry: 0.001,
          feeRateExit: 0.001,
          slippageBpsEntry: 10,
          slippageBpsExit: 10,
          applyFunding: false,
        },
      }
    );
    const t = out.trades[0];
    expect(t.entryPrice).toBeCloseTo(100.1);
    expect(t.exitPrice).toBeCloseTo(120.1 * 0.999);
    expect(t.entryFee).toBeCloseTo(100.1 * 5 * 0.001);
    expect(t.exitFee).toBeCloseTo(120.1 * 0.999 * 5 * 0.001);
    expect(t.slippageCost).toBeCloseTo((0.1 + 120.1 * 0.001) * 5);
    expect(t.netPnl).toBeCloseTo(t.grossPnl - t.entryFee - t.exitFee);
  });
});

describe("funding", () => {
  const dayStart = Date.UTC(2024, 0, 2);
  const candles = flat(96 + 70 + 1, 100);
  candles.forEach((c, i) => {
    c.openTime = dayStart + (i - 70 + 1) * 15 * 60_000;
  });
  const funding = [
    {
      fundingTimestamp: dayStart + 20 * 3_600_000,
      fundingRate: 0.0001,
      symbol: "BTCUSDT",
      source: "test",
      retrievedAt: 0,
    },
  ];
  const provider = (t: number) =>
    t === 70 ? { side: "long" as const, index: 69, timestamp: 0, atr: 100 } : null;

  it("charges long positions when the funding rate is positive", () => {
    const { out } = runWithSignal(candles, provider, {}, funding);
    const t = out.trades[0];
    expect(t.fundingPnl).toBeCloseTo(-0.0001 * t.entryPrice * t.quantity);
  });

  it("credits short positions when the funding rate is positive", () => {
    const { out } = runWithSignal(
      candles,
      (t) => (t === 70 ? { side: "short" as const, index: 69, timestamp: 0, atr: 100 } : null),
      {},
      funding
    );
    const t = out.trades[0];
    expect(t.fundingPnl).toBeCloseTo(+0.0001 * t.entryPrice * t.quantity);
  });

  it("pays longs when the funding rate is negative", () => {
    const neg = [{ ...funding[0], fundingRate: -0.0001 }];
    const { out } = runWithSignal(candles, provider, {}, neg);
    const t = out.trades[0];
    expect(t.fundingPnl).toBeCloseTo(+0.0001 * t.entryPrice * t.quantity);
  });

  it("sign helper matches the convention", () => {
    expect(fundingPnlForPosition("long", 0.0001, 1000)).toBeCloseTo(-0.1);
    expect(fundingPnlForPosition("short", 0.0001, 1000)).toBeCloseTo(0.1);
  });
});
