import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

const clients = new Map<string, SupabaseClient>();

export async function browserSupabase(scope = "shared") {
  const existing = clients.get(scope);
  if (existing) return existing;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch("/api/supabase-config", {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new Error("Inloggningen svarar inte. Kontrollera internetanslutningen och försök igen.");
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) throw new Error("Inloggningen är inte tillgänglig.");
  const { url, publishableKey } = await response.json();
  const projectRef = new URL(url).hostname.split(".")[0];
  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(scope === "shared"
        ? {}
        : { storageKey: `avenyn-${projectRef}-${scope}-auth-token` }),
    },
  });
  clients.set(scope, client);
  return client;
}

export async function authHeaders(session?: Session | null) {
  const activeSession = session === undefined
    ? (await (await browserSupabase()).auth.getSession()).data.session
    : session;
  const token = activeSession?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
