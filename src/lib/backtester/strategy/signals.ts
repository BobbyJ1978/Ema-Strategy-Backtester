import type { Candle, StrategyConfig } from "../types";
import { ema } from "../indicators/ema";
import { sma } from "../indicators/sma";
import { atrWilder } from "../indicators/atr";

export interface IndicatorSeries {
  emaFast: (number | null)[];
  emaMid: (number | null)[];
  smaTrend: (number | null)[];
  atr: (number | null)[];
}

export function computeIndicators(candles: Candle[], cfg: StrategyConfig): IndicatorSeries {
  const closes = candles.map((c) => c.close);
  return {
    emaFast: ema(closes, cfg.emaFast),
    emaMid: ema(closes, cfg.emaMid),
    smaTrend: sma(closes, cfg.smaTrend),
    atr: atrWilder(candles, cfg.atrPeriod),
  };
}

export type SignalSide = "long" | "short";

export interface Signal {
  side: SignalSide;
  index: number;
  timestamp: number;
  atr: number;
}

export function evaluateSignalAt(
  candles: Candle[],
  ind: IndicatorSeries,
  cfg: StrategyConfig,
  t: number
): Signal | null {
  if (t < cfg.smaSlopeLookback + 1) return null;
  const emaFastT = ind.emaFast[t];
  const emaFastPrev = ind.emaFast[t - 1];
  const emaMidT = ind.emaMid[t];
  const emaMidPrev = ind.emaMid[t - 1];
  const smaT = ind.smaTrend[t];
  const smaSlopeRef = ind.smaTrend[t - cfg.smaSlopeLookback];
  const atrT = ind.atr[t];

  if (
    emaFastT === null ||
    emaFastPrev === null ||
    emaMidT === null ||
    emaMidPrev === null ||
    smaT === null ||
    smaSlopeRef === null ||
    atrT === null ||
    atrT <= 0
  ) {
    return null;
  }

  const closeT = candles[t].close;
  const longCross =
    emaFastPrev <= emaMidPrev && emaFastT > emaMidT;
  const shortCross =
    emaFastPrev >= emaMidPrev && emaFastT < emaMidT;

  const longFilter =
    closeT > smaT && smaT > smaSlopeRef && emaMidT > smaT;
  const shortFilter =
    closeT < smaT && smaT < smaSlopeRef && emaMidT < smaT;

  if (cfg.allowLong && longCross && longFilter) {
    return { side: "long", index: t, timestamp: candles[t].openTime, atr: atrT };
  }
  if (cfg.allowShort && shortCross && shortFilter) {
    return { side: "short", index: t, timestamp: candles[t].openTime, atr: atrT };
  }
  return null;
}

export function oppositeCrossAt(
  ind: IndicatorSeries,
  cfg: StrategyConfig,
  positionSide: SignalSide,
  t: number
): boolean {
  const fastT = ind.emaFast[t];
  const fastPrev = ind.emaFast[t - 1];
  const midT = ind.emaMid[t];
  const midPrev = ind.emaMid[t - 1];
  if (fastT === null || fastPrev === null || midT === null || midPrev === null) return false;
  if (positionSide === "long") {
    return fastPrev >= midPrev && fastT < midT;
  }
  return fastPrev <= midPrev && fastT > midT;
}
