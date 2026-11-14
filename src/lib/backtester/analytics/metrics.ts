import type { EquityPoint, Metrics, MonthlyRow, SideSummary, Trade } from "../types";
import { utcMonthKey } from "../utils/time_utils";

function round(v: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function computeMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialEquity: number,
  finalEquity: number
): Metrics {
  const total = trades.length;
  const longs = trades.filter((t) => t.side === "long");
  const shorts = trades.filter((t) => t.side === "short");
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);

  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const netProfit = finalEquity - initialEquity;

  const winRate = total > 0 ? wins.length / total : null;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null;
  const expectancyUsdt = total > 0 ? netProfit / total : null;
  const rSum = trades.reduce((s, t) => s + t.rMultiple, 0);
  const expectancyR = total > 0 ? rSum / total : null;
  const averageWin = wins.length > 0 ? grossProfit / wins.length : null;
  const averageLoss = losses.length > 0 ? grossLoss / losses.length : null;

  let peak = initialEquity;
  let maxDdUsdt = 0;
  let maxDdPct = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak - point.equity;
    if (dd > maxDdUsdt) {
      maxDdUsdt = dd;
      maxDdPct = (dd / peak) * 100;
    }
  }

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of trades) {
    if (t.netPnl > 0) {
      curWin++;
      curLoss = 0;
    } else {
      curLoss++;
      curWin = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, curWin);
    maxLossStreak = Math.max(maxLossStreak, curLoss);
  }

  const avgHolding =
    total > 0 ? trades.reduce((s, t) => s + t.holdingMinutes, 0) / total : null;

  const firstTrade = trades[0];
  const lastTrade = trades[total - 1];
  let avgTradesPerDay: number | null = null;
  if (total > 0 && firstTrade && lastTrade) {
    const spanDays = Math.max(
      1,
      Math.ceil((lastTrade.exitTimestamp - firstTrade.entryTimestamp) / 86_400_000)
    );
    avgTradesPerDay = total / spanDays;
  }

  const sideSummary = (list: Trade[]): SideSummary => ({
    trades: list.length,
    netPnl: round(list.reduce((s, t) => s + t.netPnl, 0)),
    winRate:
      list.length > 0
        ? round(list.filter((t) => t.netPnl > 0).length / list.length, 4)
        : null,
    profitFactor: (() => {
      const gp = list.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
      const gl = Math.abs(list.filter((t) => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0));
      return gl > 0 ? round(gp / gl, 4) : null;
    })(),
  });

  return {
    totalTrades: total,
    longTrades: longs.length,
    shortTrades: shorts.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: winRate === null ? null : round(winRate, 4),
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    netProfit: round(netProfit),
    netReturnPct: initialEquity > 0 ? round((netProfit / initialEquity) * 100, 4) : null,
    profitFactor: profitFactor === null ? null : round(profitFactor, 4),
    expectancyUsdt: expectancyUsdt === null ? null : round(expectancyUsdt),
    expectancyR: expectancyR === null ? null : round(expectancyR, 4),
    averageWin: averageWin === null ? null : round(averageWin),
    averageLoss: averageLoss === null ? null : round(averageLoss),
    maxDrawdownUsdt: round(maxDdUsdt),
    maxDrawdownPct: round(maxDdPct, 4),
    maxWinStreak,
    maxLossStreak,
    avgHoldingMinutes: avgHolding === null ? null : round(avgHolding, 2),
    avgTradesPerDay: avgTradesPerDay === null ? null : round(avgTradesPerDay, 4),
    totalFees: round(trades.reduce((s, t) => s + t.entryFee + t.exitFee, 0)),
    totalSlippage: round(trades.reduce((s, t) => s + t.slippageCost, 0)),
    netFunding: round(trades.reduce((s, t) => s + t.fundingPnl, 0)),
    longNetPnl: round(longs.reduce((s, t) => s + t.netPnl, 0)),
    shortNetPnl: round(shorts.reduce((s, t) => s + t.netPnl, 0)),
    longWinRate:
      longs.length > 0
        ? round(longs.filter((t) => t.netPnl > 0).length / longs.length, 4)
        : null,
    shortWinRate:
      shorts.length > 0
        ? round(shorts.filter((t) => t.netPnl > 0).length / shorts.length, 4)
        : null,
    initialEquity,
    finalEquity: round(finalEquity),
  };
}

export function computeMonthly(trades: Trade[]): MonthlyRow[] {
  const map = new Map<string, { trades: number; netPnl: number; wins: number }>();
  for (const t of trades) {
    const key = utcMonthKey(t.exitTimestamp);
    const cur = map.get(key) || { trades: 0, netPnl: 0, wins: 0 };
    cur.trades += 1;
    cur.netPnl += t.netPnl;
    if (t.netPnl > 0) cur.wins += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      trades: v.trades,
      netPnl: Math.round(v.netPnl * 1e6) / 1e6,
      winRate: v.trades > 0 ? Math.round((v.wins / v.trades) * 1e4) / 1e4 : null,
    }));
}
