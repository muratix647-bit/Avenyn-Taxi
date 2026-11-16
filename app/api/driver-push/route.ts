import {
  adminSupabase,
  requireSupabaseUser,
} from "../../../lib/supabase-server";
import {
  pushPublicKey,
  sendFirebasePushToToken,
  sendPushToSubscription,
} from "../../../lib/push";

const clean = (value: unknown, maximum: number) =>
  String(value ?? "").trim().slice(0, maximum);

async function currentDriver(userId: string) {
  const result = await adminSupabase()
    .from("drivers")
    .select("id,approved,active,archived_at")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (
    !result.data ||
    !result.data.approved ||
    result.data.active === false ||
    result.data.archived_at
  )
    throw new Error("Förarkontot är inte aktiverat.");
  return result.data;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireSupabaseUser(request);
    await currentDriver(user.id);
    const publicKey = pushPublicKey();
    if (!publicKey)
      return Response.json(
        { error: "Pushnotiser är inte konfigurerade." },
        { status: 503 },
      );
    return Response.json({ publicKey });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Logga in" },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSupabaseUser(request);
    const driver = await currentDriver(user.id);
    const body = await request.json();
    const nativeToken = clean(body?.nativeToken, 4096);
    if (nativeToken) {
      const platform = clean(body?.platform, 20).toLowerCase();
      if (!['android', 'ios'].includes(platform) || nativeToken.length < 20)
        return Response.json(
          { error: "Ogiltig Firebase-registrering." },
          { status: 400 },
        );
      const admin = adminSupabase();
      const saved = await admin
        .from("driver_push_subscriptions")
        .upsert(
          {
            driver_id: driver.id,
            user_id: user.id,
            provider: "fcm",
            device_token: nativeToken,
            platform,
            endpoint: null,
            p256dh: null,
            auth: null,
            user_agent: clean(request.headers.get("user-agent"), 500),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "device_token" },
        )
        .select("id,device_token")
        .single();
      if (saved.error) throw saved.error;
      const test = await sendFirebasePushToToken(nativeToken, {
        title: "Avenyn Taxi · notiser aktiverade",
        body: "Du får nu en notis direkt när en ny bokning tilldelas dig.",
        tag: "avenyn-push-ready",
        url: "/driver",
      });
      if (!test.ok)
        return Response.json(
          { error: "Firebase är inte färdiganslutet. Försök igen senare." },
          { status: 502 },
        );
      return Response.json({ ok: true, provider: "fcm" });
    }
    const subscription = body?.subscription ?? {};
    const endpoint = clean(subscription.endpoint, 2000);
    const p256dh = clean(subscription.keys?.p256dh, 500);
    const auth = clean(subscription.keys?.auth, 500);
    if (!endpoint.startsWith("https://") || !p256dh || !auth)
      return Response.json(
        { error: "Ogiltig pushprenumeration." },
        { status: 400 },
      );

    const admin = adminSupabase();
    const saved = await admin
      .from("driver_push_subscriptions")
      .upsert(
        {
          driver_id: driver.id,
          user_id: user.id,
          provider: "webpush",
          device_token: null,
          platform: "web",
          endpoint,
          p256dh,
          auth,
          user_agent: clean(request.headers.get("user-agent"), 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      )
      .select("id,endpoint,p256dh,auth")
      .single();
    if (saved.error) throw saved.error;

    const test = await sendPushToSubscription(saved.data, {
      title: "Avenyn Taxi · notiser aktiverade",
      body: "Du får nu en notis direkt när en ny bokning tilldelas dig.",
      tag: "avenyn-push-ready",
      url: "/driver",
    });
    if (!test.ok)
      return Response.json(
        { error: "Notisen kunde inte skickas. Försök igen." },
        { status: 502 },
      );
    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Pushnotiser kunde inte aktiveras." },
      { status: 400 },
    );
  }
}
