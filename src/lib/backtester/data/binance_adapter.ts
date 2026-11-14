import type { Candle, FundingEntry } from "../types";

const FAPI_BASE = process.env.BINANCE_FAPI_BASE || "https://fapi.binance.com";

interface KlineRow {
  0: number;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error ? ` — ${err.cause.message}` : "";
    throw new Error(
      `اتصال به Binance برقرار نشد (${FAPI_BASE})${cause}. ` +
        `دلایل رایج: مسدود بودن دسترسی به Binance در منطقه شما یا عدم اتصال اینترنت سرور. ` +
        `راه‌حل: فایل .env.example را به .env کپی کنید و BINANCE_FAPI_BASE را به یک آینه جایگزین تنظیم کنید، ` +
        `یا در فرم داشبورد منبع داده را روی CSV بگذارید و فایل کندل‌ها را وارد کنید.`
    );
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 451 || res.status === 403) {
      throw new Error(
        `دسترسی به Binance از IP شما مسدود است (HTTP ${res.status}). ` +
          `متغیر BINANCE_FAPI_BASE را در فایل .env به یک آینه جایگزین تغییر دهید یا از منبع CSV استفاده کنید.`
      );
    }
    throw new Error(`Binance request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<Candle[]> {
  const candles: Candle[] = [];
  let cursor = startTimeMs;
  while (cursor < endTimeMs) {
    const url = `${FAPI_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(
      symbol
    )}&interval=${interval}&startTime=${cursor}&endTime=${endTimeMs}&limit=1500`;
    const rows = await fetchJson<KlineRow[]>(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      candles.push({
        openTime: r[0],
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      });
    }
    const lastOpen = rows[rows.length - 1][0];
    if (rows.length < 1500) break;
    cursor = lastOpen + 1;
  }
  return candles;
}

export async function fetchFundingRates(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<FundingEntry[]> {
  const entries: FundingEntry[] = [];
  let cursor = startTimeMs;
  const now = Date.now();
  for (;;) {
    const url = `${FAPI_BASE}/fapi/v1/fundingRate?symbol=${encodeURIComponent(
      symbol
    )}&startTime=${cursor}&endTime=${endTimeMs}&limit=1000`;
    const rows = await fetchJson<{ fundingTime: number; fundingRate: string }[]>(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    const retrievedAt = now;
    for (const r of rows) {
      entries.push({
        fundingTimestamp: r.fundingTime,
        fundingRate: Number(r.fundingRate),
        symbol,
        source: "binance",
        retrievedAt,
      });
    }
    if (rows.length < 1000) break;
    cursor = rows[rows.length - 1].fundingTime + 1;
  }
  return entries;
}
