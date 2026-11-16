import { requireSupabaseUser } from "../../../lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const { data, error } = await supabase.from("drivers").select("*").eq("auth_user_id", user.id).maybeSingle();
    if (error) throw error;
    return Response.json({ user: { userId: user.id, email: user.email, displayName: data?.full_name || user.email?.split("@")[0] }, profile: data ? { ...data, name: data.full_name, approved: data.approved } : null });
  } catch {
    return Response.json({ error: "Logga in" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireSupabaseUser(request);
    const body = await request.json();
    const name = String(body.name || "").trim(), phone = String(body.phone || "").trim();
    if (!name || !phone) return Response.json({ error: "Namn och telefonnummer krävs" }, { status: 400 });
    const { data, error } = await supabase.rpc("driver_register_self", { p_full_name: name, p_phone: phone });
    if (error) throw error;
    return Response.json({ ok: true, profile: data });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Kontot kunde inte skapas" }, { status: 400 });
  }
}
