import { publicSupabase, requireSupabaseUser } from "../../../lib/supabase-server";

export async function GET() {
  try {
    const { data, error } = await publicSupabase().rpc("public_online_drivers");
    if (error) throw error;
    const cars = (Array.isArray(data) ? data : [])
      .map((row: any) => ({
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        heading: Number(row.heading || 0),
        updatedAt: row.updated_at || null,
      }))
      .filter(
        (row: any) =>
          Number.isFinite(row.lat) &&
          Number.isFinite(row.lng) &&
          row.lat >= 54 &&
          row.lat <= 70 &&
          row.lng >= 8 &&
          row.lng <= 25,
      )
      .sort((a: any, b: any) => a.lat - b.lat || a.lng - b.lng)
      .map((row: any, index: number) => ({
        ...row,
        id: `online-taxi-${index + 1}`,
        name: `Bil ${index + 1}`,
      }));
    return Response.json(
      { count: cars.length, cars },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { count: 0, cars: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireSupabaseUser(request);
    const body = await request.json();
    if (body.online === true && ["available", "busy", "paused"].includes(body.status) && body.lat === undefined) {
      const { error } = await supabase.rpc("driver_set_my_online", { p_online: true, p_status: body.status });
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (body.online === false) {
      const { error } = await supabase.rpc("driver_set_my_online", { p_online: false, p_status: "offline" });
      if (error) throw error;
      return Response.json({ ok: true });
    }
    const latitude = Number(body.lat), longitude = Number(body.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return Response.json({ error: "Ogiltig GPS-position" }, { status: 400 });
    const { error } = await supabase.rpc("driver_update_my_location", { p_latitude: latitude, p_longitude: longitude, p_heading: Number(body.heading) || 0, p_speed_kmh: Number(body.speedKmh) || 0 });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Logga in" }, { status: 401 });
  }
}
