"use client";
import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase-browser";

export function useSupabaseSession(scope = "shared") {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, subscription: { unsubscribe: () => void } | undefined;
    browserSupabase(scope).then(async (supabase) => {
      if (!active) return;
      setClient(supabase);
      subscription = supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); }).data.subscription;
      const timedOut = Symbol("session-timeout");
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<typeof timedOut>((resolve) => window.setTimeout(() => resolve(timedOut), 7000)),
      ]);
      if (!active) return;
      if (result === timedOut) {
        setError("Inloggningen tog för lång tid. Tryck på Försök igen.");
        setLoading(false);
        return;
      }
      setSession(result.data.session);
      setLoading(false);
    }).catch((reason) => { if (active) { setError(reason.message); setLoading(false); } });
    return () => { active = false; subscription?.unsubscribe(); };
  }, [scope]);
  return { client, session, loading, error, setError };
}
