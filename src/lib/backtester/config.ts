import type { BacktestRunConfig } from "./types";

export const APP_VERSION = "1.0.0";

export const defaultConfig: BacktestRunConfig = {
  strategy: {
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
  },
  risk: {
    initialEquity: 10000,
    riskFraction: 0.005,
    quantityStep: 0.001,
    minQuantity: 0.001,
  },
  costs: {
    feeRateEntry: 0.0005,
    feeRateExit: 0.0005,
    slippageBpsEntry: 0,
    slippageBpsExit: 0,
    applyFunding: true,
  },
  startDate: null,
  endDate: null,
  warmupBars: 200,
  missingCandlePolicy: "exclude_segment",
  source: "binance",
};
