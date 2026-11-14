import type {
  BacktestResult,
  BacktestRunConfig,
  Candle,
  FundingEntry,
} from "./types";
import {
  validateAndNormalize,
  dropIncompleteLastCandle,
  excludeGappedSegments,
  assertWarmup,
  DataValidationError,
} from "./data/validator";
import { runSimulation } from "./execution/simulator";
import { computeMetrics, computeMonthly } from "./analytics/metrics";
import { APP_VERSION } from "./config";
import { formatUtc } from "./utils/time_utils";

let runCounter = 0;

export function runBacktest(
  cfg: BacktestRunConfig,
  rawCandles: Candle[],
  funding: FundingEntry[],
  nowMs: number = Date.now()
): BacktestResult {
  runCounter += 1;
  const runId = `${new Date(nowMs).toISOString().slice(0, 10)}_ema_sma_v1_${cfg.strategy.symbol.toLowerCase()}_${String(runCounter).padStart(3, "0")}`;

  const { candles: validated, report } = validateAndNormalize(
    rawCandles,
    cfg.strategy.timeframeMinutes,
    cfg.strategy.symbol,
    cfg.source
  );

  const dropped = dropIncompleteLastCandle(validated, cfg.strategy.timeframeMinutes, nowMs);
  report.droppedIncompleteLastCandle = dropped.dropped;

  const { candles: series } = excludeGappedSegments(
    dropped.candles,
    cfg.strategy.timeframeMinutes
  );

  assertWarmup(series, cfg.warmupBars);

  const startIdx = cfg.warmupBars;
  const sim = runSimulation(series, funding, cfg, startIdx);

  const metrics = computeMetrics(sim.trades, sim.equityCurve, cfg.risk.initialEquity, sim.finalEquity);
  const monthly = computeMonthly(sim.trades);

  const backtestCandles = series.length - cfg.warmupBars;
  const fundingDataMissing = funding.length === 0;

  const sideSummaryOf = (side: "long" | "short") => {
    const list = sim.trades.filter((t) => t.side === side);
    const gp = list.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
    const gl = Math.abs(list.filter((t) => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0));
    return {
      trades: list.length,
      netPnl: Math.round(list.reduce((s, t) => s + t.netPnl, 0) * 1e6) / 1e6,
      winRate: list.length ? list.filter((t) => t.netPnl > 0).length / list.length : null,
      profitFactor: gl > 0 ? gp / gl : null,
    };
  };

  const feeRateEntry = cfg.costs.feeRateEntry;
  const feeRateExit = cfg.costs.feeRateExit;

  return {
    runId,
    metadata: {
      runId,
      executedAt: new Date(nowMs).toISOString(),
      appVersion: APP_VERSION,
      nodeVersion: process.version,
      source: cfg.source,
      symbol: cfg.strategy.symbol,
      dataStart: series.length ? formatUtc(series[0].openTime) : null,
      dataEnd: series.length ? formatUtc(series[series.length - 1].openTime) : null,
      candleCount: series.length,
      feeRateEntry,
      feeRateExit,
      slippageBpsEntry: cfg.costs.slippageBpsEntry,
      slippageBpsExit: cfg.costs.slippageBpsExit,
      fundingStatus: cfg.costs.applyFunding && !fundingDataMissing ? "applied" : "missing",
      scenario:
        feeRateEntry === 0 && feeRateExit === 0 && cfg.costs.slippageBpsEntry === 0 && cfg.costs.slippageBpsExit === 0
          ? "gross/no-cost"
          : "net",
    },
    config: cfg,
    dataQuality: {
      ...report,
      warmupCandles: cfg.warmupBars,
      backtestCandles,
      fundingEntries: funding.length,
      fundingDataMissing,
    },
    trades: sim.trades,
    equityCurve: sim.equityCurve,
    monthly,
    metrics,
    longSummary: sideSummaryOf("long"),
    shortSummary: sideSummaryOf("short"),
    executionLog: sim.executionLog,
  };
}

export { DataValidationError };
