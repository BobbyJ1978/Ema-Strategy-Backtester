"use client";

import { useState } from "react";
import type { BacktestResult } from "@/lib/backtester/types";
import { BacktestDashboard } from "@/components/BacktestDashboard";

interface FormState {
  source: "binance" | "csv" | "toobit";
  startDate: string;
  endDate: string;
  initialEquity: number;
  riskFractionPct: number;
  feeRatePct: number;
  slippageBps: number;
  applyFunding: boolean;
  allowLong: boolean;
  allowShort: boolean;
  stopAtrMultiple: number;
  rewardRiskRatio: number;
  warmupBars: number;
  csvContent: string;
}

const initialForm: FormState = {
  source: "binance",
  startDate: "",
  endDate: "",
  initialEquity: 10000,
  riskFractionPct: 0.5,
  feeRatePct: 0.05,
  slippageBps: 0,
  applyFunding: true,
  allowLong: true,
  allowShort: true,
  stopAtrMultiple: 1.5,
  rewardRiskRatio: 2.0,
  warmupBars: 200,
  csvContent: "",
};

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function runBacktest() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            source: form.source,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            warmupBars: form.warmupBars,
            strategy: {
              allowLong: form.allowLong,
              allowShort: form.allowShort,
              stopAtrMultiple: form.stopAtrMultiple,
              rewardRiskRatio: form.rewardRiskRatio,
            },
            risk: {
              initialEquity: form.initialEquity,
              riskFraction: form.riskFractionPct / 100,
            },
            costs: {
              feeRateEntry: form.feeRatePct / 100,
              feeRateExit: form.feeRatePct / 100,
              slippageBpsEntry: form.slippageBps,
              slippageBpsExit: form.slippageBps,
              applyFunding: form.applyFunding,
            },
          },
          csvContent: form.source === "csv" ? form.csvContent : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در اجرای بک‌تست");
        return;
      }
      setResult(data as BacktestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای شبکه");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500";
  const labelCls = "mb-1 block text-xs font-medium text-gray-400";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">
          بک‌تستر EMA4/EMA16 + فیلتر SMA64
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          BTCUSDT Perpetual Futures · تایم‌فریم 15m · منطقه زمانی UTC · بدون نگهداری شبانه · بدون ارسال سفارش واقعی
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">تنظیمات بک‌تست</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className={labelCls}>منبع داده</label>
            <select
              value={form.source}
              onChange={(e) => set("source", e.target.value as FormState["source"])}
              className={inputCls}
            >
              <option value="toobit">Toobit (عمومی)</option>
              <option value="binance">Binance (عمومی)</option>
              <option value="csv">بارگذاری CSV</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>تاریخ شروع (UTC)</label>
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>تاریخ پایان (UTC)</label>
            <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>سرمایه اولیه (USDT)</label>
            <input type="number" value={form.initialEquity} min={100} onChange={(e) => set("initialEquity", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ریسک هر معامله (%)</label>
            <input type="number" step="0.1" value={form.riskFractionPct} onChange={(e) => set("riskFractionPct", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>کارمزد هر طرف (%)</label>
            <input type="number" step="0.01" value={form.feeRatePct} onChange={(e) => set("feeRatePct", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>لغزش (basis point)</label>
            <input type="number" value={form.slippageBps} min={0} onChange={(e) => set("slippageBps", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ضریب ATR حد ضرر</label>
            <input type="number" step="0.1" value={form.stopAtrMultiple} onChange={(e) => set("stopAtrMultiple", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>نسبت ریوارد/ریسک</label>
            <input type="number" step="0.1" value={form.rewardRiskRatio} onChange={(e) => set("rewardRiskRatio", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>کندل‌های Warm-up</label>
            <input type="number" value={form.warmupBars} min={200} onChange={(e) => set("warmupBars", Number(e.target.value))} className={inputCls} />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={form.allowLong} onChange={(e) => set("allowLong", e.target.checked)} />
              Long
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={form.allowShort} onChange={(e) => set("allowShort", e.target.checked)} />
              Short
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={form.applyFunding} onChange={(e) => set("applyFunding", e.target.checked)} />
              اعمال Funding
            </label>
          </div>
        </div>

        {form.source === "csv" && (
          <div className="mt-4">
            <label className={labelCls}>
              محتوای CSV کندل‌ها (ستون‌ها: timestamp, open, high, low, close, volume)
            </label>
            <textarea
              value={form.csvContent}
              onChange={(e) => set("csvContent", e.target.value)}
              rows={6}
              placeholder="timestamp,open,high,low,close,volume"
              className={`${inputCls} font-mono text-xs`}
              dir="ltr"
            />
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={runBacktest}
            disabled={loading}
            className="rounded-md bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? "در حال اجرا…" : "اجرای بک‌تست"}
          </button>
          <span className="text-[11px] text-gray-500">
            نرخ کارمزد مقدار پیش‌فرض قابل‌تغییر است؛ آن را با نرخ حساب خود تطبیق دهید.
          </span>
        </div>
        {error && (
          <div className="mt-4 rounded-md border border-rose-800 bg-rose-950/60 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}
      </section>

      {result && <BacktestDashboard result={result} />}

      {!result && !loading && (
        <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-6 text-sm leading-7 text-gray-400">
          <h2 className="mb-2 font-semibold text-gray-300">قوانین استراتژی (نسخه B — V1)</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>کراس صعودی EMA4/EMA16 + فیلتر روند (Close بالای SMA64، شیب مثبت SMA64 با تأخیر ۴ کندل، EMA16 بالای SMA64) → سیگنال Long؛ حالت معکوس → Short.</li>
            <li>ورود Market در Open کندل بعد از بسته‌شدن کندل سیگنال؛ ورود در 00:00 UTC یا کندل خارج از روز سیگنال مجاز نیست.</li>
            <li>حد ضرر = 1.5×ATR14 و حد سود = 2×فاصله حد ضرر؛ در برخورد هم‌زمان، SL اولویت دارد.</li>
            <li>خروج‌ها: SL، TP، کراس معکوس (در Open کندل بعد) و بستن اجباری پایان روز UTC.</li>
            <li>حجم پوزیشن بر اساس ریسک ثابت درصدی از Equity و گرد شدن به گام حجم صرافی.</li>
            <li>کارمزد ورود/خروج، لغزش و Funding تاریخی به‌صورت شفاف جداگانه محاسبه و گزارش می‌شوند.</li>
          </ul>
        </section>
      )}
    </main>
  );
}
