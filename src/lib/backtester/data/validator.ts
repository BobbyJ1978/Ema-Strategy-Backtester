import type { Candle, DataQualityReport } from "../types";
import { MS_PER_MINUTE } from "../utils/time_utils";

export interface ValidationResult {
  candles: Candle[];
  report: Omit<
    DataQualityReport,
    "warmupCandles" | "backtestCandles" | "fundingEntries" | "fundingDataMissing"
  >;
}

export class DataValidationError extends Error {}

export function validateAndNormalize(
  raw: Candle[],
  timeframeMinutes: number,
  symbol: string,
  source: string
): ValidationResult {
  const expectedStep = timeframeMinutes * MS_PER_MINUTE;
  let unsortedRows = 0;
  let duplicateTimestampsRemoved = 0;
  let invalidOhlcRows = 0;

  for (let i = 1; i < raw.length; i++) {
    if (raw[i].openTime < raw[i - 1].openTime) unsortedRows++;
  }

  const byTime = new Map<number, Candle>();
  for (const c of raw) {
    if (byTime.has(c.openTime)) duplicateTimestampsRemoved++;
    else byTime.set(c.openTime, c);
  }

  const valid: Candle[] = [];
  for (const c of byTime.values()) {
    const ohlcOk =
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.open > 0 &&
      c.high > 0 &&
      c.low > 0 &&
      c.close > 0 &&
      c.high >= Math.max(c.open, c.close) &&
      c.low <= Math.min(c.open, c.close) &&
      c.high >= c.low;
    if (!ohlcOk) {
      invalidOhlcRows++;
      continue;
    }
    valid.push(c);
  }
  valid.sort((a, b) => a.openTime - b.openTime);

  if (unsortedRows > 0 && valid.length < 2) {
    throw new DataValidationError("Critical: candle timestamps are not sorted and no valid series remains.");
  }

  const gaps: { from: number; to: number; missingBars: number }[] = [];
  for (let i = 1; i < valid.length; i++) {
    const diff = valid[i].openTime - valid[i - 1].openTime;
    if (diff !== expectedStep) {
      const missingBars = Math.round(diff / expectedStep) - 1;
      if (missingBars > 0) {
        gaps.push({
          from: valid[i - 1].openTime,
          to: valid[i].openTime,
          missingBars,
        });
      }
    }
  }

  if (valid.length === 0) {
    throw new DataValidationError("Critical: no valid candles after validation.");
  }

  const report = {
    source,
    symbol,
    timeframeMinutes,
    totalRawRows: raw.length,
    totalValidCandles: valid.length,
    droppedIncompleteLastCandle: false,
    duplicateTimestampsRemoved,
    invalidOhlcRows,
    unsortedRows,
    gaps,
    firstCandleTime: valid[0].openTime,
    lastCandleTime: valid[valid.length - 1].openTime,
    volumeType: "base",
  };

  return { candles: valid, report };
}

export function dropIncompleteLastCandle(
  candles: Candle[],
  timeframeMinutes: number,
  nowMs: number
): { candles: Candle[]; dropped: boolean } {
  if (candles.length === 0) return { candles, dropped: false };
  const last = candles[candles.length - 1];
  const candleEnd = last.openTime + timeframeMinutes * MS_PER_MINUTE;
  if (candleEnd > nowMs) {
    return { candles: candles.slice(0, -1), dropped: true };
  }
  return { candles, dropped: false };
}

export function excludeGappedSegments(
  candles: Candle[],
  timeframeMinutes: number
): { candles: Candle[]; excludedRanges: { from: number; to: number }[] } {
  const step = timeframeMinutes * MS_PER_MINUTE;
  const segments: Candle[][] = [[candles[0]]];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].openTime - candles[i - 1].openTime === step) {
      segments[segments.length - 1].push(candles[i]);
    } else {
      segments.push([candles[i]]);
    }
  }
  let best = segments[0];
  for (const s of segments) if (s.length > best.length) best = s;
  const excludedRanges = segments
    .filter((s) => s !== best)
    .map((s) => ({ from: s[0].openTime, to: s[s.length - 1].openTime }));
  return { candles: best, excludedRanges };
}

export function assertWarmup(candles: Candle[], warmupBars: number): void {
  if (candles.length < warmupBars) {
    throw new DataValidationError(
      `Critical: insufficient data for warm-up. Need at least ${warmupBars} candles, got ${candles.length}.`
    );
  }
}
