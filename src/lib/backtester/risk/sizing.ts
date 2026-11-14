import type { RiskConfig } from "../types";

export interface SizingResult {
  quantity: number;
  riskBudget: number;
  skipped: boolean;
  reason?: string;
}

export function roundToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

export function computePositionSize(
  equity: number,
  entryPrice: number,
  stopLoss: number,
  cfg: RiskConfig
): SizingResult {
  const riskBudget = equity * cfg.riskFraction;
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  if (!(riskPerUnit > 0)) {
    return { quantity: 0, riskBudget, skipped: true, reason: "invalid_risk_per_unit" };
  }
  const rawQty = riskBudget / riskPerUnit;
  const qty = roundToStep(rawQty, cfg.quantityStep);
  if (!Number.isFinite(qty) || qty < cfg.minQuantity) {
    return {
      quantity: qty,
      riskBudget,
      skipped: true,
      reason: `quantity_below_min (${qty} < ${cfg.minQuantity})`,
    };
  }
  return { quantity: qty, riskBudget, skipped: false };
}
