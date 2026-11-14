import { describe, expect, it } from "vitest";
import { computePositionSize, roundToStep } from "@/lib/backtester/risk/sizing";

const cfg = { initialEquity: 10000, riskFraction: 0.005, quantityStep: 0.001, minQuantity: 0.001 };

describe("position sizing", () => {
  it("computes quantity from fixed fractional risk", () => {
    const r = computePositionSize(10000, 100, 90, cfg);
    expect(r.riskBudget).toBeCloseTo(50);
    expect(r.quantity).toBeCloseTo(5);
    expect(r.skipped).toBe(false);
  });

  it("rounds quantity down to the exchange step", () => {
    const r = computePositionSize(10000, 100, 97, cfg);
    expect(r.quantity).toBeCloseTo(roundToStep(50 / 3, 0.001));
    expect(r.quantity).toBeLessThan(50 / 3);
  });

  it("skips the trade when quantity falls below the minimum", () => {
    const r = computePositionSize(10000, 100, 100 + 1e9, cfg);
    expect(r.skipped).toBe(true);
  });

  it("skips the trade when risk per unit is zero", () => {
    const r = computePositionSize(10000, 100, 100, cfg);
    expect(r.skipped).toBe(true);
    expect(r.reason).toBeDefined();
  });
});
