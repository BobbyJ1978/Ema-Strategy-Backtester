import type { CostsConfig, FundingEntry } from "../types";

export function applySlippage(price: number, side: "buy" | "sell", slippageBps: number): number {
  const factor = (slippageBps / 10_000) * (side === "buy" ? 1 : -1);
  return price * (1 + factor);
}

export function entryFee(notional: number, cfg: CostsConfig): number {
  return notional * cfg.feeRateEntry;
}

export function exitFee(notional: number, cfg: CostsConfig): number {
  return notional * cfg.feeRateExit;
}

export function fundingPnlForPosition(
  side: "long" | "short",
  rate: number,
  notional: number
): number {
  const sign = side === "long" ? -1 : 1;
  return sign * rate * notional;
}

export interface FundingEvent {
  timestamp: number;
  pnl: number;
}

export function fundingEventsBetween(
  funding: FundingEntry[],
  fromMs: number,
  toMs: number,
  side: "long" | "short",
  notional: number
): FundingEvent[] {
  const events: FundingEvent[] = [];
  for (const f of funding) {
    if (f.fundingTimestamp > fromMs && f.fundingTimestamp <= toMs) {
      events.push({
        timestamp: f.fundingTimestamp,
        pnl: fundingPnlForPosition(side, f.fundingRate, notional),
      });
    }
  }
  return events;
}
