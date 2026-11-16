import { requireSupabaseUser } from "@/lib/supabase-server";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const { supabase } = await requireSupabaseUser(request);
    const { data: allowed, error: roleError } = await supabase.rpc("is_dispatch_admin");
    if (roleError || !allowed)
      return Response.json({ error: "Endast dispatch" }, { status: 403, headers });
    const { data, error } = await supabase.from("driver_locations")
      .select("driver_id,latitude,longitude,heading,updated_at");
    if (error) return Response.json({ error: "Positionerna kunde inte hämtas." }, { status: 503, headers });
    return Response.json({ locations: data || [] }, { headers });
  } catch {
    return Response.json({ error: "Logga in" }, { status: 401, headers });
  }
}
