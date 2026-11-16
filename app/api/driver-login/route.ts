import { adminSupabase, publicSupabase } from "@/lib/supabase-server";

const timeout = <T,>(promise: PromiseLike<T>, milliseconds: number) =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), milliseconds),
    ),
  ]);

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6)
      return Response.json(
        { error: "E-postadressen eller lösenordet är fel." },
        { status: 400 },
      );

    const { data, error } = await timeout(
      publicSupabase().auth.signInWithPassword({ email, password }),
      12000,
    );
    if (error || !data.session || !data.user)
      return Response.json(
        { error: "E-postadressen eller lösenordet är fel." },
        { status: 401 },
      );

    const admin = adminSupabase();
    let driver = await admin
      .from("drivers")
      .select("id,approved,active,archived_at,auth_user_id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    if (driver.error) throw driver.error;

    if (!driver.data) {
      const byEmail = await admin
        .from("drivers")
        .select("id,approved,active,archived_at,auth_user_id")
        .eq("email", email)
        .maybeSingle();
      if (byEmail.error) throw byEmail.error;
      if (byEmail.data && !byEmail.data.auth_user_id) {
        const linked = await admin
          .from("drivers")
          .update({
            auth_user_id: data.user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", byEmail.data.id)
          .is("auth_user_id", null)
          .select("id,approved,active,archived_at,auth_user_id")
          .maybeSingle();
        if (linked.error) throw linked.error;
        driver = linked;
      } else {
        driver = byEmail;
      }
    }

    if (!driver.data || driver.data.archived_at)
      return Response.json(
        { error: "E-postadressen är inte registrerad som förare." },
        { status: 403 },
      );
    if (!driver.data.approved || driver.data.active === false)
      return Response.json(
        { error: "Förarkontot är pausat. Kontakta Dispatch." },
        { status: 403 },
      );

    return Response.json(
      { session: data.session },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    const message =
      error?.message === "timeout"
        ? "Inloggningen tog för lång tid. Försök igen."
        : "Inloggningen kunde inte genomföras.";
    return Response.json({ error: message }, { status: 504 });
  }
}
