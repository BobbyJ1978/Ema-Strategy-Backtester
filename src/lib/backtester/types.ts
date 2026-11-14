export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FundingEntry {
  fundingTimestamp: number;
  fundingRate: number;
  symbol: string;
  source: string;
  retrievedAt: number;
}

export type Side = "long" | "short";

export type ExitReason =
  | "stop_loss"
  | "take_profit"
  | "opposite_cross"
  | "daily_close";

export interface Trade {
  tradeId: number;
  symbol: string;
  side: Side;
  signalTimestamp: number;
  entryTimestamp: number;
  entryPrice: number;
  quantity: number;
  initialEquity: number;
  riskBudget: number;
  atrAtSignal: number;
  stopLossInitial: number;
  takeProfitInitial: number;
  exitTimestamp: number;
  exitPrice: number;
  exitReason: ExitReason;
  grossPnl: number;
  entryFee: number;
  exitFee: number;
  slippageCost: number;
  fundingPnl: number;
  netPnl: number;
  rMultiple: number;
  holdingMinutes: number;
  equityAfterTrade: number;
}

export interface ExecutionLogEntry {
  timestamp: number;
  event: string;
  detail: string;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  event: "trade_close" | "day_end" | "final";
}

export interface StrategyConfig {
  symbol: string;
  timeframeMinutes: number;
  emaFast: number;
  emaMid: number;
  smaTrend: number;
  smaSlopeLookback: number;
  atrPeriod: number;
  allowLong: boolean;
  allowShort: boolean;
  maxOpenPositions: number;
  stopAtrMultiple: number;
  rewardRiskRatio: number;
  oppositeCrossExit: boolean;
  dailyClose: boolean;
}

export interface RiskConfig {
  initialEquity: number;
  riskFraction: number;
  quantityStep: number;
  minQuantity: number;
}

export interface CostsConfig {
  feeRateEntry: number;
  feeRateExit: number;
  slippageBpsEntry: number;
  slippageBpsExit: number;
  applyFunding: boolean;
}

export interface BacktestRunConfig {
  strategy: StrategyConfig;
  risk: RiskConfig;
  costs: CostsConfig;
  startDate: string | null;
  endDate: string | null;
  warmupBars: number;
  missingCandlePolicy: "exclude_segment";
  source: "binance" | "csv";
}

export interface DataQualityReport {
  source: string;
  symbol: string;
  timeframeMinutes: number;
  totalRawRows: number;
  totalValidCandles: number;
  warmupCandles: number;
  backtestCandles: number;
  droppedIncompleteLastCandle: boolean;
  duplicateTimestampsRemoved: number;
  invalidOhlcRows: number;
  unsortedRows: number;
  gaps: { from: number; to: number; missingBars: number }[];
  firstCandleTime: number | null;
  lastCandleTime: number | null;
  fundingEntries: number;
  fundingDataMissing: boolean;
  volumeType: string;
}

export interface Metrics {
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  netReturnPct: number | null;
  profitFactor: number | null;
  expectancyUsdt: number | null;
  expectancyR: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  maxDrawdownUsdt: number;
  maxDrawdownPct: number;
  maxWinStreak: number;
  maxLossStreak: number;
  avgHoldingMinutes: number | null;
  avgTradesPerDay: number | null;
  totalFees: number;
  totalSlippage: number;
  netFunding: number;
  longNetPnl: number;
  shortNetPnl: number;
  longWinRate: number | null;
  shortWinRate: number | null;
  initialEquity: number;
  finalEquity: number;
}

export interface MonthlyRow {
  month: string;
  trades: number;
  netPnl: number;
  winRate: number | null;
}

export interface SideSummary {
  trades: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
}

export interface RunMetadata {
  runId: string;
  executedAt: string;
  appVersion: string;
  nodeVersion: string;
  source: string;
  symbol: string;
  dataStart: string | null;
  dataEnd: string | null;
  candleCount: number;
  feeRateEntry: number;
  feeRateExit: number;
  slippageBpsEntry: number;
  slippageBpsExit: number;
  fundingStatus: "applied" | "missing";
  scenario: "net" | "gross/no-cost";
}

export interface BacktestResult {
  runId: string;
  metadata: RunMetadata;
  config: BacktestRunConfig;
  dataQuality: DataQualityReport;
  trades: Trade[];
  equityCurve: EquityPoint[];
  monthly: MonthlyRow[];
  metrics: Metrics;
  longSummary: SideSummary;
  shortSummary: SideSummary;
  executionLog: ExecutionLogEntry[];
}
