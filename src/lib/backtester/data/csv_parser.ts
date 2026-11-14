import type { Candle } from "../types";

function detectDelimiter(line: string): string {
  if (line.includes(";")) return ";";
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  return " ";
}

export function parseOhlcvCsv(content: string): Candle[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }
  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const findCol = (...names: string[]): number => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const timeIdx = findCol("timestamp", "open_time", "opentime", "time", "date", "datetime");
  const openIdx = findCol("open");
  const highIdx = findCol("high");
  const lowIdx = findCol("low");
  const closeIdx = findCol("close", "close_price");
  const volIdx = findCol("volume", "vol", "base_volume");

  if (timeIdx === -1 || openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error(
      "CSV header must include timestamp, open, high, low, close (and optionally volume) columns."
    );
  }

  const candles: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/"/g, ""));
    const ts = parseTimestamp(parts[timeIdx]);
    if (ts === null) continue;
    candles.push({
      openTime: ts,
      open: Number(parts[openIdx]),
      high: Number(parts[highIdx]),
      low: Number(parts[lowIdx]),
      close: Number(parts[closeIdx]),
      volume: volIdx !== -1 ? Number(parts[volIdx]) : 0,
    });
  }
  return candles;
}

function parseTimestamp(value: string): number | null {
  if (/^-?\d+$/.test(value)) {
    const n = Number(value);
    if (n > 1e12) return n;
    if (n > 1e9) return n * 1000;
    return n;
  }
  const t = Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(t) ? null : t;
}
