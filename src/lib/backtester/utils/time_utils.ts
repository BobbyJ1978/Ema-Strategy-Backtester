export const MS_PER_MINUTE = 60_000;

export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function utcMonthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

export function isMidnightUtc(ms: number): boolean {
  const d = new Date(ms);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
}

export function sameUtcDay(a: number, b: number): boolean {
  return new Date(a).getUTCFullYear() === new Date(b).getUTCFullYear() &&
    new Date(a).getUTCMonth() === new Date(b).getUTCMonth() &&
    new Date(a).getUTCDate() === new Date(b).getUTCDate();
}

export function parseUtcDate(dateStr: string): number {
  const t = Date.parse(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(t)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return t;
}

export function formatUtc(ms: number): string {
  return new Date(ms).toISOString().replace(".000", "");
}
