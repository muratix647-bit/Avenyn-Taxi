"use client";

import {completionLocalTime} from "@/lib/completion-time";
import PetField from './pet-field';
import BookingTimeline from "@/components/booking-timeline";
import BookingRouteFields, {type RoutePlace} from "@/components/booking-route-fields";
import {storedStop,withoutStopNote} from "@/lib/booking-options";
import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plane } from "lucide-react";
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
  area?: string;
  components?: Record<string, string>;
};

type Props = {
  booking: any | null;
  drivers?: any[];
  open: boolean;
  api: (url: string, init?: RequestInit) => Promise<Response>;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
};

const flightNumberFromNotes = (notes: unknown) => {
  const match = String(notes || "").match(
    /flyg(?:nummer)?\s*[:#-]?\s*([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)/i,
  );
  return match?.[1]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
};

const notesWithoutFlightNumber = (notes: unknown) =>
  String(notes || "")
    .replace(
      /flyg(?:nummer)?\s*[:#-]?\s*[a-z0-9]{2,3}\s?\d{1,4}[a-z]?/gi,
      "",
    )
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .trim();

const driverPaymentMethods = ["card", "swish", "paypal", "cash", "invoice", "other"] as const;

const normalizeStoredPaymentMethod = (booking: any) => {
  if (String(booking?.payment_status || "").toLowerCase() === "paid") return "app";
  if (String(booking?.payment_method||"") === "Betallänk") return "link";
  const reported = String(booking?.driver_reported_payment_method || "").toLowerCase();
  if (["app", ...driverPaymentMethods].includes(reported as any)) return reported;
  const legacy = String(booking?.payment_method || "").toLowerCase();
  if (legacy.includes("betallänk")) return "link";
  if (legacy.includes("swish")) return "swish";
  if (legacy.includes("paypal")) return "paypal";
  if (legacy.includes("cash") || legacy.includes("kontant")) return "cash";
  if (legacy.includes("invoice") || legacy.includes("faktura")) return "invoice";
  if (legacy.includes("card") || legacy.includes("kort")) return "card";
  return "";
};

function initialForm(booking: any) {
  const pickupTime = String(booking?.pickup_time || "");
  const storedNotes = booking?.notes || booking?.extra_message || "";
  return {
    completeHistorical: false,
    driverId: booking?.assigned_driver_id || booking?.driver_id || "",
    completedTime: completionLocalTime(booking?.completed_at),
    petDetails:booking?.pet_details||null,
    stop: (storedStop(booking).label ? storedStop(booking) : null) as RoutePlace | null,
    customerName: booking?.customer_name || "",
    customerPhone: booking?.customer_phone || "",
    customerEmail: booking?.customer_email || "",
    pickup: {
      id: booking?.pickup_place_id || undefined,
      label: booking?.pickup_address || booking?.pickup || "",
      lat: booking?.pickup_lat == null ? undefined : Number(booking.pickup_lat),
      lng: booking?.pickup_lng == null ? undefined : Number(booking.pickup_lng),
    } as Place,
    destination: {
      id: booking?.dropoff_place_id || undefined,
      label: booking?.dropoff_address || booking?.destination || "",
      lat: booking?.dropoff_lat == null ? undefined : Number(booking.dropoff_lat),
      lng: booking?.dropoff_lng == null ? undefined : Number(booking.dropoff_lng),
    } as Place,
    bookingDate: booking?.booking_date || pickupTime.slice(0, 10),
    pickupTime: pickupTime.includes("T")
      ? pickupTime.split("T")[1]?.slice(0, 5) || ""
      : pickupTime.slice(0, 5),
    passengers: Number(booking?.passengers || 1),
    luggageCount: Number(booking?.luggage_count || 0),
    carType: /large|storbil/i.test(String(booking?.car_type || "")) ? "large" : "standard",
    childSeats: Number(booking?.child_seats || 0),
    price: Number(booking?.actual_price ?? booking?.fixed_price ?? booking?.estimated_price ?? 0),
    flightNumber:
      String(booking?.flight_number || "").toUpperCase().replace(/[^A-Z0-9]/g, "") ||
      flightNumberFromNotes(storedNotes),
    notes: withoutStopNote(notesWithoutFlightNumber(storedNotes)),
    paymentMethod: normalizeStoredPaymentMethod(booking),
    paymentPaid:
      String(booking?.payment_status || "").toLowerCase() === "paid" ||
      booking?.driver_reported_paid === true,
    paymentNote: String(booking?.driver_reported_payment_note || ""),
  };
}

export default function BookingEditDialog({ booking, drivers = [], open, api, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState(() => initialForm(booking));
  const [pricePreview, setPricePreview] = useState<any>(null);
  const [confirmPrice, setConfirmPrice] = useState(false);
  const [confirmProtected, setConfirmProtected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!booking || !open) return;
    setForm(initialForm(booking));
    setPricePreview(null);
    setConfirmPrice(false);
    setConfirmProtected(false);
    setError("");
  }, [booking, open]);

  if (!booking) return null;
  const protectedBooking = ["completed", "cancelled"].includes(booking.status);
  const completedBooking = booking.status === "completed";
  const editingCompletion = completedBooking || form.completeHistorical;
  const verifiedOnlinePayment =
    String(booking.payment_status || "").toLowerCase() === "paid";
  const change = (values: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...values }));
    setPricePreview(null);
    setConfirmPrice(false);
    setError("");
  };
  const payload = {
    ...(editingCompletion ? {completedTime: form.completedTime, completionDriverId: form.driverId, completeHistorical: form.completeHistorical} : {}),
    petDetails:form.petDetails,
    stop: form.stop,
    bookingId: booking.id,
    originalUpdatedAt: booking.updated_at,
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    customerEmail: form.customerEmail,
    pickupAddress: form.pickup.label,
    pickupLat: form.pickup.lat,
    pickupLng: form.pickup.lng,
    pickupPlaceId: form.pickup.id,
    pickupArea: form.pickup.components?.district || form.pickup.area,
    dropoffAddress: form.destination.label,
    dropoffLat: form.destination.lat,
    dropoffLng: form.destination.lng,
    dropoffPlaceId: form.destination.id,
    dropoffArea: form.destination.components?.district || form.destination.area,
    bookingDate: form.bookingDate,
    pickupTime: form.pickupTime,
    passengers: form.passengers,
    luggageCount: form.luggageCount,
    carType: form.carType,
    childSeats: form.childSeats,
    price: form.price,
    flightNumber: form.flightNumber,
    notes: form.notes,
    driverPaymentMethod: form.paymentMethod,
    driverPaymentPaid: form.paymentPaid,
    driverPaymentNote: form.paymentNote,
  };

  const save = async () => {
    if (protectedBooking && !confirmProtected) {
      setError("Bekräfta först att den avslutade eller avbokade bokningen får ändras.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!pricePreview) {
        const response = await api("/api/dispatch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "preview_booking_edit", booking: payload }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Ändringen kunde inte kontrolleras.");
        if (result.requiresPriceConfirmation) {
          setPricePreview(result);
          return;
        }
      }
      if (pricePreview?.requiresPriceConfirmation && !confirmPrice) {
        setError("Bekräfta det nya priset innan du sparar.");
        return;
      }
      const response = await api("/api/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_booking", booking: payload, confirmPriceChange: Boolean(confirmPrice), expectedNewPrice: pricePreview?.newPrice, confirmProtected: Boolean(confirmProtected) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Ändringen kunde inte sparas.");
      await onSaved();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ändringen kunde inte sparas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bookingEditDialog sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle><Pencil /> Redigera bokning #{booking.booking_number || booking.id}</DialogTitle>
          <DialogDescription>Bokningsnumret och den befintliga bokningen behålls.</DialogDescription>
        </DialogHeader>
        <div className="bookingEditScroll">
          <BookingTimeline key={booking.id} bookingId={booking.id} api={api} />
          {protectedBooking && <div className="protectedBookingWarning"><AlertTriangle /><div><b>{booking.status === "completed" ? "Avslutad bokning" : "Avbokad bokning"}</b><span>Kontrollera extra noga innan du ändrar historiska uppgifter.</span></div></div>}
          <div className="bookingEditGrid"><PetField value={form.petDetails} onChange={petDetails=>change({petDetails})}/>
            {!protectedBooking && <label className="wide"><span className="editPaymentCheckbox"><input type="checkbox" checked={form.completeHistorical} onChange={event => change({completeHistorical: event.target.checked})} /> Avsluta en tidigare utförd körning</span><small>Välj förare och faktiskt avslutsdatum. Körningen sparas som avslutad utan ny bokningsnotis eller kund-SMS.</small></label>}
            {editingCompletion && <label className="wide"><span>Förare som utförde körningen</span><select value={form.driverId} onChange={event => change({driverId: event.target.value})}><option value="">Välj förare</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name || driver.full_name}</option>)}</select></label>}
            <label><span>Kundens namn</span><input value={form.customerName} onChange={(event) => change({ customerName: event.target.value })} /></label>
            <label><span>Telefonnummer</span><input type="tel" value={form.customerPhone} onChange={(event) => change({ customerPhone: event.target.value })} /></label>
            <label className="wide"><span>E-post</span><input type="email" value={form.customerEmail} onChange={(event) => change({ customerEmail: event.target.value })} /></label>
            <BookingRouteFields pickup={form.pickup} destination={form.destination} stop={form.stop} onChange={change} />
            <label><span>Datum</span><input type="date" value={form.bookingDate} onChange={(event) => change({ bookingDate: event.target.value })} /></label>
            <label><span>Tid</span><input type="time" value={form.pickupTime} onChange={(event) => change({ pickupTime: event.target.value })} /></label>
            {editingCompletion && <label className="wide"><span>Avslutsdatum och tid (svensk tid)</span><input type="datetime-local" step="1" required value={form.completedTime} onChange={event => change({completedTime: event.target.value})} /><small>Rättar när resan avslutades. Priset ändras inte av denna rättelse.</small></label>}
            <label><span>Antal passagerare</span><select value={form.passengers} onChange={(event) => change({ passengers: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((number) => <option key={number} value={number}>{number}</option>)}</select></label>
            <label><span>Bagage</span><input type="number" min="0" max="30" value={form.luggageCount} onChange={(event) => change({ luggageCount: Number(event.target.value) })} /></label>
            <label><span>Biltyp</span><select value={form.carType} onChange={(event) => change({ carType: event.target.value })}><option value="standard">Vanlig bil</option><option value="large">Storbil</option></select></label>
            <label><span>Barnstol/tillval</span><select value={form.childSeats} onChange={(event) => change({ childSeats: Number(event.target.value) })}>{[0, 1, 2, 3].map((number) => <option key={number} value={number}>{number === 0 ? "Ingen barnstol" : `${number} barnstol${number > 1 ? "ar" : ""}`}</option>)}</select></label>
            <label className="editFlightField"><span><Plane /> Flygnummer</span><input value={form.flightNumber} onChange={(event) => change({ flightNumber: event.target.value.toUpperCase() })} placeholder="Till exempel SK431" autoComplete="off" /></label>
            <label className="editPriceField"><span>Pris inklusive moms</span><div><input type="number" min="0" step="1" value={form.price} onChange={(event) => change({ price: Number(event.target.value) })} /><small>kr</small></div></label>
            {<>
              <label className="editPaymentField"><span>Betalsätt</span><select value={form.paymentMethod} disabled={verifiedOnlinePayment} onChange={(event) => change({ paymentMethod: event.target.value })}>
                {verifiedOnlinePayment && <option value="app">Betald via appen</option>}
                {!verifiedOnlinePayment && <option value="">Inte registrerat</option>}
                <option value="card">Kort</option>
                <option value="swish">Swish</option>
                <option value="paypal">PayPal</option>
                <option value="link">Betallänk</option>
                <option value="cash">Kontant</option>
                <option value="invoice">Faktura</option>
                <option value="other">Annat</option>
              </select></label>
              <label className="editPaymentPaid"><span>Betalningsstatus</span><span className="editPaymentCheckbox"><input type="checkbox" checked={form.paymentPaid} disabled={verifiedOnlinePayment} onChange={(event) => change({ paymentPaid: event.target.checked })} /> Betalning mottagen</span></label>
              <label className="wide editPaymentNote"><span>Betalningsanteckning {form.paymentMethod === "other" ? "(obligatorisk)" : "(valfritt)"}</span><input value={form.paymentNote} onChange={(event) => change({ paymentNote: event.target.value })} placeholder={form.paymentMethod === "other" ? "Beskriv betalsättet" : "Till exempel referens eller kommentar"} /></label>
            </>}
            <label className="wide"><span>Meddelande/anteckning (visas på betald resas kvitto)</span><textarea rows={3} value={form.notes} onChange={(event) => change({ notes: event.target.value })} /></label>
          </div>
          {verifiedOnlinePayment && <div className="verifiedPaymentEdit"><b>Verifierad onlinebetalning</b><span>Betalsättet är låst som betald via appen och kan inte markeras som obetald här.</span></div>}
          {form.flightNumber && <div className="editFlightNotice"><Plane /><span><b>Flygbevakning kopplas till kunden</b><small>Flyget visas i kundens spårningslänk och uppdateras automatiskt med Swedavias liveinformation.</small></span></div>}
          {pricePreview?.requiresPriceConfirmation && <div className="priceChangeConfirmation" role="alert"><span>Nytt beräknat pris</span><strong>{pricePreview.newPrice} kr</strong><small>Tidigare pris: {pricePreview.currentPrice} kr</small><label><input type="checkbox" checked={confirmPrice} onChange={(event) => setConfirmPrice(event.target.checked)} />Jag bekräftar prisändringen</label></div>}
          {protectedBooking && <label className="protectedConfirmation"><input type="checkbox" checked={confirmProtected} onChange={(event) => setConfirmProtected(event.target.checked)} />Jag bekräftar att denna {booking.status === "completed" ? "avslutade" : "avbokade"} bokning ska redigeras</label>}
          {error && <div className="bookingEditError" role="alert">{error}</div>}
        </div>
        <DialogFooter>
          <button type="button" className="editCancelButton" onClick={() => onOpenChange(false)} disabled={saving}>Avbryt</button>
          <button type="button" className="editSaveButton" onClick={save} disabled={saving}>{saving ? "Sparar…" : pricePreview?.requiresPriceConfirmation ? "Bekräfta och spara" : "Spara ändringar"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
