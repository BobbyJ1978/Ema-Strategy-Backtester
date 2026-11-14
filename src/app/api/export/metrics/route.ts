import { NextRequest, NextResponse } from "next/server";
import { getRun, latestRun } from "@/lib/backtester/storage/run_store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  const result = runId ? getRun(runId) : latestRun();
  if (!result) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const payload = {
    metrics: result.metrics,
    monthly: result.monthly,
    longSummary: result.longSummary,
    shortSummary: result.shortSummary,
    dataQuality: result.dataQuality,
    metadata: result.metadata,
    config: result.config,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.runId}_metrics.json"`,
    },
  });
}
