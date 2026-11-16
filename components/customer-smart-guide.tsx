"use client";

import {AppText} from "@/components/app-language";
import {createAddressSearch,resolveAddress,warmAddressSearch,knownAddresses} from "@/lib/address-search";
import {cachedAddresses,rememberAddresses,matchingCachedAddresses} from "@/lib/address-suggestions-cache";

import {onlinePaymentOptions,onlinePaymentAvailability} from "@/lib/payment-copy";
import {paymentMethods} from "@/lib/booking-options";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  CreditCard,
  Crosshair,
  GripVertical,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Navigation,
  Plane,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { LANDVETTER_AIRPORT } from "@/lib/prices";
import { GOTHENBURG_CENTRAL } from "@/lib/places";

type Place = {
  id?: string;
  label: string;
  primary?: string;
  secondary?: string;
  lat?: number;
  lng?: number;
  area?: string;
  components?: Record<string, string>;
};

type BookingResult = {
  id: number;
  bookingId: string;
  price: number;
  trackingToken: string;
};

type PriceQuote = {
  quoteToken?:string;dynamicPercent?:number;
  area?: string | null;
  price: number;
  totalPrice: number;
  type: "fixed" | "metered" | "estimated";
  distanceKm?: number | null;
  durationMinutes?: number | null;
  bookingType?: "prebooking" | "instant" | null;
};

const pad = (value: number) => String(value).padStart(2, "0");
const localDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
function ChatAddress({
  label,
  value,
  selected,
  onChange,
  onSelect,
}: {
  label: string;
  value: string;
  selected: Place | null;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
}) {
  const search=useRef(createAddressSearch()),generation=useRef(0);
  useEffect(()=>{void warmAddressSearch().catch(()=>{});},[]);
  const [hits, setHits] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const requestGeneration=++generation.current;
    if (selected?.label === value || value.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setSearchError("");
    const cached=cachedAddresses(value);
    if(cached){setHits(cached);setLoading(false);return;}
    setHits([...knownAddresses(value),...matchingCachedAddresses(value)]);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      search.current(value,controller.signal)
        .then((result) => { if (controller.signal.aborted||requestGeneration!==generation.current) return; rememberAddresses(value,Array.isArray(result)?result:[]); setHits(Array.isArray(result) ? result : []); if (!result.length) setSearchError("Inga förslag. Prova gatunamn och ort."); })
        .catch(() => { if (!controller.signal.aborted&&requestGeneration===generation.current) setSearchError("Sökningen kunde inte slutföras. Försök skriva igen."); })
        .finally(() => { if (!controller.signal.aborted&&requestGeneration===generation.current) setLoading(false); });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selected?.label, value]);

  return (
    <label className={`chatAddressField ${selected?.label === value ? "chatAddressField--selected" : ""}`}>
      <span>{<AppText text={label} />}</span>
      <div>
        <MapPin />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Skriv gata och nummer"
          autoComplete="off"
        />
        {loading && <LoaderCircle className="chatFieldSpinner" />}
        {!loading && selected?.label === value && <CheckCircle2 className="chatFieldSelected" />}
      </div>
      {value.trim().length >= 2 && !selected && (
        <small className="chatAddressHelp"><AppText text={"Välj den fullständiga adressen i listan för att få pris."} /></small>
      )}
      {searchError && <small role="status">{<AppText text={searchError} />}</small>}
      {hits.length > 0 && (
        <div className="chatAddressSuggestions" role="listbox">
          {hits.some(p=>p.id?.startsWith("google:"))&&<small><AppText text={"Google Maps"} /></small>}
          {hits.map((place, index) => (
            <button
              type="button"
              key={`${place.id || place.label}-${index}`}
              onClick={async () => {
                const current=++generation.current;setLoading(true);
                try {const resolved=await resolveAddress(place);if(current!==generation.current)return;onSelect(resolved);setHits([]);}
                catch {if(current===generation.current)setSearchError("Adressen kunde inte hämtas. Välj igen.");}
                finally {if(current===generation.current)setLoading(false);}
              }}
            >
              <MapPin />
              <span>
                <strong>{<AppText text={place.primary || place.label} />}</strong>
                {place.secondary && <small>{<AppText text={place.secondary} />}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

export default function CustomerSmartGuide() {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"start" | "booking" | "success">("start");
  const [pickup, setPickup] = useState("");
  const [stop, setStop] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupPlace, setPickupPlace] = useState<Place | null>(null);
  const [stopPlace, setStopPlace] = useState<Place | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);
  const [stopEnabled, setStopEnabled] = useState(false);
  const [pickupTime, setPickupTime] = useState("now");
  const [passengers, setPassengers] = useState(1);
  const [vehicle, setVehicle] = useState<"standard" | "large">("standard");
  const [childSeats, setChildSeats] = useState(0);
  const [paymentMethod,setPaymentMethod] = useState("Kort");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [routeReordering, setRouteReordering] = useState(false);
  const [routeDragOffset, setRouteDragOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [quoteRefresh,setQuoteRefresh]=useState(0);
  const quoteRequest = useRef(0);
  const routeSwapGesture = useRef<{ pointerId: number; startY: number } | null>(null);

  const completeAddresses = Boolean(
    pickupPlace && destinationPlace && (!stopEnabled || stopPlace),
  );
  const addressNeedsSelection = [
    { value: pickup, place: pickupPlace },
    ...(stopEnabled ? [{ value: stop, place: stopPlace }] : []),
    { value: destination, place: destinationPlace },
  ].some(({ value, place }) => value.trim().length >= 2 && !place);
  const earliest = useMemo(() => localDateTime(new Date()), []);
  const quote = quoteData?.quote as PriceQuote | null | undefined;
  const quotePrice = quote?.totalPrice == null ? null : Number(quote.totalPrice);
  const quoteCaption = quote
    ? quote.type === "fixed" && quote.area
      ? `Fastpris ${quote.area} ↔ Landvetter Airport${stopEnabled ? " · stoppet ingår i totalen" : ""}`
      : quote.type === "fixed"
        ? `Fastpris till/från Landvetter${stopEnabled ? " · stoppet ingår i totalen" : ""}`
      : quote.type === "metered" && quote.distanceKm != null && quote.durationMinutes != null
        ? `${quote.distanceKm.toFixed(1)} km · ${Math.round(quote.durationMinutes)} min · förbokning`
        : quote.type === "estimated" && quote.distanceKm != null && quote.durationMinutes != null
          ? `Prisförslag · cirka ${quote.distanceKm.toFixed(1)} km · ${Math.round(quote.durationMinutes)} min`
          : "Samma pris som i Boka"
    : "";

  useEffect(() => {
    const requestId = ++quoteRequest.current;
    if (screen !== "booking") {
      setQuoteData(null);
      setQuoteLoading(false);
      return;
    }
    if (
      pickup.trim().length < 2 ||
      destination.trim().length < 2 ||
      (stopEnabled && stop.trim().length < 2)
    ) {
      setQuoteData(null);
      setQuoteLoading(false);
      return;
    }
    if (addressNeedsSelection || !completeAddresses || !pickupTime) {
      setQuoteLoading(false);
      return;
    }
    const requestKey = `chat-quote-${requestId}-${Date.now()}`;
    setQuoteLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        pickup: pickupPlace!.label,
        destination: destinationPlace!.label,
        pickupTime,
        carType: vehicle,
        childSeats: String(childSeats),
        requestKey,
      });
      if (pickupPlace!.id) params.set("pickupId", pickupPlace!.id!);
      if (destinationPlace!.id) params.set("destinationId", destinationPlace!.id!);
      if (pickupPlace!.area) params.set("pickupArea", pickupPlace!.area!);
      if (destinationPlace!.area) params.set("destinationArea", destinationPlace!.area!);
      if (Number.isFinite(pickupPlace!.lat) && Number.isFinite(pickupPlace!.lng)) {
        params.set("pickupLat", String(pickupPlace!.lat));
        params.set("pickupLng", String(pickupPlace!.lng));
      }
      if (Number.isFinite(destinationPlace!.lat) && Number.isFinite(destinationPlace!.lng)) {
        params.set("destinationLat", String(destinationPlace!.lat));
        params.set("destinationLng", String(destinationPlace!.lng));
      }
      if (stopEnabled && stopPlace) {
        params.set("stop", stopPlace.label);
        if (stopPlace.id) params.set("stopId", stopPlace.id);
        if (stopPlace.area) params.set("stopArea", stopPlace.area);
        if (Number.isFinite(stopPlace.lat) && Number.isFinite(stopPlace.lng)) {
          params.set("stopLat", String(stopPlace.lat));
          params.set("stopLng", String(stopPlace.lng));
        }
      }
      fetch(`/api/prices?${params}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if(data.refreshQuote)setQuoteRefresh(n=>n+1);
      if (!response.ok) throw new Error(data?.error || "Priset kunde inte hämtas.");
          return data;
        })
        .then((data: any) => {
          if (requestId === quoteRequest.current && data?.requestKey === requestKey)
            setQuoteData(data);
        })
        .catch((cause) => {
          if (
            requestId === quoteRequest.current &&
            !(cause instanceof DOMException && cause.name === "AbortError")
          )
            setQuoteData({ error: cause instanceof Error ? cause.message : "Priset kunde inte hämtas." });
        })
        .finally(() => {
          if (requestId === quoteRequest.current) setQuoteLoading(false);
        });
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [addressNeedsSelection, childSeats, completeAddresses, destination, destinationPlace, pickup, pickupPlace, pickupTime, screen, stop, stopEnabled, stopPlace, vehicle,quoteRefresh]);

  const begin = () => {
    setPickupTime("");
    setError("");
    setScreen("booking");
  };

  const locatePickup = () => {
    if (!navigator.geolocation) {
      setError("Din webbläsare stöder inte positionering.");
      return;
    }
    setError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPickup("Hämtar adress…");
        setPickupPlace(null);
        try {
          const response = await fetch(`/api/addresses?lat=${lat}&lng=${lng}`, { cache: "no-store" });
          const place: Place = await response.json();
          if (!response.ok || !place?.label) throw new Error("address_not_found");
          const selectedPlace = { ...place, lat, lng };
          setPickup(selectedPlace.label);
          setPickupPlace(selectedPlace);
        } catch {
          setPickup("");
          setPickupPlace(null);
          setError("Vi kunde inte hitta adressen för din position. Skriv adressen i stället.");
        } finally {
          setLocating(false);
        }
      },
      (positionError) => {
        setLocating(false);
        setError(positionError.code === 1
          ? "Tillåt platsåtkomst i webbläsaren för att hämta din position."
          : "Din position kunde inte hämtas. Försök igen eller skriv adressen.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  };

  const swapPickupAndStop = () => {
    if (!stopEnabled || !pickupPlace || !stopPlace) return;
    const previousPickup = pickupPlace;
    const previousPickupLabel = pickup;
    setPickup(stopPlace.label);
    setPickupPlace(stopPlace);
    setStop(previousPickupLabel);
    setStopPlace(previousPickup);
    setQuoteLoading(true);
    setError("");
  };

  const beginRouteSwap = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pickupPlace || !stopPlace) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    routeSwapGesture.current = { pointerId: event.pointerId, startY: event.clientY };
    setRouteDragOffset(0);
    setRouteReordering(true);
  };

  const moveRouteSwap = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = routeSwapGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setRouteDragOffset(Math.max(-52, Math.min(52, event.clientY - gesture.startY)));
  };

  const finishRouteSwap = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = routeSwapGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    routeSwapGesture.current = null;
    setRouteDragOffset(0);
    setRouteReordering(false);
    if (!cancelled) swapPickupAndStop();
  };

  const reset = () => {
    setScreen("start");
    setPickup("");
    setStop("");
    setDestination("");
    setPickupPlace(null);
    setStopPlace(null);
    setDestinationPlace(null);
    setStopEnabled(false);
    setPickupTime("");
    setQuoteData(null);
    setResult(null);
    setPaymentBusy(false);
    setError("");
  };

  const payNow = async () => {
    if (!result) return;
    setPaymentBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: result.bookingId,
          trackingToken: result.trackingToken,
          source: "customer",
        }),
      });
      const data: any = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data?.error || "Betalningen kunde inte startas.");
      }
      location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Betalningen kunde inte startas.");
      setPaymentBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!completeAddresses) {
      setError("Välj fullständiga adresser från förslagen.");
      return;
    }
    if (!pickupTime) {
      setError("Välj datum och tid.");
      return;
    }
    if (quoteLoading || quotePrice == null) {
      setError("Vänta tills totalpriset har räknats ut.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policyVersion:"2026-10-02-booking-confirmation",
          quoteToken:quote?.quoteToken,
          pickup: pickupPlace!.label,
          stop: stopEnabled ? stopPlace!.label : undefined,
          destination: destinationPlace!.label,
          pickupId: pickupPlace!.id,
          stopId: stopEnabled ? stopPlace!.id : undefined,
          destinationId: destinationPlace!.id,
          pickupArea: pickupPlace!.area,
          stopArea: stopEnabled ? stopPlace!.area : undefined,
          destinationArea: destinationPlace!.area,
          pickupLat: pickupPlace!.lat,
          pickupLng: pickupPlace!.lng,
          stopLat: stopEnabled ? stopPlace!.lat : undefined,
          stopLng: stopEnabled ? stopPlace!.lng : undefined,
          destinationLat: destinationPlace!.lat,
          destinationLng: destinationPlace!.lng,
          paymentMethod,
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          pickupTime,
          passengers,
          vehicle,
          childSeats,
          luggageCount: 0,
          flightNumber,
          extraMessage: "Bokad via Avenyn Chat",
          locale: "sv",
        }),
      });
      const data: any = await response.json();
      if(data.refreshQuote)setQuoteRefresh(n=>n+1);
      if (!response.ok) throw new Error(data?.error || "Bokningen kunde inte skickas.");
      setResult({
        id: Number(data.id),
        bookingId: String(data.bookingId),
        price: Number(data.price),
        trackingToken: String(data.trackingToken),
      });
      setScreen("success");
      if(pickupTime === "now" && data.trackingToken) window.location.assign(`/track/${data.trackingToken}?live=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bokningen kunde inte skickas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`customerGuide customerChat ${open ? "customerGuide--open" : ""}`}>
      {open && (
        <section className="customerGuidePanel customerChatPanel" aria-label="Boka taxi via Avenyn Chat">
          <header className="customerChatHeader">
            <span className="customerChatIdentity">
              <span className="customerChatAvatar"><MessageCircle /></span>
              <span><b><AppText text={"Avenyn Chat"} /></b><small><i /> <AppText text={"Online · svarar direkt"} /></small></span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Stäng chatten"><X /></button>
          </header>

          <div className="customerChatBody">
            <div className="chatBubble chatBubble--bot">
              <Sparkles />
              <p><AppText text={"Hej! Här kan du förboka precis som i Boka och få totalpriset direkt."} /></p>
            </div>

            {screen === "start" && (
              <div className="chatStartActions">
                <button type="button" onClick={begin}><CalendarClock /><span><b><AppText text={"Förboka resa"} /></b><small><AppText text={"Välj adresser, datum och få samma pris som i Boka"} /></small></span><ChevronRight /></button>
                <a href="/customer" onClick={() => setOpen(false)}><CarFront /> <AppText text={"Se mina resor"} /><ChevronRight /></a>
              </div>
            )}

            {screen === "booking" && (
              <form className="chatBookingForm" onSubmit={submit}>
                <div className="chatBubble chatBubble--customer">
                  <AppText text={"Jag vill förboka"} /></div>
                <div className="chatFormCard">
                  <b><AppText text={"Var går resan?"} /></b>
                  <div className="chatRouteShortcuts" aria-label="Snabbval för resan">
                    <button
                      type="button"
                      onClick={() => {
                        const place = { ...LANDVETTER_AIRPORT } as Place;
                        setDestination(place.label);
                        setDestinationPlace(place);
                      }}
                    > <AppText text={"Till Landvetter"} /></button>
                    <button
                      type="button"
                      onClick={() => {
                        const place = { ...LANDVETTER_AIRPORT } as Place;
                        setPickup(place.label);
                        setPickupPlace(place);
                      }}
                    > <AppText text={"Från Landvetter"} /></button>
                    <button
                      type="button"
                      onClick={() => {
                        const place = { ...GOTHENBURG_CENTRAL } as Place;
                        setDestination(place.label);
                        setDestinationPlace(place);
                      }}
                    ><Navigation /> <AppText text={"Till Göteborg Central"} /></button>
                  </div>
                  <button type="button" className="chatLocateButton" onClick={locatePickup} disabled={locating}>
                    {locating ? <LoaderCircle /> : <Crosshair />}
                    {<AppText text={locating ? "Hämtar din position…" : "Hämta min position"} />}
                  </button>
                  <ChatAddress
                    label="Hämtning"
                    value={pickup}
                    selected={pickupPlace}
                    onChange={(value) => { setPickup(value); setPickupPlace(null); }}
                    onSelect={(place) => { setPickup(place.label); setPickupPlace(place); }}
                  />
                  {stopEnabled && (
                    <>
                      <button
                        type="button"
                        className={`routeSwapHandle chatRouteSwapHandle ${routeReordering ? "dragging" : ""}`}
                        style={{ transform: `translateY(${routeDragOffset}px)` }}
                        disabled={!pickupPlace || !stopPlace}
                        aria-label="Dra eller tryck för att byta plats på upphämtning och extra stopp"
                        onPointerDown={beginRouteSwap}
                        onPointerMove={moveRouteSwap}
                        onPointerUp={(event) => finishRouteSwap(event)}
                        onPointerCancel={(event) => finishRouteSwap(event, true)}
                        onClick={(event) => {
                          if (event.detail === 0) swapPickupAndStop();
                        }}
                      >
                        <GripVertical aria-hidden="true" />
                        <span><b><AppText text={"Byt ordning"} /></b><small><AppText text={"Dra eller tryck · priset uppdateras direkt"} /></small></span>
                      </button>
                      <ChatAddress
                        label="Extra stopp"
                        value={stop}
                        selected={stopPlace}
                        onChange={(value) => { setStop(value); setStopPlace(null); }}
                        onSelect={(place) => { setStop(place.label); setStopPlace(place); }}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    className="chatStopToggle"
                    onClick={() => {
                      if (stopEnabled) {
                        setStop("");
                        setStopPlace(null);
                      }
                      setStopEnabled((value) => !value);
                      setError("");
                    }}
                  >
                    {stopEnabled ? <X /> : <CirclePlus />}
                    {<AppText text={stopEnabled ? "Ta bort extra stopp" : "Lägg till stopp"} />}
                  </button>
                  <ChatAddress
                    label="Destination"
                    value={destination}
                    selected={destinationPlace}
                    onChange={(value) => { setDestination(value); setDestinationPlace(null); }}
                    onSelect={(place) => { setDestination(place.label); setDestinationPlace(place); }}
                  />
                </div>

                <div className="chatFormCard">
                  <b><AppText text={"När och hur?"} /></b>
                  <div><div className="rideTimeChoice"><button type="button" aria-pressed={pickupTime==='now'} onClick={()=>setPickupTime('now')}><AppText text={"Åk nu"} /></button><button type="button" aria-pressed={pickupTime!=='now'} onClick={()=>setPickupTime('')}><AppText text={"Förboka"} /></button></div>{pickupTime!=='now' && <label><span><AppText text={"Datum och tid"} /></span><input type="datetime-local" min={earliest} value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} required /></label>}</div>
                  <div className="chatFormGrid">
                    <label><span><AppText text={"Passagerare"} /></span><select value={passengers} onChange={(event) => setPassengers(Number(event.target.value))}>{[1,2,3,4,5,6,7].map((value) => <option key={value} value={value}>{<AppText text={value} />}</option>)}</select></label>
                    <label><span><AppText text={"Bil"} /></span><select value={vehicle} onChange={(event) => setVehicle(event.target.value as "standard" | "large")}><option value="standard"><AppText text={"Vanlig bil"} /></option><option value="large"><AppText text={"Storbil"} /></option></select></label>
                    <label><span><AppText text={"Barnstol"} /></span><select value={childSeats} onChange={(event) => setChildSeats(Number(event.target.value))}>{[0,1,2,3].map((value) => <option key={value} value={value}>{<AppText text={value} />}</option>)}</select></label>
                  </div>
                </div>

                <div className="chatFormCard">
                  <b><AppText text={"Dina uppgifter"} /></b>
                  <label><span><AppText text={"Betalsätt"} /></span><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{paymentMethods.map(m=><option key={m} value={m}>{<AppText text={m} />}</option>)}</select></label>{paymentMethod === "Tap (Blipp)" && <p className="acceptedBookingPayments"><AppText text={"Blippa kort, Apple Pay eller Google Pay mot förarens kompatibla telefon vid resan."} /></p>}<p className="acceptedBookingPayments"><AppText text={"Vi tar emot kort, Tap (Blipp), Swish, PayPal och kontant."} /></p>
                  <label><span><AppText text={"Namn"} /></span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
                  <label><span><AppText text={"Mobilnummer"} /></span><input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="+46…" required /></label>
                  <label><span><AppText text={"E-post"} /></span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
                  <label><span><AppText text={"Flygnummer"} /><small><AppText text={"valfritt"} /></small></span><input value={flightNumber} onChange={(event) => setFlightNumber(event.target.value.toUpperCase())} placeholder="Till exempel SK431" /></label>
                </div>

                <div className={`chatQuote ${quotePrice != null ? "chatQuote--ready" : ""}`} aria-live="polite" aria-busy={quoteLoading}>
                  {addressNeedsSelection ? (
                    <span><AppText text={"Välj den fullständiga adressen i förslagen."} /></span>
                  ) : !pickupTime ? (
                    <span><AppText text={"Välj datum och tid för att se totalpriset."} /></span>
                  ) : quoteLoading ? (
                    <><LoaderCircle /> <AppText text={"Uppdaterar pris…"} />{quotePrice != null && <strong>{<AppText text={quotePrice} />} <AppText text={"kr"} /></strong>}</>
                  ) : quotePrice != null ? (
                    <><span><CheckCircle2 /> {<AppText text={stopEnabled ? "Ditt totalpris" : "Ditt beräknade pris"} />}<small>{<AppText text={quoteCaption} />} <AppText text={"· Priset hålls i 10 minuter"} /></small></span><strong>{<AppText text={quotePrice} />} <AppText text={"kr"} /></strong></>
                  ) : completeAddresses ? (
                    <span>{<AppText text={quoteData?.error || "Priset kunde inte beräknas. Kontrollera adresserna eller kontakta oss."} />}</span>
                  ) : (
                    <span><AppText text={"Välj upphämtning och destination för att se priset."} /></span>
                  )}
                </div>
                {error && <p className="chatBookingError">{<AppText text={error} />}</p>}
<p className="bookingTermsNotice"><AppText text={"Genom att boka godkänner du"} /><a href="/bokningsvillkor" target="_blank" rel="noreferrer"><AppText text={"bokningsvillkoren"} /></a><AppText text={". Avbokning inom 24 timmar eller utebliven resa: fullt pris."} /></p>
                <button className="chatBookButton" type="submit" disabled={busy || quoteLoading || addressNeedsSelection || !pickupTime || quotePrice == null}>
                  {busy ? <><LoaderCircle /> <AppText text={"Skickar bokningen…"} /></> : quoteLoading ? <><LoaderCircle /> <AppText text={"Uppdaterar pris…"} /></> : <><AppText text={"Boka för"} />{<AppText text={quotePrice != null ? `${quotePrice} kr` : "pris"} />} <Send /></>}
                </button>
                <button className="chatBackButton" type="button" onClick={() => setScreen("start")}><ArrowLeft /> <AppText text={"Tillbaka"} /></button>
              </form>
            )}

            {screen === "success" && result && (
              <div className="chatSuccess">
                <span><CheckCircle2 /></span>
                <small><AppText text={"BOKNING MOTTAGEN"} /></small>
                <h3><AppText text={"Tack,"} />{<AppText text={name.split(" ")[0]} />}!</h3>
                <p><AppText text={"Din bokningsreferens är"} /><b>#{<AppText text={result.id} />}</b><AppText text={". Bekräftelsen skickas även via e-post och SMS."} /></p>
                <strong>{<AppText text={result.price} />} <AppText text={"kr"} /></strong>
                {error && <p className="chatBookingError">{<AppText text={error} />}</p>}
                <button className="chatPayButton" type="button" onClick={payNow} disabled={paymentBusy}>
                  <CreditCard />
                  {<AppText text={paymentBusy ? "Öppnar säker betalning…" : `Betala ${result.price} kr nu`} />}
                </button>
                <p className="chatPaymentMethods">{<AppText text={onlinePaymentOptions} />}. {<AppText text={onlinePaymentAvailability} />}</p>
                <a href={`/track/${result.trackingToken}`}><AppText text={"Följ din taxi live"} /><Navigation /></a>
                <button type="button" onClick={reset}><AppText text={"Boka en ny resa"} /></button>
              </div>
            )}
          </div>
          <footer className="customerChatFooter"><span><i /> <AppText text={"Säker bokning"} /></span><a href="tel:+46700315315"><AppText text={"Behöver du hjälp? Ring oss"} /></a></footer>
        </section>
      )}
      <button className="customerGuideTrigger customerChatTrigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? <X /> : <MessageCircle />}<span>{<AppText text={open ? "Stäng" : "Boka via chat"} />}</span>
      </button>
    </aside>
  );
}
