"use client";

import { useCallback, useMemo, useState } from "react";
import type { BacktestResult } from "@/lib/backtester/types";
import { MetricCard } from "./MetricCard";
import { DrawdownChart, EquityChart, MonthlyChart } from "./Charts";
import { TradesTable } from "./TradesTable";

function fmt(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? "N/A" : v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function BacktestDashboard({ result }: { result: BacktestResult }) {
  const m = result.metrics;
  const [showAllTrades, setShowAllTrades] = useState(false);
  const visibleTrades = useMemo(
    () => (showAllTrades ? result.trades : result.trades.slice(-50).reverse()),
    [result.trades, showAllTrades]
  );

  const download = useCallback((kind: string) => {
    window.open(`/api/export/${kind}?runId=${encodeURIComponent(result.runId)}`, "_blank");
  }, [result.runId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
        <div className="text-xs text-gray-400" dir="ltr">
          <div>run: {result.runId}</div>
          <div>
            data: {result.metadata.dataStart} → {result.metadata.dataEnd} ({result.metadata.candleCount} candles) ·
            scenario: {result.metadata.scenario} · funding: {result.metadata.fundingStatus}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["trades", "معاملات CSV"],
            ["equity", "منحنی سرمایه CSV"],
            ["monthly", "خلاصه ماهانه CSV"],
            ["metrics", "شاخص‌ها JSON"],
            ["execution_log", "گزارش اجرا CSV"],
          ].map(([kind, label]) => (
            <button
              key={kind}
              onClick={() => download(kind)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
            >
              ⬇ {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="تعداد معاملات" value={fmt(m.totalTrades, 0)} hint={`Long: ${m.longTrades} / Short: ${m.shortTrades}`} />
        <MetricCard
          label="سود خالص (USDT)"
          value={fmt(m.netProfit)}
          tone={m.netProfit > 0 ? "positive" : m.netProfit < 0 ? "negative" : "default"}
          hint={m.netReturnPct === null ? undefined : `${fmt(m.netReturnPct)}%`}
        />
        <MetricCard label="نرخ برد" value={m.winRate === null ? "N/A" : `${fmt(m.winRate * 100, 1)}%`} hint={`${m.winningTrades} برد / ${m.losingTrades} باخت`} />
        <MetricCard
          label="Profit Factor"
          value={m.profitFactor === null ? "N/A" : fmt(m.profitFactor)}
          hint="ناپیرامتر در نبود زیان"
        />
        <MetricCard label="Expectancy" value={fmt(m.expectancyUsdt)} hint={m.expectancyR === null ? undefined : `${fmt(m.expectancyR)} R`} />
        <MetricCard
          label="حداکثر دراودان"
          value={`${fmt(m.maxDrawdownUsdt)} $`}
          tone="negative"
          hint={`${fmt(m.maxDrawdownPct)}%`}
        />
        <MetricCard label="سود ناخالص" value={fmt(m.grossProfit)} tone="positive" />
        <MetricCard label="زیان ناخالص" value={fmt(m.grossLoss)} tone="negative" />
        <MetricCard label="میانگین برد" value={fmt(m.averageWin)} tone="positive" />
        <MetricCard label="میانگین باخت" value={fmt(m.averageLoss)} tone="negative" />
        <MetricCard label="بیشترین رشته برد" value={fmt(m.maxWinStreak, 0)} />
        <MetricCard label="بیشترین رشته باخت" value={fmt(m.maxLossStreak, 0)} />
        <MetricCard label="میانگین زمان نگهداری" value={m.avgHoldingMinutes === null ? "N/A" : `${fmt(m.avgHoldingMinutes, 0)} دقیقه`} />
        <MetricCard label="کارمزد کل" value={fmt(m.totalFees)} tone="negative" />
        <MetricCard label="لغزش کل" value={fmt(m.totalSlippage)} tone="negative" />
        <MetricCard label="Funding خالص" value={fmt(m.netFunding)} hint={result.dataQuality.fundingDataMissing ? "بدون داده Funding" : undefined} />
        <MetricCard label="سود خالص Long" value={fmt(m.longNetPnl)} tone={m.longNetPnl >= 0 ? "positive" : "negative"} hint={m.longWinRate === null ? undefined : `WR ${fmt(m.longWinRate * 100, 1)}%`} />
        <MetricCard label="سود خالص Short" value={fmt(m.shortNetPnl)} tone={m.shortNetPnl >= 0 ? "positive" : "negative"} hint={m.shortWinRate === null ? undefined : `WR ${fmt(m.shortWinRate * 100, 1)}%`} />
        <MetricCard label="سرمایه اولیه" value={fmt(m.initialEquity)} />
        <MetricCard label="سرمایه نهایی" value={fmt(m.finalEquity)} tone={m.finalEquity >= m.initialEquity ? "positive" : "negative"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EquityChart points={result.equityCurve} />
        <DrawdownChart points={result.equityCurve} initialEquity={m.initialEquity} />
      </div>
      <MonthlyChart monthly={result.monthly} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">
            معاملات {showAllTrades ? `(همه — ${result.trades.length})` : "(۵۰ مورد آخر)"}
          </h3>
          {result.trades.length > 50 && (
            <button
              onClick={() => setShowAllTrades((v) => !v)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
            >
              {showAllTrades ? "نمایش ۵۰ مورد آخر" : "نمایش همه"}
            </button>
          )}
        </div>
        <TradesTable trades={visibleTrades} />
      </div>

      <DataQualityPanel result={result} />
    </div>
  );
}

function DataQualityPanel({ result }: { result: BacktestResult }) {
  const q = result.dataQuality;
  const rows: [string, string][] = [
    ["منبع داده", q.source === "binance" ? "Binance Futures (عمومی)" : q.source === "toobit" ? "Toobit Futures (عمومی)" : "CSV بارگذاری‌شده"],
    ["تعداد ردیف خام", String(q.totalRawRows)],
    ["کندل‌های معتبر", String(q.totalValidCandles)],
    ["کندل‌های warm-up", String(q.warmupCandles)],
    ["کندل‌های بک‌تست", String(q.backtestCandles)],
    ["کندل ناقص حذف‌شده", q.droppedIncompleteLastCandle ? "بله" : "خیر"],
    ["تکرار زمان حذف‌شده", String(q.duplicateTimestampsRemoved)],
    ["ردیف OHLC نامعتبر", String(q.invalidOhlcRows)],
    ["شکاف‌های زمانی", String(q.gaps.length)],
    ["تعداد رکورد Funding", String(q.fundingEntries)],
    ["وضعیت Funding", q.fundingDataMissing ? "غایب — بدون هزینه Funding" : "اعمال‌شده"],
  ];
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">گزارش کیفیت داده</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-gray-800/60 py-1">
            <span className="text-gray-400">{k}</span>
            <span className="text-gray-200" dir="ltr">{v}</span>
          </div>
        ))}
      </div>
      {q.gaps.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto text-[11px] text-gray-500" dir="ltr">
          {q.gaps.slice(0, 50).map((g, i) => (
            <div key={i}>
              gap: {new Date(g.from).toISOString()} → {new Date(g.to).toISOString()} ({g.missingBars} bars)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
