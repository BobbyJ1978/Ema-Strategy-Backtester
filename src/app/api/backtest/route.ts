import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtester/engine";
import { defaultConfig } from "@/lib/backtester/config";
import type { BacktestRunConfig, Candle, FundingEntry } from "@/lib/backtester/types";
import { fetchKlines, fetchFundingRates } from "@/lib/backtester/data/binance_adapter";
import {
  fetchKlines as fetchToobitKlines,
  fetchFundingRates as fetchToobitFundingRates,
} from "@/lib/backtester/data/toobit_adapter";
import { parseOhlcvCsv } from "@/lib/backtester/data/csv_parser";
import { saveRun } from "@/lib/backtester/storage/run_store";
import { parseUtcDate } from "@/lib/backtester/utils/time_utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RunRequest {
  config?: Partial<BacktestRunConfig>;
  csvContent?: string;
}

export async function POST(req: NextRequest) {
  let body: RunRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cfg: BacktestRunConfig = {
    ...defaultConfig,
    ...body.config,
    strategy: { ...defaultConfig.strategy, ...body.config?.strategy },
    risk: { ...defaultConfig.risk, ...body.config?.risk },
    costs: { ...defaultConfig.costs, ...body.config?.costs },
  };

  try {
    let candles: Candle[] = [];
    let funding: FundingEntry[] = [];

    if (cfg.source === "csv") {
      if (!body.csvContent || body.csvContent.trim().length === 0) {
        return NextResponse.json({ error: "csvContent is required for source=csv" }, { status: 400 });
      }
      candles = parseOhlcvCsv(body.csvContent);
      funding = [];
    } else if (cfg.source === "toobit") {
      const tfMs = cfg.strategy.timeframeMinutes * 60_000;
      const endTime = cfg.endDate ? parseUtcDate(cfg.endDate) + 86_400_000 - tfMs : Date.now();
      const warmupStart = cfg.startDate
        ? parseUtcDate(cfg.startDate) - cfg.warmupBars * tfMs
        : endTime - 400 * 86_400_000;
      candles = await fetchToobitKlines(
        cfg.strategy.symbol,
        cfg.strategy.timeframeMinutes,
        warmupStart,
        endTime
      );
      if (cfg.costs.applyFunding) {
        try {
          funding = await fetchToobitFundingRates(cfg.strategy.symbol, warmupStart, endTime);
        } catch {
          funding = [];
        }
      }
    } else {
      const tfMs = cfg.strategy.timeframeMinutes * 60_000;
      const endTime = cfg.endDate ? parseUtcDate(cfg.endDate) + 86_400_000 - tfMs : Date.now();
      const warmupStart = cfg.startDate
        ? parseUtcDate(cfg.startDate) - cfg.warmupBars * tfMs
        : endTime - 400 * 86_400_000;
      candles = await fetchKlines(cfg.strategy.symbol, `${cfg.strategy.timeframeMinutes}m`, warmupStart, endTime);
      if (cfg.costs.applyFunding) {
        try {
          funding = await fetchFundingRates(cfg.strategy.symbol, warmupStart, endTime);
        } catch {
          funding = [];
        }
      }
    }

    const result = runBacktest(cfg, candles, funding);
    saveRun(result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
