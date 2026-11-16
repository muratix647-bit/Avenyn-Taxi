import { adminSupabase, bearerToken } from "@/lib/supabase-server";

export const runtime = "edge";

const noStore = { "cache-control": "no-store" };

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token || token.length < 32) throw new Error("Ogiltig enhet.");

    const admin = adminSupabase();
    const { data: tracking, error: tokenError } = await admin
      .from("driver_tracking_tokens")
      .select("driver_id")
      .eq("token_hash", await sha256(token))
      .is("revoked_at", null)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tracking?.driver_id) throw new Error("Ogiltig enhet.");

    const { data: driver, error: driverError } = await admin
      .from("drivers")
      .select("id,active,approved,archived_at,availability_status")
      .eq("id", tracking.driver_id)
      .maybeSingle();
    if (driverError) throw driverError;
    if (!driver?.active || !driver.approved || driver.archived_at)
      throw new Error("Förarkontot är inte aktivt.");

    const body = await request.json().catch(() => ({}));
    const latitude = finiteNumber(body.latitude ?? body.lat);
    const longitude = finiteNumber(body.longitude ?? body.lng);
    const heading = finiteNumber(body.bearing ?? body.heading) ?? 0;
    const nativeSpeed = finiteNumber(body.speed);
    const speedKmh =
      finiteNumber(body.speedKmh) ?? (nativeSpeed === null ? 0 : nativeSpeed * 3.6);

    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    )
      return Response.json(
        { error: "Ogiltig GPS-position." },
        { status: 400, headers: noStore },
      );

    const now = new Date().toISOString();
    const { error: locationError } = await admin.from("driver_locations").upsert(
      {
        driver_id: driver.id,
        latitude,
        longitude,
        heading,
        speed_kmh: Math.max(0, speedKmh),
        updated_at: now,
      },
      { onConflict: "driver_id" },
    );
    if (locationError) throw locationError;

    const { error: onlineError } = await admin
      .from("drivers")
      .update({
        is_online: true,
        availability_status:
          driver.availability_status === "offline"
            ? "available"
            : driver.availability_status,
        updated_at: now,
      })
      .eq("id", driver.id);
    if (onlineError) throw onlineError;

    return Response.json({ ok: true }, { headers: noStore });
  } catch (error: any) {
    const unauthorized = /Ogiltig enhet|Förarkontot/.test(error?.message || "");
    return Response.json(
      { error: unauthorized ? error.message : "GPS-positionen kunde inte sparas." },
      { status: unauthorized ? 401 : 500, headers: noStore },
    );
  }
}

// Read-only probe: the app can recover a revoked/replaced device token without
// sending invented GPS coordinates or weakening the location endpoint's auth.
export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token || token.length < 32) return Response.json({ ok: false }, { status: 401, headers: noStore });
  const { data, error } = await adminSupabase().from("driver_tracking_tokens")
    .select("driver_id").eq("token_hash", await sha256(token)).is("revoked_at", null).maybeSingle();
  if (error) return Response.json({ ok: false }, { status: 503, headers: noStore });
  return Response.json({ ok: Boolean(data) }, { status: data ? 200 : 401, headers: noStore });
}
