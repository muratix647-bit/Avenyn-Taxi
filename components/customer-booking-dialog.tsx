"use client";


import PetField from './pet-field';
import {AppText} from "@/components/app-language";
import BookingRouteFields from "@/components/booking-route-fields";
import {paymentMethods,withoutStopNote} from "@/lib/booking-options";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Pencil, Plane, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Place = {
  id?: string;
  label: string;
  primary?: string;
  secondary?: string;
  lat?: number;
  lng?: number;
};

function formFromBooking(booking: any) {
  return {
    petDetails:booking?.petDetails||null,
    stop: booking?.stop || null,
    paymentMethod: booking?.paymentMethod || "Kort",
    customerName: booking?.customerName || "",
    customerPhone: booking?.customerPhone || "",
    pickup: {
      id: booking?.pickupPlaceId || undefined,
      label: booking?.pickup || "",
      lat: booking?.pickupLat == null ? undefined : Number(booking.pickupLat),
      lng: booking?.pickupLng == null ? undefined : Number(booking.pickupLng),
    } as Place,
    destination: {
      id: booking?.destinationPlaceId || undefined,
      label: booking?.destination || "",
      lat:
        booking?.destinationLat == null ? undefined : Number(booking.destinationLat),
      lng:
        booking?.destinationLng == null ? undefined : Number(booking.destinationLng),
    } as Place,
    bookingDate: booking?.bookingDate || "",
    pickupTime: booking?.pickupClock || "",
    passengers: Number(booking?.passengers || 1),
    luggageCount: Number(booking?.luggageCount || 0),
    vehicle: booking?.vehicle === "large" ? "large" : "standard",
    childSeats: Number(booking?.childSeats || 0),
    flightNumber: booking?.flightNumber || "",
    extraMessage: withoutStopNote(booking?.extraMessage),
  };
}

export default function CustomerBookingDialog({
  booking,
  open,
  accessToken,
  onOpenChange,
  onSaved,
}: {
  booking: any;
  open: boolean;
  accessToken: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState(() => formFromBooking(booking));
  const [flights, setFlights] = useState<any[]>([]);
  const [flightError, setFlightError] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !booking) return;
    setForm(formFromBooking(booking));
    setPreview(null);
    setConfirmed(false);
    setError("");
    setFlightError("");
    fetch(`/api/swedavia/arrivals?bookingId=${encodeURIComponent(booking.id)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Flygen kunde inte hämtas.");
        setFlights(payload.flights || []);
      })
      .catch((reason) => setFlightError(reason?.message || "Flygen kunde inte hämtas."));
  }, [accessToken, booking, open]);

  const payload = useMemo(
    () => ({
      stop: form.stop,
      paymentMethod:form.paymentMethod,
      petDetails:form.petDetails,
      bookingId: booking?.id,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      pickup: form.pickup.label,
      pickupLat: form.pickup.lat,
      pickupLng: form.pickup.lng,
      pickupPlaceId: form.pickup.id,
      destination: form.destination.label,
      destinationLat: form.destination.lat,
      destinationLng: form.destination.lng,
      destinationPlaceId: form.destination.id,
      bookingDate: form.bookingDate,
      pickupTime: form.pickupTime,
      passengers: form.passengers,
      luggageCount: form.luggageCount,
      vehicle: form.vehicle,
      childSeats: form.childSeats,
      flightNumber: form.flightNumber,
      extraMessage: form.extraMessage,
    }),
    [booking?.id, form],
  );

  const change = (values: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...values }));
    setPreview(null);
    setConfirmed(false);
    setError("");
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/customer-bookings", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...payload, preview: true }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Ändringen kunde inte kontrolleras.");
        setPreview(result);
        if (result.requiresPriceConfirmation) return;
      }
      if (preview?.requiresPriceConfirmation && !confirmed)
        throw new Error("Bekräfta det nya priset innan du sparar.");
      const response = await fetch("/api/customer-bookings", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          confirmPriceChange: Boolean(preview?.requiresPriceConfirmation),
          expectedNewPrice: preview?.newPrice,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Ändringen kunde inte sparas.");
      await onSaved();
      onOpenChange(false);
    } catch (reason: any) {
      setError(reason?.message || "Ändringen kunde inte sparas.");
    } finally {
      setBusy(false);
    }
  };

  if (!booking) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="customerEditDialog sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle><Pencil /> <AppText text={"Redigera bokning #"} />{<AppText text={booking.bookingNumber} />}</DialogTitle>
          <DialogDescription>
            <AppText text={"Ändra resan eller koppla ett flyg. Priset visas innan du godkänner en prisändring."} /></DialogDescription>
        </DialogHeader>
        <div className="customerEditScroll">
          <div className="customerEditGrid">
            <label><span><AppText text={"Namn"} /></span><input value={form.customerName} onChange={(event) => change({ customerName: event.target.value })} /></label>
            <label><span><AppText text={"Mobilnummer"} /></span><input type="tel" value={form.customerPhone} onChange={(event) => change({ customerPhone: event.target.value })} /></label>
            <BookingRouteFields pickup={form.pickup} destination={form.destination} stop={form.stop} onChange={change}/>
            <label><span><AppText text={"Betalsätt"} /></span><select value={form.paymentMethod} disabled={booking.paymentStatus === "paid"} onChange={e=>change({paymentMethod:e.target.value})}>{!paymentMethods.includes(form.paymentMethod)&&<option>{<AppText text={form.paymentMethod} />}</option>}{paymentMethods.map(m=><option key={m} value={m}>{<AppText text={m} />}</option>)}</select></label>
            <label><span><AppText text={"Datum"} /></span><input type="date" value={form.bookingDate} onChange={(event) => change({ bookingDate: event.target.value })} /></label>
            <label><span><AppText text={"Tid"} /></span><input type="time" value={form.pickupTime} onChange={(event) => change({ pickupTime: event.target.value })} /></label>
            <PetField value={form.petDetails} onChange={petDetails=>change({petDetails})}/><label><span><AppText text={"Passagerare"} /></span><select value={form.passengers} onChange={(event) => change({ passengers: Number(event.target.value) })}>{[1,2,3,4,5,6,7].map((number) => <option key={number}>{<AppText text={number} />}</option>)}</select></label>
            <label><span><AppText text={"Bagage"} /></span><input type="number" min="0" max="30" value={form.luggageCount} onChange={(event) => change({ luggageCount: Number(event.target.value) })} /></label>
            <label><span><AppText text={"Biltyp"} /></span><select value={form.vehicle} onChange={(event) => change({ vehicle: event.target.value })}><option value="standard"><AppText text={"Vanlig bil"} /></option><option value="large"><AppText text={"Storbil"} /></option></select></label>
            <label><span><AppText text={"Barnstolar"} /></span><select value={form.childSeats} onChange={(event) => change({ childSeats: Number(event.target.value) })}>{[0,1,2,3].map((number) => <option key={number}>{<AppText text={number} />}</option>)}</select></label>
            <label className="wide"><span><Plane /> <AppText text={"Flygnummer"} /></span><input value={form.flightNumber} onChange={(event) => change({ flightNumber: event.target.value.toUpperCase() })} placeholder="Exempel SK158" /></label>
            {flights.length > 0 && <label className="wide"><span><AppText text={"Välj bland flygen"} /></span><select value={form.flightNumber} onChange={(event) => change({ flightNumber: event.target.value })}><option value=""><AppText text={"Välj flyg…"} /></option>{flights.map((flight) => <option key={flight.id} value={flight.flightNumber}>{<AppText text={flight.flightNumber} />} · {<AppText text={flight.direction === "departure" ? flight.destination : flight.origin} />}</option>)}</select></label>}
            {flightError && <p className="customerEditHint wide">{<AppText text={flightError} />} <AppText text={"Du kan fortfarande skriva flygnumret."} /></p>}
            <label className="wide"><span><AppText text={"Meddelande till föraren"} /></span><textarea rows={3} value={form.extraMessage} onChange={(event) => change({ extraMessage: event.target.value })} /></label>
          </div>
          <div className="customerFlightMonitorNotice"><BellRing /><span><b><AppText text={"Flygbevakning ingår"} /></b><small><AppText text={"Med flygnummer kan du få uppdateringar i resan och via e-post om flyget ändrar tid eller ställs in. Vi garanterar inte att informationen är aktuell eller fullständig. Kontrollera alltid själv med flygbolaget."} /></small></span></div>
          {preview?.requiresPriceConfirmation && <div className="customerPriceConfirm"><span><AppText text={"Nytt pris"} /></span><strong>{<AppText text={preview.newPrice} />} <AppText text={"kr"} /></strong><small><AppText text={"Tidigare"} />{<AppText text={preview.currentPrice} />} <AppText text={"kr"} /></small><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> <AppText text={"Jag godkänner det nya priset"} /></label></div>}
          {error && <div className="customerPortalError" role="alert">{<AppText text={error} />}</div>}
        </div>
        <DialogFooter>
          <button type="button" className="customerEditCancel" onClick={() => onOpenChange(false)} disabled={busy}><AppText text={"Stäng"} /></button>
          <button type="button" className="customerEditSave" onClick={save} disabled={busy}><Save /> {<AppText text={busy ? "Sparar…" : preview?.requiresPriceConfirmation ? "Godkänn och spara" : "Kontrollera och spara"} />}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
