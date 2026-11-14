import type { BacktestRunConfig, Candle, FundingEntry, StrategyConfig } from "@/lib/backtester/types";
import { runSimulation } from "@/lib/backtester/execution/simulator";
import type { Signal } from "@/lib/backtester/strategy/signals";

export const DAY = 86_400_000;
export const BASE = Date.UTC(2024, 0, 1);

export function makeCandles(
  specs: { open: number; high: number; low: number; close: number }[],
  startMs: number = BASE,
  stepMinutes = 15
): Candle[] {
  return specs.map((s, i) => ({
    openTime: startMs + i * stepMinutes * 60_000,
    open: s.open,
    high: s.high,
    low: s.low,
    close: s.close,
    volume: 1,
  }));
}

export function flat(n: number, price = 100): Candle[] {
  return makeCandles(
    Array.from({ length: n }, () => ({ open: price, high: price, low: price, close: price }))
  );
}

export function testConfig(overrides: Partial<BacktestRunConfig> = {}): BacktestRunConfig {
  const strategy: StrategyConfig = {
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
  return {
    strategy,
    risk: { initialEquity: 10000, riskFraction: 0.005, quantityStep: 0.001, minQuantity: 0.001 },
    costs: {
      feeRateEntry: 0,
      feeRateExit: 0,
      slippageBpsEntry: 0,
      slippageBpsExit: 0,
      applyFunding: true,
    },
    startDate: null,
    endDate: null,
    warmupBars: 70,
    missingCandlePolicy: "exclude_segment",
    source: "csv",
    ...overrides,
  };
}

export function runWithSignal(
  candles: Candle[],
  provider: (t: number) => Signal | null,
  overrides: Partial<BacktestRunConfig> = {},
  funding: FundingEntry[] = []
) {
  const cfg = testConfig(overrides);
  const wrapped = (t: number): Signal | null => {
    const sig = provider(t);
    return sig ? { ...sig, timestamp: candles[t]?.openTime ?? 0 } : null;
  };
  return {
    cfg,
    out: runSimulation(candles, funding, cfg, cfg.warmupBars, wrapped),
  };
}
