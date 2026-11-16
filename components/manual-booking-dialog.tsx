"use client";
import PetField from './pet-field';
import BookingRouteFields from "@/components/booking-route-fields";
import {paymentMethods,storedStop} from "@/lib/booking-options";
import {useEffect,useState} from "react";
import {ArrowRightLeft,CalendarPlus,MessageCircle} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from "@/components/ui/dialog";

const stockholmNow=()=>{const parts=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());const get=(type:string)=>parts.find(part=>part.type===type)?.value||"";return {bookingDate:`${get("year")}-${get("month")}-${get("day")}`,pickupTime:`${get("hour")}:${get("minute")}`};};
const blank=()=>({...stockholmNow(),petDetails:null as any,customerName:"",customerPhone:"",customerEmail:"",pickupAddress:"",pickupLat:null,pickupLng:null,pickupPlaceId:null,pickupArea:null,dropoffAddress:"",dropoffLat:null,dropoffLng:null,dropoffPlaceId:null,dropoffArea:null,passengers:1,luggageCount:0,carType:"standard",childSeats:0,price:"",stop:null,paymentMethod:"Kort",driverId:"",flightNumber:"",notes:"",smsMode:"details_and_link"});

const returnTripForm=(booking:any)=>{
  const defaults=blank();
  if(!booking)return defaults;
  const storedPickupTime=String(booking.pickup_time||"");
  const time=storedPickupTime.includes("T")?storedPickupTime.split("T")[1]?.slice(0,5):storedPickupTime.slice(0,5);
  const storedDate=booking.booking_date||storedPickupTime.slice(0,10);
  const originalMoment=storedDate&&time?new Date(`${storedDate}T${time}:00`).getTime():0;
  const keepOriginalTime=Number.isFinite(originalMoment)&&originalMoment>=Date.now();
  return {
    ...defaults,
    stop:storedStop(booking).label?storedStop(booking):null,
    paymentMethod:paymentMethods.includes(booking.payment_method)?booking.payment_method:"Kort",
    customerName:booking.customer_name||"",
    customerPhone:booking.customer_phone||"",
    customerEmail:booking.customer_email||"",
    pickupAddress:booking.dropoff_address||booking.destination||"",
    pickupLat:booking.dropoff_lat==null?null:Number(booking.dropoff_lat),
    pickupLng:booking.dropoff_lng==null?null:Number(booking.dropoff_lng),
    pickupPlaceId:booking.dropoff_place_id||null,
    pickupArea:booking.dropoff_area||null,
    dropoffAddress:booking.pickup_address||booking.pickup||"",
    dropoffLat:booking.pickup_lat==null?null:Number(booking.pickup_lat),
    dropoffLng:booking.pickup_lng==null?null:Number(booking.pickup_lng),
    dropoffPlaceId:booking.pickup_place_id||null,
    dropoffArea:booking.pickup_area||null,
    bookingDate:keepOriginalTime?storedDate:defaults.bookingDate,
    pickupTime:keepOriginalTime?time:defaults.pickupTime,
    passengers:Number(booking.passengers||1),
    petDetails:booking.pet_details||null,
    luggageCount:Number(booking.luggage_count||0),
    carType:/large|storbil/i.test(String(booking.car_type||""))?"large":"standard",
    childSeats:Number(booking.child_seats||0),
    price:String(booking.price??booking.fixed_price??booking.estimated_price??""),
    driverId:booking.assigned_driver_id||booking.driver_id||"",
    notes:`Returresa från bokning #${booking.booking_number||booking.id}`,
  };
};

export default function ManualBookingDialog({open,onOpenChange,drivers,onCreate,initialBooking=null}:{open:boolean,onOpenChange:(open:boolean)=>void,drivers:any[],onCreate:(body:any)=>Promise<any>,initialBooking?:any|null}){
  const[form,setForm]=useState<any>(blank),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const[quote,setQuote]=useState<any>(null),[quoteBusy,setQuoteBusy]=useState(false),[quoteError,setQuoteError]=useState("");
  useEffect(()=>{if(open){setForm(returnTripForm(initialBooking));setQuote(null);setQuoteError("");setError("");}},[open,initialBooking]);
  const change=(next:any)=>setForm((current:any)=>({...current,...next}));
  useEffect(()=>{
    const hasPickupReference=Boolean(form.pickupPlaceId)||(Number.isFinite(form.pickupLat)&&Number.isFinite(form.pickupLng));
    const hasDropoffReference=Boolean(form.dropoffPlaceId)||(Number.isFinite(form.dropoffLat)&&Number.isFinite(form.dropoffLng));
    if(!open||!hasPickupReference||!hasDropoffReference){setQuote(null);setQuoteError("");return;}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setQuoteBusy(true);setQuoteError("");
      const params=new URLSearchParams({pickup:form.pickupAddress,destination:form.dropoffAddress,pickupId:form.pickupPlaceId,dropoffId:form.dropoffPlaceId,pickupTime:`${form.bookingDate}T${form.pickupTime}`,carType:form.carType,childSeats:String(form.childSeats)});
      if(Number.isFinite(form.pickupLat))params.set("pickupLat",String(form.pickupLat));
      if(Number.isFinite(form.pickupLng))params.set("pickupLng",String(form.pickupLng));
      if(Number.isFinite(form.dropoffLat))params.set("destinationLat",String(form.dropoffLat));
      if(Number.isFinite(form.dropoffLng))params.set("destinationLng",String(form.dropoffLng));
      if(form.stop?.label){params.set("stop",form.stop.label);if(form.stop.lat!=null)params.set("stopLat",String(form.stop.lat));if(form.stop.lng!=null)params.set("stopLng",String(form.stop.lng));if(form.stop.id)params.set("stopId",form.stop.id);}
      if(form.pickupArea)params.set("pickupArea",form.pickupArea);
      if(form.dropoffArea)params.set("destinationArea",form.dropoffArea);
      try{const response=await fetch(`/api/prices?${params}`,{cache:"no-store",signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result?.error||"Prisförslaget kunde inte hämtas.");if(result.quote){setQuote(result.quote);setForm((current:any)=>({...current,price:String(result.quote.totalPrice)}));}else{setQuote(null);setQuoteError("Inget automatiskt pris hittades. Ange priset manuellt.");}}catch(reason:any){if(reason?.name!=="AbortError"){setQuote(null);setQuoteError(reason?.message||"Prisförslaget kunde inte hämtas.");}}finally{setQuoteBusy(false);}
    },350);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[open,form.pickupPlaceId,form.dropoffPlaceId,form.pickupLat,form.pickupLng,form.dropoffLat,form.dropoffLng,form.bookingDate,form.pickupTime,form.carType,form.childSeats,form.stop]);
  const save=async()=>{setBusy(true);setError("");try{const result=await onCreate({action:"create_manual_booking",booking:form});if(!result?.ok){setError(result?.error||"Bokningen kunde inte skapas.");return;}onOpenChange(false);}finally{setBusy(false);}};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="manualBookingDialog"><DialogHeader><DialogTitle><CalendarPlus/>{initialBooking?"Ny returresa":"Ny manuell bokning"}</DialogTitle><DialogDescription>{initialBooking?"Adresserna är omvända. Kontrollera returens datum, tid och pris innan du sparar.":"Kunden får en SMS-bekräftelse när bokningen sparas."}</DialogDescription></DialogHeader><div className="manualBookingScroll">{initialBooking&&<div className="manualReturnBanner"><ArrowRightLeft/><span><b>Returresa från #{initialBooking.booking_number||initialBooking.id}</b><small>{form.pickupAddress} → {form.dropoffAddress}</small></span></div>}<div className="manualBookingGrid">
    <label><span>Kundens namn *</span><input value={form.customerName} onChange={e=>change({customerName:e.target.value})}/></label><label><span>Mobilnummer *</span><input type="tel" placeholder="070 123 45 67" value={form.customerPhone} onChange={e=>change({customerPhone:e.target.value})}/></label>
    <label className="wide"><span>E-post</span><input type="email" value={form.customerEmail} onChange={e=>change({customerEmail:e.target.value})}/></label><BookingRouteFields pickup={{label:form.pickupAddress,lat:form.pickupLat??undefined,lng:form.pickupLng??undefined,id:form.pickupPlaceId??undefined,area:form.pickupArea}} destination={{label:form.dropoffAddress,lat:form.dropoffLat??undefined,lng:form.dropoffLng??undefined,id:form.dropoffPlaceId??undefined,area:form.dropoffArea}} stop={form.stop} onChange={({pickup,destination,stop})=>change({pickupAddress:pickup.label,pickupLat:pickup.lat??null,pickupLng:pickup.lng??null,pickupPlaceId:pickup.id??null,pickupArea:pickup.area??null,dropoffAddress:destination.label,dropoffLat:destination.lat??null,dropoffLng:destination.lng??null,dropoffPlaceId:destination.id??null,dropoffArea:destination.area??null,stop})}/>

    <div className="manualQuote wide" role="status"><strong>{quoteBusy?"Beräknar prisförslag…":quote?`Prisförslag: ${quote.totalPrice} kr`:"Välj båda adresserna från förslagen"}</strong>{quote&&<small>{quote.type==="fixed"?"Fast pris":"Beräknat taxipris"} · Du kan ändra priset manuellt nedan.</small>}{quoteError&&<small className="manualQuoteError">{quoteError}</small>}</div>
    <label><span>Datum *</span><input type="date" value={form.bookingDate} onChange={e=>change({bookingDate:e.target.value})}/></label><label><span>Hämtningstid *</span><input type="time" value={form.pickupTime} onChange={e=>change({pickupTime:e.target.value})}/></label>
    <PetField value={form.petDetails} onChange={petDetails=>change({petDetails})}/><label><span>Passagerare</span><input type="number" min="1" max="7" value={form.passengers} onChange={e=>change({passengers:e.target.value})}/></label><label><span>Bagage</span><input type="number" min="0" max="30" value={form.luggageCount} onChange={e=>change({luggageCount:e.target.value})}/></label>
    <label><span>Biltyp</span><select value={form.carType} onChange={e=>change({carType:e.target.value})}><option value="standard">Standard · 1–4</option><option value="large">Storbil · 5–7</option></select></label><label><span>Barnstolar</span><input type="number" min="0" max="3" value={form.childSeats} onChange={e=>change({childSeats:e.target.value})}/></label>
    <label><span>Pris inklusive moms *</span><div className="manualPrice"><input type="number" min="0" step="1" value={form.price} onChange={e=>change({price:e.target.value})}/><small>kr</small></div></label><label><span>Betalsätt</span><select value={form.paymentMethod} onChange={e=>change({paymentMethod:e.target.value})}>{paymentMethods.map(method=><option key={method}>{method}</option>)}</select></label>
    <label><span>Tilldela förare</span><select value={form.driverId} onChange={e=>change({driverId:e.target.value})}><option value="">Inte nu</option>{drivers.filter(x=>x.approved&&x.active!==false&&!x.archived_at).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label><span>Flygnummer</span><input placeholder="Till exempel SK431" value={form.flightNumber} onChange={e=>change({flightNumber:e.target.value})}/></label>
    <p className="manualSmsHint wide"><MessageCircle/>SMS-bekräftelse direkt och en separat påminnelse en timme före hämtning.</p><label className="wide"><span>Extra meddelande</span><textarea rows={3} value={form.notes} onChange={e=>change({notes:e.target.value})} placeholder="Portkod, skyltning eller annan information"/></label>
  </div>{form.smsMode!=="none"&&<p className="manualSmsHint"><MessageCircle/>Bekräftelsen innehåller bokningsnummer, hämtningstid och en länk till resan.</p>}{error&&<div className="bookingEditError" role="alert">{error}</div>}</div><DialogFooter><button className="editCancelButton" disabled={busy} onClick={()=>onOpenChange(false)}>Avbryt</button><button className="editSaveButton" disabled={busy} onClick={save}>{busy?"Skapar…":initialBooking?"Skapa returresa":"Skapa bokning"}</button></DialogFooter></DialogContent></Dialog>;
}
