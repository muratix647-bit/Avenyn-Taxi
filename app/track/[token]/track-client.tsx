"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock3,
  House,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
} from "lucide-react";
import CustomerFlightEditor from "@/components/customer-flight-editor";
import CustomerTripFooter from "@/components/customer-trip-footer";
import CustomerTripMap from "@/components/customer-trip-map";
import { LandvetterTripAssistant } from "@/components/landvetter-assistant";
import AppChat from "@/components/app-chat";
import TripVoiceCall from "@/components/trip-voice-call";
import DriverFlightCard from "@/components/driver-flight-card";
const journeySteps = ["Bokad", "Förare", "På väg", "Framme", "Resa", "Klart"];
const journeyStage: Record<string, number> = { new: 0, scheduled: 0, offered: 0, assigned: 1, accepted: 1, en_route: 2, arrived: 3, passenger_onboard: 4, completed: 5 };
const names: Record<string, string> = {
  new: "Bokning mottagen",
  scheduled: "Bokning mottagen",
  offered: "Förare kontaktas",
  assigned: "Förare tilldelad",
  accepted: "Körning accepterad",
  en_route: "Föraren är på väg",
  arrived: "Föraren är framme",
  passenger_onboard: "Resan pågår",
  completed: "Resan är klar",
  cancelled: "Resan är avbokad",
};
export default function TrackClient({ token,embedded=false }: { token: string;embedded?:boolean }) {
  const [cancelOpen,setCancelOpen]=useState(false),[cancelling,setCancelling]=useState(false),[cancelMessage,setCancelMessage]=useState("");
  const [paymentBusy,setPaymentBusy]=useState(false),[paymentError,setPaymentError]=useState("");
  const [trip, setTrip] = useState<any>(null),
    [error, setError] = useState("");
  const [quotedOre,setQuotedOre] = useState<number>();
  useEffect(()=>{
    const query = new URLSearchParams(window.location.search);
    if(query.has('belopp')) setQuotedOre(Number(query.get('belopp')));
  },[]);
  useEffect(()=>{
    if(trip?.booking_id && window.location.hash==='#betala') document.getElementById('betala')?.scrollIntoView({block:'center'});
  },[trip?.booking_id]);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [journeyRoute,setJourneyRoute]=useState<any>(null);
  const [routeRetry,setRouteRetry]=useState(0);
  useEffect(()=>{if(!trip)return;const c=new AbortController();setJourneyRoute(null);fetch(`/api/track/${token}/route-preview`,{signal:c.signal,cache:'no-store'}).then(r=>r.ok?r.json():{state:'unavailable'}).then(j=>{if(!c.signal.aborted)setJourneyRoute(j)}).catch(()=>{if(!c.signal.aborted)setJourneyRoute({state:'unavailable'})});return()=>c.abort();},[token,trip?.pickup_lat,trip?.pickup_lng,trip?.destination_lat,trip?.destination_lng,trip?.route_stop?.lat,trip?.route_stop?.lng,routeRetry]);
  const [eta,setEta]=useState<any>(null);
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("live")==="1")setView("map");},[]);
  const [view,setView]=useState<"trip"|"map"|"flight"|"contact">("trip");
  const [editing,setEditing]=useState(false),[newDate,setNewDate]=useState(""),[newTime,setNewTime]=useState(""),[previousTime,setPreviousTime]=useState(""),[saving,setSaving]=useState(false),[timeMessage,setTimeMessage]=useState("");
  const saveTime=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setTimeMessage("");try{const r=await fetch(`/api/track/${token}/time`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:newDate,time:newTime,previous:previousTime})});const j:any=await r.json();if(!r.ok)throw new Error(j.error);if(j.pickup_time)setTrip((t:any)=>({...t,pickup_time:j.pickup_time}));setTimeMessage(j.message?.includes("kunde inte")?"Tiden sparad. SMS kunde inte skickas till alla.":"Tiden sparad.");setEditing(false);}catch(e){setTimeMessage(e instanceof Error?e.message:"Kunde inte ändra tiden.");}finally{setSaving(false);}};
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await fetch("/api/track/" + token, {
            cache: "no-store",
            signal: controller.signal,
          }),
          j: any = await r.json();
        if (!r.ok) {
          if (r.status >= 500 || r.status === 429) throw new Error("temporary_unavailable");
          setError(j.error || "Bokningen kunde inte hämtas.");
          return;
        }
        setError("");
        setConnectionNotice("");
        setTrip(j);
        if (!["completed", "cancelled"].includes(j.status))
          timer = setTimeout(load, document.hidden ? 15000 : ["en_route", "arrived", "passenger_onboard"].includes(j.status) ? 500 : 1000);
      } catch (e) {
        if (!controller.signal.aborted) { setConnectionNotice("Anslutningen avbröts. Vi försöker igen automatiskt. Ring 0700-31 53 15 om du behöver hjälp direkt."); timer = setTimeout(load, document.hidden ? 15000 : 5000); }
      }
    };
    load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [token]);
  useEffect(()=>{
    if(!trip || !['assigned','accepted','en_route','arrived'].includes(trip.status)){setEta(null);return;}
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const loadEta=async()=>{try{const response=await fetch(`/api/track/${token}/eta`,{cache:'no-store',signal:controller.signal});if(response.ok)setEta(await response.json());else setEta(null);}catch{if(!controller.signal.aborted)setEta(null);}finally{if(!controller.signal.aborted)timer=setTimeout(loadEta,15000);}};
    void loadEta();return()=>{controller.abort();if(timer)clearTimeout(timer);};
  },[token,trip?.status]);
  if (error)
    return (
      <main className="trackShell">
        <div className="trackCard">
          <h1>{error}</h1>
          <Link href="/">Till startsidan</Link>
        </div>
      </main>
    );
  if (!trip)
    return (
      <main className="trackShell">
        <div className="trackCard">
          <p role="status">{connectionNotice || "Hämtar bokningen…"}</p>
        </div>
      </main>
    );
  const accepted = ["accepted","en_route","arrived","passenger_onboard","completed"].includes(trip.status);
  const freshLocation = trip.location_updated && Date.now()-Date.parse(trip.location_updated)<120000;
  const terminal = ["completed", "cancelled"].includes(trip.status);
  const approaching=['assigned','accepted','en_route'].includes(trip.status);
  const freshEstimate=approaching&&freshLocation&&eta?.state==='estimate'&&Date.now()-Date.parse(eta.calculatedAt)<45000;
  const distanceText=freshEstimate&&Number.isFinite(eta.kilometers)?`${eta.kilometers.toLocaleString('sv-SE',{maximumFractionDigits:1,minimumFractionDigits:1})} km`:'';
  const arrivalTitle=trip.status==='arrived'?'Din taxi är framme':freshEstimate?`Ca ${eta.minutes} min · ${distanceText}`:approaching?'Väntar på aktuell tid och avstånd':trip.status==='passenger_onboard'?'Resan pågår':'Inväntar förare';
  const arrivalDetail=freshEstimate?(trip.status==='en_route'?`Till hämtplatsen · cirka kl ${new Date(eta.arrivalAt).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'})}`:'Bilens körväg till dig · föraren har inte startat hämtningen'):trip.status==='arrived'?'Bilen väntar vid hämtplatsen':approaching?'Visas när GPS och vägberäkning är tillgängliga.':'Följ resan på kartan';

  const hasLocation =
    trip.driver_lat !== null &&
    trip.driver_lat !== undefined &&
    trip.driver_lng !== null &&
    trip.driver_lng !== undefined &&
    Number.isFinite(Number(trip.driver_lat)) &&
    Number.isFinite(Number(trip.driver_lng));
  const car = hasLocation && !terminal
    ? [
        {
          lat: Number(trip.driver_lat),
          lng: Number(trip.driver_lng),
          name: trip.driver_name,
          updatedAt: trip.location_updated,
        },
      ]
    : [];
  const vehicle = [
    trip.vehicle_model,
    trip.registration_number,
    trip.vehicle_number && `Bil ${trip.vehicle_number}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <main className="trackShell customerTripCompact">
      {!embedded&&<header>
        <Link href="/">
          <img
            src="/avenyn-logo-optimized.webp"
            width="52"
            height="52"
            alt="Avenyn Taxi"
          />
          Avenyn Taxi
        </Link>
        <nav className="trackHeaderActions">
          <a href="https://www.avenyntaxi.se/"><House /> Huvudmeny</a>
          <Link href="/customer">Mina resor</Link>

        </nav>
      </header>}
      {!terminal && trip.status==="scheduled" && <section className="customerPrebookingBanner"><Clock3/><div><strong>Din förbokning</strong><span>{String(trip.pickup_time).slice(0,10).split("-").reverse().join("/")} kl {String(trip.pickup_time).slice(11,16)}</span><small>{trip.pickup}</small></div></section>}



      {trip.status==="completed" && <a className="changeTripTime" style={{display:"block",textAlign:"center",margin:"16px auto"}} href={`/k/${token}`}>Visa kvitto / reseunderlag</a>}
      {connectionNotice && <p className="bookingJourneyNotice" role="status">{connectionNotice}</p>}
      {trip.status !== "cancelled" && <ol className="journeyProgress" aria-label="Resans status">{journeySteps.map((label, index) => <li key={label} className={index <= (journeyStage[trip.status] ?? 0) ? "reached" : ""} aria-current={index === journeyStage[trip.status] ? "step" : undefined}><span aria-hidden="true">{index < (journeyStage[trip.status] ?? 0) ? "✓" : index + 1}</span>{label}</li>)}</ol>}
      <nav className="customerTripTabs" aria-label="Resemeny">
        {([{id:'trip',label:'Resa',Icon:ShieldCheck},{id:'map',label:'Karta',Icon:MapPin},{id:'flight',label:'Flyg',Icon:Navigation},{id:'contact',label:'Kontakt',Icon:Phone}] as const).map(({id,label,Icon})=><button key={id} type="button" aria-pressed={view===id} aria-controls={`trip-panel-${id}`} className={view===id?'selected':''} onClick={()=>setView(id)}><Icon/>{label}</button>)}
      </nav>
      {!terminal && view!=='map' && <section className="customerArrival" aria-live="polite"><Clock3/><div><strong>{arrivalTitle}</strong><small>{arrivalDetail}{freshEstimate?' · Beräknat utan live-trafik.':''}</small></div></section>}
      <section className="trackGrid compactTripGrid">
        <div className="trackCard tripPanel" id="trip-panel-trip" hidden={view!=="trip"}>
          <small>MIN RESA · BOKNING #{trip.id}</small>
          <h1>{names[trip.status] || trip.status}</h1>
          <p className="trackTime">
            <Clock3 />
            {String(trip.pickup_time).slice(0,10).split("-").reverse().join("/")} kl {String(trip.pickup_time).slice(11,16)}
          </p>
          {!trip.time_changes_closed && ["new","scheduled","offered","assigned","accepted"].includes(trip.status) && <button type="button" className="changeTripTime" onClick={()=>{setNewDate(String(trip.pickup_time).slice(0,10));setNewTime(String(trip.pickup_time).slice(11,16));setPreviousTime(String(trip.pickup_time).slice(0,16));setEditing(!editing);setTimeMessage("");}}>Ändra datum och tid</button>}
          {editing && !trip.time_changes_closed && <form className="tripTimeEditor" onSubmit={saveTime}><label>Datum<input type="date" required value={newDate} onChange={e=>setNewDate(e.target.value)}/></label><label>Tid<input type="time" required value={newTime} onChange={e=>setNewTime(e.target.value)}/></label><button disabled={saving} type="submit">{saving?"Sparar…":"Spara"}</button><button type="button" disabled={saving} onClick={()=>setEditing(false)}>Avbryt</button></form>}
          {timeMessage && <p role="status" className="tripTimeMessage">{timeMessage}</p>}

          {!terminal&&trip.status!=="passenger_onboard"&&<section className="customerCancelTrip">
            <button type="button" onClick={()=>{setCancelOpen(!cancelOpen);setCancelMessage("");}}>Avboka resan</button>
            {cancelOpen&&<div role="group" aria-label="Bekräfta avbokning"><p>Vill du avboka den här resan?</p>
              <p>{trip.cancellation_fee_applies?`Enligt bokningsvillkoren debiteras hela resans pris, ${trip.price} kr, vid avbokning inom 24 timmar.`:"Kontrollera resan innan du bekräftar."}</p>
              {['paid','refunded'].includes(trip.payment_status)?<p>För betalda resor hjälper trafikledningen dig med avbokning och eventuell återbetalning. <a href="tel:+46700315315">Ring 0700-315 315</a></p>:<button type="button" disabled={cancelling} onClick={async()=>{setCancelling(true);setCancelMessage("");try{const r=await fetch(`/api/track/${token}/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true,acceptFee:!!trip.cancellation_fee_applies})});const j=await r.json();if(!r.ok)throw Error(j.error||'Avbokningen misslyckades.');setTrip((t:any)=>({...t,status:'cancelled'}));setCancelOpen(false);setCancelMessage('Resan är avbokad.');}catch(e){setCancelMessage(e instanceof Error?e.message:'Försök igen.');}finally{setCancelling(false);}}}>{cancelling?'Avbokar…':trip.cancellation_fee_applies?'Bekräfta avbokning och avgift':'Ja, avboka resan'}</button>}
              <button type="button" disabled={cancelling} onClick={()=>setCancelOpen(false)}>Behåll resan</button>
            </div>}
          </section>}
          {cancelMessage&&<p role="status">{cancelMessage}</p>}
          <div className="trackRoute">
            <div>
              <i />
              <span>Hämtning</span>
              <b>{trip.pickup}</b>
            </div>
            <div>
              <i />
              <span>Destination</span>
              <b>{trip.destination}</b>
            </div>
          </div>
          {!terminal&&!trip.flight_number&&/landvetter|airport|flygplats/i.test(`${trip.pickup} ${trip.destination}`)&&<button type="button" className="compactFlightPrompt" onClick={()=>setView('flight')}>Vill du lägga till flygnummer? <span>Valfritt →</span></button>}
          <div className="tripPreferences">
            {trip.passengers && <span>{trip.passengers} passagerare</span>}
            {trip.luggage_count>0 && <span>{trip.luggage_count} väskor</span>}
            {trip.child_seats>0 && <span>{trip.child_seats} barnstol beställd</span>}
            {/large|storbil/i.test(trip.car_type||'') && <span>Storbil beställd</span>}
          </div>
          {trip.driver_name && (
            <div className="driverAssigned">
              <div>{trip.driver_name[0]}</div>
              <span>
                <small>DIN FÖRARE</small>
                <b>{trip.driver_name}</b>
                {vehicle && <small>{vehicle}</small>}
              </span>
            </div>
          )}
          {trip.booking_id&&trip.status!=="cancelled"&&!['paid','refunded'].includes(trip.payment_status)&&(quotedOre!==undefined ? quotedOre>=300 : Number(trip.price)>0)&&<div id="betala" className="savedBookingPayment"><button disabled={paymentBusy} onClick={async()=>{setPaymentBusy(true);setPaymentError("");try{const r=await fetch('/api/payments/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:trip.booking_id,trackingToken:token,source:'customer',quotedOre})});const j:any=await r.json();if(!r.ok||!j.url)throw Error(j.error||'Betalningen kunde inte öppnas.');window.location.assign(j.url);}catch(e){setPaymentError(e instanceof Error?e.message:'Försök igen.');setPaymentBusy(false);}}}>{paymentBusy?'Öppnar betalning…':`Betala ${quotedOre===undefined ? trip.price : quotedOre/100} kr säkert`}</button>{paymentError&&<p role="alert">{paymentError}</p>}</div>}
          {trip.payment_status==='paid'&&<p className="paidBookingNotice">✓ Resan är betald</p>}
          <div className="trackPrice">
            <span>Resans pris</span>
            <b>{trip.price} kr</b>
          </div>
        </div>
        <div className="trackMap tripPanel" id="trip-panel-map" hidden={view!=="map"}>
          {!terminal && (car.length || (trip.pickup_lat!=null && trip.pickup_lng!=null)) ? (
            <>
              <div className="customerFollowMap">
                <div className="customerLiveEstimate" role="status">{approaching&&<span>Din taxi → Hämtplats A</span>}<strong>{arrivalTitle}</strong><span>{arrivalDetail}</span>{freshEstimate&&<small>Ungefärlig körtid · utan live-trafik</small>}</div>
                <CustomerTripMap followDriver routePath={approaching?(freshEstimate?eta.path:[]):journeyRoute?.path} cars={car} customerLocation={trip.pickup_lat!=null && trip.pickup_lng!=null?{lat:Number(trip.pickup_lat),lng:Number(trip.pickup_lng)}:undefined} destinationLocation={!approaching&&trip.destination_lat!=null && trip.destination_lng!=null?{lat:Number(trip.destination_lat),lng:Number(trip.destination_lng)}:undefined} />
              </div>
              {!approaching&&journeyRoute?.state==='ready'&&<p className="customerJourneyDuration">Hämtplats → destination · ca {journeyRoute.minutes} min · {journeyRoute.kilometers.toLocaleString('sv-SE',{maximumFractionDigits:1})} km</p>}

              <p>
                <Navigation />
                {terminal
                  ? "Live-spårningen är avslutad."
                  : freshLocation ? "Förarens senaste position · uppdateras automatiskt." : "Positionen är äldre än två minuter. Ring oss om du behöver hjälp."}
              </p>
            </>
          ) : (
            <div className="waitingMap">
              <MapPin />
              <h2>{terminal ? names[trip.status] : trip.driver_name ? "Din förare är tilldelad" : "Vi söker en ledig bil"}</h2>
              <p>
                {terminal
                  ? "Live-spårningen är avslutad."
                  : ["new","offered","scheduled"].includes(trip.status) ? "Du ser bilen här när en förare har bekräftat resan. Ring oss om du behöver hjälp direkt." : "Väntar på förarens GPS-position."}
              </p>
            </div>
          )}
        </div>
        <div className="trackCard tripPanel" id="trip-panel-flight" hidden={view!=="flight"}><h2>Flyginformation</h2>      <CustomerFlightEditor token={token} trip={trip} onSaved={flight=>setTrip((t:any)=>({...t,flight_number:flight}))} />
      <LandvetterTripAssistant pickup={trip.pickup} destination={trip.destination} status={trip.status} driverName={trip.driver_name} flight={trip.flight_number} onView={setView} />
          <DriverFlightCard
            flightNumber={trip.flight_number}
            pickupTime={trip.pickup_time}
            pickupAddress={trip.pickup}
            destinationAddress={trip.destination}
            trackingToken={token}
          />
          {!trip.flight_number && <p>Du kan lägga till flygnumret här, även senare.</p>}
        </div>
      </section>
      {<section className="tripPickupHelp tripPanel" id="trip-panel-contact" hidden={view!=="contact"}><h2>Kontakt och hämtning</h2>      {!terminal && <TripVoiceCall trackingToken={token} role="customer" />}{trip.driver_phone && <div className="customerDriverContact"><strong>Din förare · {trip.driver_name}</strong><a href={`tel:${String(trip.driver_phone).replace(/[^+0-9]/g,"")}`}><Phone/> Ring föraren · {trip.driver_phone}</a></div>}<p className="privateTripHint">Din privata reselänk fungerar utan inloggning. Spara länken och dela den bara med personer du litar på.</p><p>{/landvetter|GOT airport/i.test(trip.pickup)?'När du har hämtat bagaget, kontakta Avenyn Taxi för att bekräfta mötesplatsen. Följ förarens instruktioner.':'Var redo vid hämtadressen vid bokad tid. Behöver du hjälp att hitta bilen eller meddela en ändring? Kontakta oss.'}</p><a href="https://wa.me/46700315315">WhatsApp</a></section>}
      {['accepted','en_route','arrived','passenger_onboard','completed','cancelled'].includes(trip.status)&&<div style={{padding:'8px 12px',textAlign:'center'}}><AppChat key={token} role="customer" trackingToken={token} label="Skriv till föraren"/></div>}
      <CustomerTripFooter/>
    </main>
  );
}
