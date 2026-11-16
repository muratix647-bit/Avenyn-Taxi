"use client";
import { useEffect, useState } from "react";
export default function AppDownloadBanner(){
  const [native,setNative]=useState(false);
  useEffect(()=>{setNative(Boolean((window as any).Capacitor?.isNativePlatform?.())||new URLSearchParams(location.search).has("native"))},[]);
  const install=()=>window.dispatchEvent(new Event("avenyn-install-customer"));
  if(native)return null;
  return <section className="appDownloadBanner" aria-label="Ladda ner Avenyn Taxi-appen">
    <div className="appDownloadBrand"><img src="/avenyn-logo-optimized.webp" width="76" height="76" alt="Avenyn Taxi"/><span><small>AVENYN TAXI-APPEN</small><b>Boka och följ din resa i mobilen</b><em>Installera direkt – kostnadsfritt</em></span></div>
    <div className="appStoreButtons">
      <button type="button" onClick={install} aria-label="Installera Avenyn Taxi för iPhone">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.05 12.54c-.03-3.05 2.49-4.53 2.6-4.6-1.43-2.08-3.64-2.36-4.42-2.38-1.86-.2-3.67 1.12-4.62 1.12-.97 0-2.44-1.1-4.02-1.07-2.03.03-3.93 1.21-4.97 3.04-2.14 3.7-.54 9.14 1.51 12.13 1.03 1.47 2.23 3.11 3.81 3.05 1.55-.06 2.13-.98 4-.98 1.85 0 2.39.98 4.01.94 1.66-.03 2.71-1.47 3.7-2.96 1.19-1.69 1.67-3.35 1.69-3.44-.04-.01-3.26-1.24-3.29-4.85ZM14.02 3.58A4.45 4.45 0 0 0 15.04.38a4.52 4.52 0 0 0-2.93 1.52 4.24 4.24 0 0 0-1.05 3.08 3.74 3.74 0 0 0 2.96-1.4Z"/></svg>
        <span><small>Installera för</small><b>iPhone</b></span>
      </button>
      <button type="button" onClick={install} aria-label="Installera Avenyn Taxi för Android">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m17.6 9.48 1.84-3.18a.38.38 0 0 0-.65-.38l-1.87 3.23A11.5 11.5 0 0 0 12 8.05c-1.77 0-3.44.4-4.92 1.1L5.21 5.92a.38.38 0 0 0-.65.38L6.4 9.48C3.3 11.17 1.2 14.2 1 17.72h22c-.2-3.52-2.3-6.55-5.4-8.24ZM7 14.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>
        <span><small>Installera för</small><b>Android</b></span>
      </button>
    </div>
    <a className="driverAppShortcut" href="/driver?install=1">Förare? Installera förarappen →</a>
  </section>
}
