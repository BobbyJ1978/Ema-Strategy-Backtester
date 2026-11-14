import { describe, expect, it } from "vitest";
import { makeCandles, flat, runWithSignal, DAY, BASE } from "./helpers";

const T0 = BASE + 70 * 15 * 60_000;
const warm = flat(70, 100);
const longSig = (t: number) => (t === 70 ? { side: "long" as const, index: 70, timestamp: 0, atr: 20 / 3 } : null);

describe("exit rules", () => {
  it("exits at take profit level", () => {
    const candles = [
      ...warm,
      ...makeCandles(
        [
          { open: 100, high: 101, low: 99, close: 100 },
          { open: 100, high: 130, low: 99, close: 125 },
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(candles, longSig);
    expect(out.trades).toHaveLength(1);
    const t = out.trades[0];
    expect(t.side).toBe("long");
    expect(t.entryPrice).toBeCloseTo(100);
    expect(t.exitReason).toBe("take_profit");
    expect(t.exitPrice).toBeCloseTo(120);
  });

  it("exits at stop loss level", () => {
    const candles = [
      ...warm,
      ...makeCandles(
        [
          { open: 100, high: 101, low: 99, close: 100 },
          { open: 100, high: 101, low: 85, close: 95 },
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(candles, longSig);
    expect(out.trades[0].exitReason).toBe("stop_loss");
    expect(out.trades[0].exitPrice).toBeCloseTo(90);
  });

  it("prefers stop loss when SL and TP are touched in the same candle", () => {
    const candles = [
      ...warm,
      ...makeCandles(
        [
          { open: 100, high: 101, low: 99, close: 100 },
          { open: 100, high: 130, low: 85, close: 100 },
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(candles, longSig);
    expect(out.trades[0].exitReason).toBe("stop_loss");
    expect(out.trades[0].exitPrice).toBeCloseTo(90);
  });

  it("executes SL at the open when the next candle gaps through the stop", () => {
    const candles = [
      ...warm,
      ...makeCandles(
        [
          { open: 100, high: 101, low: 99, close: 100 },
          { open: 100, high: 101, low: 99, close: 100 },
          { open: 85, high: 86, low: 84, close: 85 },
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(candles, longSig);
    expect(out.trades[0].exitReason).toBe("stop_loss");
    expect(out.trades[0].exitPrice).toBeCloseTo(85);
  });

  it("exits via opposite cross at the next candle open", () => {
    const candles = [
      ...warm,
      ...makeCandles(
        [
          { open: 100, high: 100.5, low: 99.5, close: 100 },
          { open: 100, high: 100.5, low: 79.5, close: 80 },
          { open: 79, high: 80, low: 78, close: 79 },
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(candles, (t) =>
      t === 70 ? { side: "long", index: 70, timestamp: 0, atr: 100 } : null
    );
    expect(out.trades).toHaveLength(1);
    expect(out.trades[0].exitReason).toBe("opposite_cross");
    expect(out.trades[0].exitPrice).toBeCloseTo(79);
  });

  it("force-closes the position at the last 15m candle close of the UTC day", () => {
    const dayStart = Date.UTC(2024, 0, 2);
    const candles = flat(96 + 70 + 1, 100);
    candles.forEach((c, i) => {
      c.openTime = dayStart + (i - 70 + 1) * 15 * 60_000;
    });
    const { out } = runWithSignal(candles, (t) =>
      t === 70 ? { side: "long", index: 70, timestamp: 0, atr: 100 } : null
    );
    expect(out.trades).toHaveLength(1);
    expect(out.trades[0].exitReason).toBe("daily_close");
    expect(out.trades[0].exitTimestamp).toBe(dayStart + DAY);
    expect(out.trades[0].exitPrice).toBeCloseTo(100);
  });

  it("does not enter when the next candle opens at 00:00 UTC or on the next day", () => {
    const dayStart = Date.UTC(2024, 0, 2);
    const candles = flat(96 + 70 + 2, 100);
    candles.forEach((c, i) => {
      c.openTime = dayStart + (i - 70 + 1) * 15 * 60_000;
    });
    const { out } = runWithSignal(candles, (t) =>
      t === 164 ? { side: "long", index: 164, timestamp: 0, atr: 20 / 3 } : null
    );
    expect(out.trades).toHaveLength(0);
    expect(out.executionLog.some((e) => e.event === "entry_skipped")).toBe(true);
  });

  it("does not re-enter without a fresh cross after a position closes", () => {
    const candles = [
      ...warm,
      ...makeCandles(
        [
          { open: 100, high: 101, low: 99, close: 100 },
          ...Array.from({ length: 10 }, () => ({ open: 100, high: 130, low: 99, close: 125 })),
        ],
        T0
      ),
    ];
    const { out } = runWithSignal(candles, longSig);
    expect(out.trades).toHaveLength(1);
  });
});
