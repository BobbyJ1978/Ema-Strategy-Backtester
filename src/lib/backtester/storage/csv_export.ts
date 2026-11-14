import type { BacktestResult, Trade } from "../types";
import { formatUtc } from "../utils/time_utils";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\n") + "\n";
}

export function tradesCsv(trades: Trade[]): string {
  return toCsv(
    [
      "trade_id", "symbol", "side", "signal_timestamp", "entry_timestamp", "entry_price",
      "quantity", "initial_equity", "risk_budget", "atr_at_signal", "stop_loss_initial",
      "take_profit_initial", "exit_timestamp", "exit_price", "exit_reason", "gross_pnl",
      "entry_fee", "exit_fee", "slippage_cost", "funding_pnl", "net_pnl", "r_multiple",
      "holding_minutes", "equity_after_trade",
    ],
    trades.map((t) => [
      t.tradeId, t.symbol, t.side, formatUtc(t.signalTimestamp), formatUtc(t.entryTimestamp),
      t.entryPrice, t.quantity, t.initialEquity, t.riskBudget, t.atrAtSignal,
      t.stopLossInitial, t.takeProfitInitial, formatUtc(t.exitTimestamp), t.exitPrice,
      t.exitReason, t.grossPnl, t.entryFee, t.exitFee, t.slippageCost, t.fundingPnl,
      t.netPnl, t.rMultiple, t.holdingMinutes, t.equityAfterTrade,
    ])
  );
}

export function equityCsv(result: BacktestResult): string {
  return toCsv(
    ["timestamp", "equity", "event"],
    result.equityCurve.map((p) => [formatUtc(p.timestamp), p.equity, p.event])
  );
}

export function monthlyCsv(result: BacktestResult): string {
  return toCsv(
    ["month", "trades", "net_pnl", "win_rate"],
    result.monthly.map((m) => [m.month, m.trades, m.netPnl, m.winRate ?? "N/A"])
  );
}

export function executionLogCsv(result: BacktestResult): string {
  return toCsv(
    ["timestamp", "event", "detail"],
    result.executionLog.map((e) => [formatUtc(e.timestamp), e.event, e.detail])
  );
}
