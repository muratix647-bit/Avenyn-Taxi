import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

export function publicSupabase(accessToken?: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase är inte konfigurerat.");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

export function adminSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Supabase servernyckel saknas.");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function bearerToken(request: Request) {
  const value = request.headers.get("authorization")?.trim() || "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || "";
}

export async function requireSupabaseUser(request: Request) {
  const token = bearerToken(request);
  if (!token) throw new Error("Logga in");
  const verifier = publicSupabase();
  const { data, error } = await verifier.auth.getClaims(token);
  const claims = data?.claims;
  const expectedIssuer = `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
  if (
    error ||
    !claims?.sub ||
    claims.iss !== expectedIssuer ||
    claims.role !== "authenticated"
  )
    throw new Error("Logga in");
  const supabase = publicSupabase(token);
  return {
    supabase,
    user: {
      id: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : undefined,
    },
    token,
  };
}
