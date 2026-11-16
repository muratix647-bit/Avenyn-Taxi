import { env } from "cloudflare:workers";

export async function GET() {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return Response.json({ error: "Supabase är inte konfigurerat." }, { status: 503 });
  }
  return Response.json(
    { url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
