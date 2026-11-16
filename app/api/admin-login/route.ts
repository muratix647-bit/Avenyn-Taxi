import { publicSupabase } from "@/lib/supabase-server";

const timeout = <T,>(promise: Promise<T>, milliseconds: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), milliseconds),
    ),
  ]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6)
      return Response.json(
        { error: "E-postadressen eller lösenordet är fel." },
        { status: 400 },
      );

    const supabase = publicSupabase();
    const { data, error } = await timeout(
      supabase.auth.signInWithPassword({ email, password }),
      12000,
    );
    if (error || !data.session)
      return Response.json(
        { error: "E-postadressen eller lösenordet är fel." },
        { status: 401 },
      );

    const authenticated = publicSupabase(data.session.access_token);
    const { data: allowed, error: roleError } = await timeout(
      authenticated.rpc("is_dispatch_admin"),
      8000,
    );
    if (roleError || !allowed)
      return Response.json(
        { error: "Kontot har inte behörighet till Admin." },
        { status: 403 },
      );

    return Response.json(
      { session: data.session },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    const message = error?.message === "timeout"
      ? "Inloggningen tog för lång tid. Försök igen."
      : "Inloggningen kunde inte genomföras.";
    return Response.json({ error: message }, { status: 504 });
  }
}
