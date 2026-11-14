import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchFundingRates,
  fetchKlines,
  mapToobitKline,
  toContractSymbol,
} from "@/lib/backtester/data/toobit_adapter";

describe("toobit_adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps contract symbols correctly", () => {
    expect(toContractSymbol("BTCUSDT")).toBe("BTC-SWAP-USDT");
    expect(toContractSymbol("ETHUSDT")).toBe("ETH-SWAP-USDT");
    expect(toContractSymbol("BTC-SWAP-USDT")).toBe("BTC-SWAP-USDT");
  });

  it("maps kline rows to candles", () => {
    const candle = mapToobitKline([
      1704067200000, "42000.5", "42100", "41950", "42050", "123.4", 0, "q", 10, "b", "bq",
    ]);
    expect(candle).toEqual({
      openTime: 1704067200000,
      open: 42000.5,
      high: 42100,
      low: 41950,
      close: 42050,
      volume: 123.4,
    });
  });

  it("paginates klines backwards and returns ascending candles", async () => {
    const base = 1704067200000;
    const page1 = Array.from({ length: 1000 }, (_, i) => [
      base + i * 900_000,
      "100", "101", "99", "100.5", "1", 0, "q", 1, "b", "bq",
    ]);
    const page2 = [
      [base - 900_000, "100", "101", "99", "100.5", "1", 0, "q", 1, "b", "bq"],
    ];
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL) => {
      urls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => (urls.length === 1 ? page1 : page2),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const candles = await fetchKlines("BTCUSDT", 15, base - 900_000, base + 999 * 900_000);
    expect(candles).toHaveLength(1001);
    expect(candles[0].openTime).toBe(base - 900_000);
    expect(candles[1000].openTime).toBe(base + 999 * 900_000);
    expect(urls[0]).toContain("symbol=BTC-SWAP-USDT");
    expect(urls[0]).toContain("interval=15m");
    expect(urls[1]).toContain(`endTime=${base - 1}`);
  });

  it("returns candles when a single short page covers the window", async () => {
    const base = 1704067200000;
    const rows = [
      [base, "100", "101", "99", "100.5", "1", 0, "q", 1, "b", "bq"],
      [base + 900_000, "100", "101", "99", "100.5", "1", 0, "q", 1, "b", "bq"],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => rows }))
    );
    const candles = await fetchKlines("BTCUSDT", 15, base, base + 900_000);
    expect(candles).toHaveLength(2);
    expect(candles[0].openTime).toBe(base);
  });

  it("fetches and filters funding history, sorted ascending", async () => {
    const rows = [
      { id: "30", symbol: "BTC-SWAP-USDT", settleTime: "1704153600000", settleRate: "0.0002", period: "8H" },
      { id: "20", symbol: "BTC-SWAP-USDT", settleTime: "1704076800000", settleRate: "0.0001", period: "8H" },
      { id: "10", symbol: "BTC-SWAP-USDT", settleTime: "1703990400000", settleRate: "0.0003", period: "8H" },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => rows,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const entries = await fetchFundingRates("BTCUSDT", 1704067200000, 1704153600000);
    expect(entries).toHaveLength(2);
    expect(entries[0].fundingTimestamp).toBe(1704076800000);
    expect(entries[0].fundingRate).toBe(0.0001);
    expect(entries[1].fundingRate).toBe(0.0002);
    expect(entries[0].source).toBe("toobit");
  });
});
