import { env } from "cloudflare:workers";
import { runFlightMonitorBatch } from "@/lib/flight-monitor";

export async function POST(request: Request) {
  const expected = String(env.FLIGHT_MONITOR_SECRET || "");
  const supplied = request.headers.get("authorization") || "";
  if (!expected || supplied !== `Bearer ${expected}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runFlightMonitorBatch();
    console.info("flight_monitor_completed", result);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("flight_monitor_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Flight monitor failed" },
      { status: 500 },
    );
  }
}
