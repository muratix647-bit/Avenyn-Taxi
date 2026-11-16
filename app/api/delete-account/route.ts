import {
  adminSupabase,
  requireSupabaseUser,
} from "../../../lib/supabase-server";

const finalStatuses = ["completed", "cancelled", "rejected", "no_show"];

export async function DELETE(request: Request) {
  try {
    const { user, token } = await requireSupabaseUser(request);
    const body = await request.json().catch(() => ({}));
    const kind = body?.kind === "driver" ? "driver" : "customer";
    const admin = adminSupabase();

    const adminAccount = await admin
      .from("dispatch_admins")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (adminAccount.error) throw adminAccount.error;
    if (adminAccount.data)
      return Response.json(
        { error: "Ett administratörskonto måste avslutas av Avenyn Taxi." },
        { status: 409 },
      );

    const driver = await admin
      .from("drivers")
      .select("id,auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (driver.error) throw driver.error;

    if (kind === "driver") {
      if (!driver.data)
        return Response.json(
          { error: "Förarkontot kunde inte hittas." },
          { status: 404 },
        );
      const activeTrips = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driver.data.id)
        .not("status", "in", `(${finalStatuses.join(",")})`);
      if (activeTrips.error) throw activeTrips.error;
      if ((activeTrips.count || 0) > 0)
        return Response.json(
          {
            error:
              "Kontot har en aktiv körning. Avsluta körningen eller kontakta dispatch först.",
          },
          { status: 409 },
        );
      const archived = await admin
        .from("drivers")
        .update({
          active: false,
          approved: false,
          is_online: false,
          availability_status: "offline",
          archived_at: new Date().toISOString(),
          auth_user_id: null,
        })
        .eq("id", driver.data.id);
      if (archived.error) throw archived.error;
    } else if (driver.data) {
      return Response.json(
        { error: "Detta är ett förarkonto. Radera kontot i Förarappen." },
        { status: 409 },
      );
    }

    const signedOut = await admin.auth.admin.signOut(token, "global");
    if (signedOut.error) throw signedOut.error;
    const deleted = await admin.auth.admin.deleteUser(user.id, true);
    if (deleted.error) throw deleted.error;
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Kontot kunde inte raderas." },
      { status: error?.message === "Logga in" ? 401 : 500 },
    );
  }
}
