import { adminSupabase, requireSupabaseUser } from "@/lib/supabase-server";

export const runtime = "edge";

const noStore = { "cache-control": "no-store" };

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function approvedDriverId(userId: string) {
  const { data, error } = await adminSupabase()
    .from("drivers")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .eq("approved", true)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Förarkontot är inte godkänt.");
  return String(data.id);
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSupabaseUser(request);
    const driverId = await approvedDriverId(user.id);
    const token = randomToken();
    const { error } = await adminSupabase()
      .from("driver_tracking_tokens")
      .upsert(
        {
          driver_id: driverId,
          token_hash: await sha256(token),
          rotated_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "driver_id" },
      );
    if (error) throw error;
    return Response.json(
      {
        token,
        endpoint: new URL("/api/native-location", request.url).toString(),
      },
      { headers: noStore },
    );
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Bakgrunds-GPS kunde inte aktiveras." },
      { status: 401, headers: noStore },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireSupabaseUser(request);
    const driverId = await approvedDriverId(user.id);
    const { error } = await adminSupabase()
      .from("driver_tracking_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("driver_id", driverId);
    if (error) throw error;
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Bakgrunds-GPS kunde inte stängas av." },
      { status: 401, headers: noStore },
    );
  }
}
