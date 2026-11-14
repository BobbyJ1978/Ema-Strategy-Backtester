"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint, MonthlyRow } from "@/lib/backtester/types";

function fmtDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function EquityChart({ points }: { points: EquityPoint[] }) {
  const data = points.map((p) => ({ t: p.timestamp, equity: p.equity }));
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">منحنی سرمایه (Equity Curve)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={fmtDate} stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
            labelFormatter={(v) => fmtDate(Number(v))}
          />
          <Area type="monotone" dataKey="equity" stroke="#22d3ee" fill="url(#eq)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DrawdownChart({ points, initialEquity }: { points: EquityPoint[]; initialEquity: number }) {
  let peak = initialEquity;
  const data = points.map((p) => {
    peak = Math.max(peak, p.equity);
    return { t: p.timestamp, dd: -((peak - p.equity) / peak) * 100 };
  });
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">دراودان (%)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={fmtDate} stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
            labelFormatter={(v) => fmtDate(Number(v))}
            formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
          />
          <Area type="monotone" dataKey="dd" stroke="#fb7185" fill="#fb7185" fillOpacity={0.25} strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyChart({ monthly }: { monthly: MonthlyRow[] }) {
  const data = monthly.map((m) => ({ month: m.month, netPnl: m.netPnl }));
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">سود و زیان ماهانه (USDT)</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
            formatter={(v: number) => [v.toFixed(2), "Net PnL"]}
          />
          <ReferenceLine y={0} stroke="#4b5563" />
          <Bar dataKey="netPnl">
            {data.map((d, i) => (
              <Cell key={i} fill={d.netPnl >= 0 ? "#34d399" : "#fb7185"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
