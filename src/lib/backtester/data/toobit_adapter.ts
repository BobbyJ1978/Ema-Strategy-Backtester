import type { Candle, FundingEntry } from "../types";

const API_BASE = process.env.TOOBIT_API_BASE || "https://api.toobit.com";
const KLINE_PAGE = 1000;
const FUNDING_PAGE = 1000;
const MAX_KLINE_PAGES = 50;
const MAX_FUNDING_PAGES = 200;

export function toContractSymbol(symbol: string): string {
  if (symbol.includes("-SWAP-")) return symbol;
  if (symbol.endsWith("USDT")) return `${symbol.slice(0, -4)}-SWAP-USDT`;
  return symbol;
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error ? ` — ${err.cause.message}` : "";
    throw new Error(
      `اتصال به Toobit برقرار نشد (${API_BASE})${cause}. ` +
        `اتصال اینترنت سرور را بررسی کنید یا در فرم داشبورد منبع داده را روی CSV بگذارید.`
    );
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Toobit request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function mapToobitKline(row: unknown[]): Candle {
  return {
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

export async function fetchKlines(
  symbol: string,
  intervalMinutes: number,
  startTimeMs: number,
  endTimeMs: number
): Promise<Candle[]> {
  const contractSymbol = toContractSymbol(symbol);
  const interval = `${intervalMinutes}m`;
  const pages: Candle[][] = [];
  let endCursor = endTimeMs;
  for (let page = 0; page < MAX_KLINE_PAGES; page++) {
    if (endCursor <= startTimeMs) break;
    const url =
      `${API_BASE}/quote/v1/contract/klines?symbol=${encodeURIComponent(contractSymbol)}` +
      `&interval=${interval}&startTime=${startTimeMs}&endTime=${endCursor}&limit=${KLINE_PAGE}`;
    const rows = await fetchJson<unknown[][]>(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    pages.push(rows.map(mapToobitKline));
    const firstOpen = Number(rows[0][0]);
    if (!Number.isFinite(firstOpen)) break;
    if (rows.length < KLINE_PAGE) break;
    const nextEnd = firstOpen - 1;
    if (nextEnd >= endCursor) break;
    endCursor = nextEnd;
  }
  return pages.reverse().flat();
}

interface ToobitFundingRow {
  id: string;
  symbol: string;
  settleTime: string;
  settleRate: string;
  period: string;
}

export async function fetchFundingRates(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<FundingEntry[]> {
  const contractSymbol = toContractSymbol(symbol);
  const entries: FundingEntry[] = [];
  const retrievedAt = Date.now();
  let endId: number | null = null;
  for (let page = 0; page < MAX_FUNDING_PAGES; page++) {
    let url = `${API_BASE}/api/v1/futures/historyFundingRate?symbol=${encodeURIComponent(
      contractSymbol
    )}&limit=${FUNDING_PAGE}`;
    if (endId !== null) url += `&endId=${endId}`;
    const rows = await fetchJson<ToobitFundingRow[]>(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      const t = Number(r.settleTime);
      if (t >= startTimeMs && t <= endTimeMs) {
        entries.push({
          fundingTimestamp: t,
          fundingRate: Number(r.settleRate),
          symbol,
          source: "toobit",
          retrievedAt,
        });
      }
    }
    const oldest = rows[rows.length - 1];
    if (rows.length < FUNDING_PAGE || Number(oldest.settleTime) < startTimeMs) break;
    const nextEndId = Number(oldest.id) - 1;
    if (!Number.isFinite(nextEndId) || nextEndId <= 0 || nextEndId === endId) break;
    endId = nextEndId;
  }
  return entries.sort((a, b) => a.fundingTimestamp - b.fundingTimestamp);
}
