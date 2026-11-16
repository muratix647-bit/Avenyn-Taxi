import { env } from "cloudflare:workers";
import { sendAdminSmsTest } from "@/lib/sms";

export async function POST(request: Request) {
  const expected = String(env.FLIGHT_MONITOR_SECRET || "");
  const supplied = request.headers.get("authorization") || "";
  if (!expected || supplied !== `Bearer ${expected}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendAdminSmsTest();
  return Response.json(
    {
      ok: result.accepted,
      status: result.status || null,
      reason: result.reason || null,
    },
    { status: result.accepted ? 200 : 502 },
  );
}
