import type {
  BacktestRunConfig,
  Candle,
  EquityPoint,
  ExecutionLogEntry,
  FundingEntry,
  Side,
  Trade,
} from "../types";
import { computeIndicators, evaluateSignalAt, oppositeCrossAt, type Signal } from "../strategy/signals";
import { computePositionSize } from "../risk/sizing";
import {
  applySlippage,
  entryFee,
  exitFee,
  fundingEventsBetween,
} from "../costs/costs";
import { formatUtc, isMidnightUtc, sameUtcDay } from "../utils/time_utils";

const MS_PER_DAY = 86_400_000;

interface OpenPosition {
  side: Side;
  signalTimestamp: number;
  entryTimestamp: number;
  entryPrice: number;
  quantity: number;
  initialEquity: number;
  riskBudget: number;
  atrAtSignal: number;
  stopLoss: number;
  takeProfit: number;
  entryFee: number;
  slippageCost: number;
  fundingPnl: number;
  lastFundingCheck: number;
}

export interface SimulationOutput {
  trades: Trade[];
  equityCurve: EquityPoint[];
  executionLog: ExecutionLogEntry[];
  finalEquity: number;
}

export function runSimulation(
  candles: Candle[],
  funding: FundingEntry[],
  cfg: BacktestRunConfig,
  startIdx: number,
  signalProvider?: (t: number) => Signal | null
): SimulationOutput {
  const { strategy, risk, costs } = cfg;
  const ind = computeIndicators(candles, strategy);
  const stepMs = strategy.timeframeMinutes * 60_000;

  let equity = risk.initialEquity;
  let tradeId = 0;
  let position: OpenPosition | null = null;
  let pendingSignal: Signal | null = null;
  let pendingExit = false;

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  const executionLog: ExecutionLogEntry[] = [];

  const log = (timestamp: number, event: string, detail: string) => {
    executionLog.push({ timestamp, event, detail });
  };

  const closePosition = (
    pos: OpenPosition,
    exitTimestamp: number,
    exitPriceRaw: number,
    exitSide: "buy" | "sell",
    reason: Trade["exitReason"]
  ) => {
    const exitPrice = applySlippage(exitPriceRaw, exitSide, costs.slippageBpsExit);
    const exitNotional = exitPrice * pos.quantity;
    const ef = exitFee(exitNotional, costs);

    const fundingEvents = costs.applyFunding
      ? fundingEventsBetween(funding, pos.lastFundingCheck, exitTimestamp, pos.side, pos.entryPrice * pos.quantity)
      : [];
    let fundingPnl = pos.fundingPnl;
    for (const ev of fundingEvents) {
      fundingPnl += ev.pnl;
      log(ev.timestamp, "funding", `${pos.side} ${ev.pnl.toFixed(6)} USDT`);
    }

    const sign = pos.side === "long" ? 1 : -1;
    const grossPnl = sign * pos.quantity * (exitPrice - pos.entryPrice);
    const netPnl = grossPnl - pos.entryFee - ef + fundingPnl;
    const slippageCost = pos.slippageCost + Math.abs(exitPrice - exitPriceRaw) * pos.quantity;
    equity += netPnl;

    tradeId += 1;
    trades.push({
      tradeId,
      symbol: strategy.symbol,
      side: pos.side,
      signalTimestamp: pos.signalTimestamp,
      entryTimestamp: pos.entryTimestamp,
      entryPrice: pos.entryPrice,
      quantity: pos.quantity,
      initialEquity: pos.initialEquity,
      riskBudget: pos.riskBudget,
      atrAtSignal: pos.atrAtSignal,
      stopLossInitial: pos.stopLoss,
      takeProfitInitial: pos.takeProfit,
      exitTimestamp,
      exitPrice,
      exitReason: reason,
      grossPnl,
      entryFee: pos.entryFee,
      exitFee: ef,
      slippageCost,
      fundingPnl,
      netPnl,
      rMultiple: pos.riskBudget > 0 ? netPnl / pos.riskBudget : 0,
      holdingMinutes: (exitTimestamp - pos.entryTimestamp) / 60_000,
      equityAfterTrade: equity,
    });
    equityCurve.push({ timestamp: exitTimestamp, equity, event: "trade_close" });
    log(
      exitTimestamp,
      "exit",
      `${pos.side} exit=${exitPrice.toFixed(2)} reason=${reason} netPnl=${netPnl.toFixed(4)}`
    );
    position = null;
    pendingExit = false;
  };

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    const candleEnd = c.openTime + stepMs;
    const isLastCandleOfDay = candleEnd % MS_PER_DAY === 0;

    if (position && pendingExit) {
      closePosition(position, c.openTime, c.open, position.side === "long" ? "sell" : "buy", "opposite_cross");
    } else if (!position && pendingSignal) {
      const sig = pendingSignal;
      pendingSignal = null;
      const entryAllowed =
        sameUtcDay(sig.timestamp, c.openTime) && !isMidnightUtc(c.openTime);
      if (!entryAllowed) {
        log(
          c.openTime,
          "entry_skipped",
          sig.side === "long"
            ? "next candle is outside signal day or opens at 00:00 UTC"
            : "next candle is outside signal day or opens at 00:00 UTC"
        );
      } else {
        const side = sig.side;
        const entrySide = side === "long" ? "buy" : "sell";
        const entryPrice = applySlippage(c.open, entrySide, costs.slippageBpsEntry);
        const slDistance = strategy.stopAtrMultiple * sig.atr;
        if (!(slDistance > 0)) {
          log(c.openTime, "entry_skipped", "invalid ATR at signal");
        } else {
          const stopLoss =
            side === "long" ? entryPrice - slDistance : entryPrice + slDistance;
          const takeProfit =
            side === "long"
              ? entryPrice + strategy.rewardRiskRatio * slDistance
              : entryPrice - strategy.rewardRiskRatio * slDistance;
          const sizing = computePositionSize(equity, entryPrice, stopLoss, risk);
          if (sizing.skipped) {
            log(c.openTime, "entry_skipped", `sizing: ${sizing.reason}`);
          } else {
            const entryNotional = entryPrice * sizing.quantity;
            const ef = entryFee(entryNotional, costs);
            position = {
              side,
              signalTimestamp: sig.timestamp,
              entryTimestamp: c.openTime,
              entryPrice,
              quantity: sizing.quantity,
              initialEquity: equity,
              riskBudget: sizing.riskBudget,
              atrAtSignal: sig.atr,
              stopLoss,
              takeProfit,
              entryFee: ef,
              slippageCost: Math.abs(entryPrice - c.open) * sizing.quantity,
              fundingPnl: 0,
              lastFundingCheck: c.openTime,
            };
            log(
              c.openTime,
              "entry",
              `${side} entry=${entryPrice.toFixed(2)} qty=${sizing.quantity} SL=${stopLoss.toFixed(2)} TP=${takeProfit.toFixed(2)}`
            );
          }
        }
      }
    }

    if (position) {
      const pos = position;
      const isLong = pos.side === "long";
      const exitSide = isLong ? "sell" : "buy";
      const openGapSL = isLong ? c.open <= pos.stopLoss : c.open >= pos.stopLoss;
      const touchSL = isLong ? c.low <= pos.stopLoss : c.high >= pos.stopLoss;
      const touchTP = isLong ? c.high >= pos.takeProfit : c.low <= pos.takeProfit;

      if (openGapSL) {
        closePosition(pos, c.openTime, c.open, exitSide, "stop_loss");
      } else if (touchSL) {
        closePosition(pos, c.openTime, pos.stopLoss, exitSide, "stop_loss");
      } else if (touchTP) {
        closePosition(pos, c.openTime, pos.takeProfit, exitSide, "take_profit");
      }
    }

    if (position) {
      const pos = position;
      const fundingUpTo = Math.min(candleEnd, pos.lastFundingCheck + stepMs);
      if (costs.applyFunding) {
        const events = fundingEventsBetween(
          funding,
          pos.lastFundingCheck,
          fundingUpTo,
          pos.side,
          pos.entryPrice * pos.quantity
        );
        for (const ev of events) {
          pos.fundingPnl += ev.pnl;
          log(ev.timestamp, "funding", `${pos.side} ${ev.pnl.toFixed(6)} USDT`);
        }
      }
      pos.lastFundingCheck = fundingUpTo;

      if (strategy.oppositeCrossExit && oppositeCrossAt(ind, strategy, pos.side, i)) {
        pendingExit = true;
        log(c.openTime, "opposite_cross_detected", `exit planned for next candle open`);
      }
    }

    if (position && strategy.dailyClose && isLastCandleOfDay) {
      const pos = position;
      closePosition(pos, candleEnd, c.close, pos.side === "long" ? "sell" : "buy", "daily_close");
    }

    if (!position && !pendingSignal) {
      const sig = signalProvider
        ? signalProvider(i)
        : evaluateSignalAt(candles, ind, strategy, i);
      if (sig) {
        pendingSignal = sig;
        log(c.openTime, "signal", `${sig.side} at ${formatUtc(sig.timestamp)} atr=${sig.atr.toFixed(2)}`);
      }
    }

    if (isLastCandleOfDay) {
      equityCurve.push({ timestamp: candleEnd, equity, event: "day_end" });
    }
  }

  if (position) {
    const last = candles[candles.length - 1];
    closePosition(
      position,
      last.openTime + stepMs,
      last.close,
      position.side === "long" ? "sell" : "buy",
      "daily_close"
    );
    log(last.openTime, "forced_close", "position force-closed at end of data");
  }
  equityCurve.push({ timestamp: candles[candles.length - 1].openTime + stepMs, equity, event: "final" });

  return { trades, equityCurve, executionLog, finalEquity: equity };
}
