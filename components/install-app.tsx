"use client";
import {useEffect,useState} from "react";
import {CheckCircle2,Download,ShieldCheck,Share2,X} from "lucide-react";

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

export default function InstallApp({kind,hideTrigger=false}:{kind:"customer"|"driver";hideTrigger?:boolean}){
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
  const [show,setShow]=useState(false);
  const [ios,setIos]=useState(false);
  const [browser,setBrowser]=useState("webbläsaren");
  const [installed,setInstalled]=useState(false);
  const customer=kind==="customer";
  useEffect(()=>{
    const native=Boolean((window as any).Capacitor?.isNativePlatform?.())||new URLSearchParams(location.search).has("native");
    if(native){setInstalled(true);return}
    let controllerChanged=false;
    const refreshOnUpdate=()=>{
      if(controllerChanged)return;
      controllerChanged=true;
      location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange",refreshOnUpdate);
    navigator.serviceWorker?.register("/sw.js",{updateViaCache:"none"}).then((registration)=>registration.update()).catch(()=>{});
    const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as any).standalone===true;
    setInstalled(standalone);
    const ua=navigator.userAgent;
    setIos(/iphone|ipad|ipod/i.test(ua));
    setBrowser(/firefox|fxios/i.test(ua)?"Firefox":/samsungbrowser/i.test(ua)?"Samsung Internet":/edg/i.test(ua)?"Edge":/chrome|crios/i.test(ua)?"Chrome":/safari/i.test(ua)?"Safari":"webbläsaren");
    setShow(new URLSearchParams(location.search).get("install")==="1");
    const handler=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)};
    window.addEventListener("beforeinstallprompt",handler);
    const externalInstall=()=>{const saved=(window as any).__avenynInstallPrompt as InstallPrompt|undefined;if(saved){setPrompt(saved);saved.prompt().then(async()=>{const choice=await saved.userChoice;if(choice.outcome==="accepted")setInstalled(true);(window as any).__avenynInstallPrompt=null})}else setShow(true)};
    window.addEventListener("avenyn-install-customer",externalInstall);
    return()=>{window.removeEventListener("beforeinstallprompt",handler);window.removeEventListener("avenyn-install-customer",externalInstall);navigator.serviceWorker?.removeEventListener("controllerchange",refreshOnUpdate)};
  },[]);
  useEffect(()=>{if(prompt)(window as any).__avenynInstallPrompt=prompt},[prompt]);
  async function install(){
    if(prompt){await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==="accepted"){setInstalled(true);setShow(false)}setPrompt(null);return}
    setShow(true);
  }
  if(installed)return null;
  return <div className="appInstall">
    {!hideTrigger&&<button className="appInstallTrigger" type="button" onClick={install}><Download/>{customer?"Installera kundappen":"Installera förarappen"}</button>}
    {show&&<section className="appInstallPanel" role="dialog" aria-modal="true" aria-label="Installera appen">
      <button className="appInstallClose" type="button" onClick={()=>setShow(false)} aria-label="Stäng"><X/></button>
      <img src="/icon-192.png" width="72" height="72" alt="Avenyn Taxi"/>
      <h2>{customer?"Avenyn Taxi Kundapp":"Avenyn Taxi Förarapp"}</h2>
      {!customer&&<div className="driverInstallSafety" role="note">
        <ShieldCheck/>
        <span><b>Säker installation för alla förare</b><small>Installera alltid härifrån. Använd inte gamla APK-filer från SMS, WhatsApp eller andra länkar.</small></span>
      </div>}
      {ios?<><p>Installera från {browser} på iPhone eller iPad:</p><ol><li>Tryck på <b>Dela</b> <Share2/></li><li>Välj <b>Lägg till på hemskärmen</b></li><li>Tryck <b>Lägg till</b></li></ol></>:<><p>{browser==="Firefox"?"Öppna Firefox-menyn och välj Installera eller Lägg till på hemskärmen.":"Öppna menyn i "+browser+" och välj Installera app eller Lägg till på hemskärmen."}</p>{prompt&&<button type="button" className="appInstallPrimary" onClick={install}>Installera nu</button>}</>}
      {!customer&&<p className="driverInstallCurrent"><CheckCircle2/>Samma aktuella version används av samtliga förare och uppdateras automatiskt.</p>}
    </section>}
  </div>
}
