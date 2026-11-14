import { NextRequest, NextResponse } from "next/server";
import { getRun, latestRun } from "@/lib/backtester/storage/run_store";
import {
  tradesCsv,
  equityCsv,
  monthlyCsv,
  executionLogCsv,
} from "@/lib/backtester/storage/csv_export";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { kind: string } }
) {
  const runId = req.nextUrl.searchParams.get("runId");
  const result = runId ? getRun(runId) : latestRun();
  if (!result) {
    return NextResponse.json({ error: "Run not found. Run a backtest first." }, { status: 404 });
  }

  let csv: string;
  switch (params.kind) {
    case "trades":
      csv = tradesCsv(result.trades);
      break;
    case "equity":
      csv = equityCsv(result);
      break;
    case "monthly":
      csv = monthlyCsv(result);
      break;
    case "execution_log":
      csv = executionLogCsv(result);
      break;
    default:
      return NextResponse.json({ error: "Unknown export kind" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.runId}_${params.kind}.csv"`,
    },
  });
}
