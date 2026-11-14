import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بک‌تستر EMA/SMA — BTCUSDT Intraday V1",
  description: "بک‌تست استراتژی EMA4/EMA16 با فیلتر SMA64 روی BTCUSDT Perpetual (15m, UTC)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
