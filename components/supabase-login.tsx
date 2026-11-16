"use client";

import {AppText} from "@/components/app-language";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";

export default function SupabaseLogin({ client, title, error, setError, loginKind = "admin" }: { client: SupabaseClient; title: string; error?: string; setError: (value: string) => void; loginKind?: "admin" | "driver" }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const login = async () => {
    setBusy(true); setError(""); setNotice("");
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(loginKind === "driver" ? "/api/driver-login" : "/api/admin-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:email.trim(),password}),signal:controller.signal});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.session)throw new Error(result?.error||"Inloggningen kunde inte genomföras.");
      const { error: sessionError } = await client.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (sessionError) throw sessionError;
      window.location.reload();
    }catch(reason:any){
      setError(reason?.name==="AbortError"?"Inloggningen tog för lång tid. Kontrollera internet och försök igen.":reason?.message||"Inloggningen kunde inte genomföras.");
      setBusy(false);
    }finally{window.clearTimeout(timer);}
  };
  const reset = async () => {
    if (!email.trim()) return setError("Skriv din e-postadress först.");
    const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/driver` });
    if (resetError) setError(resetError.message); else setNotice("En återställningslänk har skickats till din e-post.");
  };
  return <main className="portal"><section className="portalcard authCard"><img src="/avenyn-logo-optimized.webp" width="96" height="96" alt="Avenyn Taxi"/><small><AppText text={"SÄKER INLOGGNING"} /></small><h1>{<AppText text={title} />}</h1><label><span><Mail/><AppText text={"E-post"} /></span><input type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)}/></label><label><span><LockKeyhole/><AppText text={"Lösenord"} /></span><input type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} onKeyDown={(event)=>event.key==="Enter"&&login()}/></label>{error&&<div className="notice">{<AppText text={error} />}</div>}{notice&&<div className="priceNotice">{<AppText text={notice} />}</div>}<button className="primary" disabled={busy} onClick={login}>{<AppText text={busy?"Loggar in…":"Logga in"} />}</button><button className="textButton" onClick={reset}><AppText text={"Glömt lösenord?"} /></button><Link href="/"><AppText text={"Till huvudmenyn"} /></Link></section></main>;
}
