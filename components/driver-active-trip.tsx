"use client";
import {DriverCustomerChatButton} from "@/components/app-chat";
import DriverTripTiming from '@/components/driver-trip-timing';
import {AppText} from '@/components/app-language';
import DriverFlightCard from '@/components/driver-flight-card';
import {petText} from '@/lib/pets';
export default function DriverActiveTrip({trip:t,accessToken,busy,onStatus,onUndo,onComplete,onNavigate,onPayment}:{trip:any;accessToken:string;busy:boolean;onStatus:(s:string)=>void;onUndo:()=>void;onComplete:()=>void;onNavigate:(destination:boolean)=>void;onPayment:()=>void;onRoute:()=>void}){
 const labels:Record<string,string>={accepted:'Accepterad',en_route:'På väg till kunden',arrived:'Framme vid kunden',passenger_onboard:'Kund i bilen'};
 const next:Record<string,[string,string]>={accepted:['en_route','START'],en_route:['arrived','FRAMME'],arrived:['passenger_onboard','KUND I BILEN']};
 return <article className="activeTripPanel simpleDriverTrip" data-booking-id={t.id}>
 <header><b>Körning #{t.booking_number}</b><strong>{t.price} kr</strong></header>
 <DriverTripTiming trip={t}/>
 <button type="button" className="driverStartTrip" disabled={busy} onClick={()=>next[t.status]?onStatus(next[t.status][0]):onComplete()}>
  <strong><AppText text={busy?'Sparar…':next[t.status]?.[1]||'SLUTFÖR'}/></strong>
  {t.status==='accepted'&&<span>Kör till kunden</span>}
 </button>
 <p className="activeTripStatus"><AppText text={labels[t.status]||t.status}/></p>
 <div className="activeTripAddress"><span>A</span><b>{t.pickup}</b></div>
 {t.price_breakdown?.stop_address&&<div className="activeTripAddress"><span>+</span><b>{t.price_breakdown.stop_address}</b></div>}
 <div className="activeTripAddress destination"><span>B</span><b>{t.destination}</b></div>
 {(t.child_seats>0||t.pet_details||t.notes)&&<div className="driverTripEssentials">{t.child_seats>0&&<b>Barnstolar: {t.child_seats}</b>}{t.pet_details&&<b>{petText(t.pet_details)}</b>}{t.notes&&<p>{t.notes}</p>}</div>}
 <DriverCustomerChatButton bookingId={t.id}/>
 <details className="driverTripMore"><summary>Kund och detaljer</summary>
 <p><b>{t.customer_name}</b> · {t.passengers} passagerare · {t.car_type==='large'?'Storbil':'Vanlig bil'}</p>
 {t.customer_phone&&<a href={'tel:'+t.customer_phone}>Ring kund · {t.customer_phone}</a>}
 <DriverFlightCard notes={t.notes} pickupTime={t.pickup_time} pickupAddress={t.pickup} destinationAddress={t.destination} accessToken={accessToken}/>
 <button type="button" onClick={()=>onNavigate(false)}>Navi till hämtplats</button><button type="button" onClick={()=>onNavigate(true)}>Navi till destination</button>
 <p className={t.payment_status==='paid'?'paid':''}>{t.payment_status==='paid'?'Betald via appen – ta inte betalt igen':'Ej betald'}</p>
 {t.payment_status!=='paid'&&<button type="button" disabled={busy} onClick={onPayment}>Begär betalning</button>}
 <button type="button" disabled={busy} onClick={onUndo}>Ångra senaste status</button>
 </details>
 </article>;
}
