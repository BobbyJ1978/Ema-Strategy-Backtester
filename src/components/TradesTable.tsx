"use client";

import type { Trade } from "@/lib/backtester/types";
import { formatUtc } from "@/lib/backtester/utils/time_utils";

export function TradesTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-6 text-center text-sm text-gray-400">
        هیچ معامله‌ای در این بازه تولید نشد.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/60">
      <table className="w-full min-w-[1100px] text-left text-xs" dir="ltr">
        <thead className="bg-gray-800/80 text-gray-300">
          <tr>
            {[
              "#", "Side", "Signal", "Entry", "Entry $", "Qty", "SL", "TP", "Exit",
              "Exit $", "Reason", "Gross", "Fees", "Slip", "Funding", "Net", "R", "Min", "Equity",
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.tradeId} className="border-t border-gray-800 hover:bg-gray-800/40">
              <td className="px-3 py-1.5">{t.tradeId}</td>
              <td className={`px-3 py-1.5 font-semibold ${t.side === "long" ? "text-emerald-400" : "text-rose-400"}`}>
                {t.side.toUpperCase()}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{formatUtc(t.signalTimestamp)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{formatUtc(t.entryTimestamp)}</td>
              <td className="px-3 py-1.5">{t.entryPrice.toFixed(2)}</td>
              <td className="px-3 py-1.5">{t.quantity}</td>
              <td className="px-3 py-1.5">{t.stopLossInitial.toFixed(2)}</td>
              <td className="px-3 py-1.5">{t.takeProfitInitial.toFixed(2)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{formatUtc(t.exitTimestamp)}</td>
              <td className="px-3 py-1.5">{t.exitPrice.toFixed(2)}</td>
              <td className="px-3 py-1.5">{t.exitReason}</td>
              <td className={`px-3 py-1.5 ${t.grossPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {t.grossPnl.toFixed(2)}
              </td>
              <td className="px-3 py-1.5 text-gray-400">{(t.entryFee + t.exitFee).toFixed(2)}</td>
              <td className="px-3 py-1.5 text-gray-400">{t.slippageCost.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-gray-400">{t.fundingPnl.toFixed(4)}</td>
              <td className={`px-3 py-1.5 font-semibold ${t.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {t.netPnl.toFixed(2)}
              </td>
              <td className="px-3 py-1.5">{t.rMultiple.toFixed(2)}</td>
              <td className="px-3 py-1.5">{t.holdingMinutes}</td>
              <td className="px-3 py-1.5">{t.equityAfterTrade.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
