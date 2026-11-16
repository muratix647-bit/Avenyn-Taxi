"use client";

import {AppText} from "@/components/app-language";
import PeriodPicker from "@/components/report-period";
import {monthPeriod} from "@/lib/report-period";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Search,
  WalletCards,
} from "lucide-react";
import CommissionBreakdown from "@/components/commission-breakdown";
import { authHeaders } from "@/lib/supabase-browser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const paymentLabels: Record<string, string> = {
  app: "Appbetalning",
  blipp: "Blipp",
  card: "Kort i bilen",
  swish: "Swish",
  paypal: "PayPal",
  cash: "Kontant",
  invoice: "Faktura",
  other: "Annat",
};

function stockholmDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function currentStockholmMonth() {
  return stockholmDateKey(new Date()).slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15, 12)));
}

function money(value: unknown) {
  return `${Number(value || 0).toLocaleString("sv-SE")} kr`;
}

function tripPaymentMethod(trip: any) {
  if (trip.street_payment) return trip.driver_reported_payment_method;
  if (trip.payment_status === "paid") return "app";
  return String(trip.driver_reported_payment_method || "other").toLowerCase();
}

export default function DriverHistory({ onChanged }: { onChanged?: () => void }) {
  const [month, setMonth] = useState(currentStockholmMonth());
  const [period,setPeriod]=useState(()=>monthPeriod());
  const [history, setHistory] = useState<any[]>([]);
  const [showDriverShare,setShowDriverShare]=useState(false);
  const [summary, setSummary] = useState<any>({});
  const [selectedDay, setSelectedDay] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("card");
  const [editPaid, setEditPaid] = useState(true);
  const [editNote, setEditNote] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSequence = useRef(0);
  const loadHistory = async () => {
    const sequence=++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const headers = (await authHeaders()) as Record<string, string>;
      const response = await fetch(
        `/api/driver-trips?scope=history&month=${encodeURIComponent(month)}&from=${period.from}&to=${period.to}`,
        { credentials: "same-origin", headers },
      );
      const payload: any = await response.json();
      if(sequence!==loadSequence.current)return;
      if (!response.ok) throw new Error(payload.error || "Körningarna kunde inte hämtas.");
      setHistory(payload.history || []);
      setSummary(payload.summary || {});setShowDriverShare(payload.showDriverShare===true);
    } catch (loadError: any) {
      if(sequence!==loadSequence.current)return;
      setHistory([]);setSummary({});
      setError(loadError?.message || "Körningarna kunde inte hämtas.");
    } finally {
      if(sequence===loadSequence.current)setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedDay("");
    loadHistory();
  }, [month,period.from,period.to]);

  const daily = useMemo(() => {
    const result: Record<string, { trips: number; amount: number }> = {};
    history.forEach((trip) => {
      const key = trip.completed_at
        ? stockholmDateKey(trip.completed_at)
        : String(trip.booking_date || "");
      result[key] ||= { trips: 0, amount: 0 };
      result[key].trips += 1;
      result[key].amount += Number(trip.price || 0);
    });
    return result;
  }, [history]);

  const calendar = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
    const leading = (firstDay + 6) % 7;
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return { leading, days };
  }, [month]);

  const visibleHistory = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("sv-SE");
    return history.filter((trip) => {
      const dayKey = trip.completed_at
        ? stockholmDateKey(trip.completed_at)
        : String(trip.booking_date || "");
      if (selectedDay && dayKey !== selectedDay) return false;
      if (!needle) return true;
      return [
        trip.booking_number,
        trip.pickup,
        trip.destination,
        trip.customer_name,
        trip.driver_reported_payment_note,
        paymentLabels[tripPaymentMethod(trip)],
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("sv-SE").includes(needle));
    });
  }, [history, query, selectedDay]);

  const paymentTotals = useMemo(() => {
    const totals: Record<string, { trips: number; amount: number }> = {};
    history.forEach((trip) => {
      const method = tripPaymentMethod(trip);
      totals[method] ||= { trips: 0, amount: 0 };
      totals[method].trips += 1;
      totals[method].amount += Number(trip.price || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1].amount - a[1].amount);
  }, [history]);

  const openEdit = (trip: any) => {
    if (trip.payment_status === "paid") return;
    const method = tripPaymentMethod(trip);
    setEditing(trip);
    setEditAmount(String(trip.price ?? ""));
    setEditMethod(paymentLabels[method] ? method : "other");
    setEditPaid(trip.driver_reported_paid === true);
    setEditNote(String(trip.driver_reported_payment_note || ""));
    setEditReason("");
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const amount = Number(editAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return setEditError("Ange ett giltigt belopp.");
    if (editMethod === "other" && !editNote.trim())
      return setEditError("Beskriv det andra betalsättet.");
    if (editReason.trim().length < 3)
      return setEditError("Skriv kort varför uppgifterna ändras.");
    setSaving(true);
    setEditError("");
    try {
      const headers = (await authHeaders()) as Record<string, string>;
      const response = await fetch("/api/driver-trips", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          action: "edit_accounting",
          bookingId: editing.id,
          amount,
          paymentMethod: editMethod,
          paid: editPaid,
          paymentNote: editNote,
          reason: editReason,
        }),
      });
      const payload: any = await response.json();
      if (!response.ok) throw new Error(payload.error || "Ändringen kunde inte sparas.");
      setEditing(null);
      setNotice(`Bokning #${editing.booking_number || editing.id} har rättats.`);
      await loadHistory();
      onChanged?.();
    } catch (saveError: any) {
      setEditError(saveError?.message || "Ändringen kunde inte sparas.");
    } finally {
      setSaving(false);
    }
  };

  const collectedByDriver = Math.max(
    0,
    Number(summary.paid || 0) - Number(summary.appPaid || 0) - Number(summary.blippPaid || 0),
  );

  return (
    <section className="driverLedger" aria-labelledby="driver-ledger-title">
      <div className="driverLedgerTitle">
        <div>
          
          <h1 id="driver-ledger-title"><AppText text={"Historik"} /></h1>
          
        </div>
        <p className="driverPeriodCaption">{<AppText text={period.from} />} – {<AppText text={period.to} />}</p>
      </div>


      <button type="button" className="driverClearDay" onClick={loadHistory} disabled={loading}>{<AppText text={loading ? "Hämtar…" : "Uppdatera historik"} />}</button>
      {error && <div className="driverLedgerError">{<AppText text={error} />}</div>}
      {notice && (
        <div className="driverLedgerNotice" role="status">
          <CheckCircle2 /> {<AppText text={notice} />}
        </div>
      )}

      <details className="driverOptional"><summary><AppText text={"Inkört och betalningar"} /></summary>
      <div className="driverLedgerStats">
        <article>
          <CalendarDays />
          <span><AppText text={"Körningar"} /></span>
          <b>{<AppText text={Number(summary.trips || 0)} />}</b>
        </article>
        <article>
          <WalletCards />
          <span><AppText text={"Inkört totalt"} /></span>
          <b>{<AppText text={money(summary.revenue)} />}</b>
        </article>
        <article className="received">
          <CheckCircle2 />
          <span><AppText text={"Mottaget i bilen"} /></span>
          <b>{<AppText text={money(collectedByDriver)} />}</b>
        </article>
        <article>
          <CreditCard />
          <span><AppText text={"Betalt via app"} /></span>
          <b>{<AppText text={money(summary.appPaid)} />}</b>
        </article>
        <article><CreditCard /><span><AppText text={"Blipp"} /></span><b>{<AppText text={money(summary.blippPaid)} />}</b></article>
        <article className="unpaid">
          <WalletCards />
          <span><AppText text={"Ej markerat betalt"} /></span>
          <b>{<AppText text={money(summary.unpaid)} />}</b>
        </article>
      </div>

      </details>
      <details className="driverCalendarCard driverCalendarCollapsible">
        <summary><CalendarDays /><span><AppText text={"Kalender och datum"} /></span><small><AppText text={"Öppna / stäng"} /></small></summary>
        <PeriodPicker value={period} onChange={p=>{setPeriod(p);setMonth(p.from.slice(0,7));}}/>
      <div className="driverMonthSwitcher">
        <button type="button" aria-label="Föregående månad" onClick={() => (setMonth(shiftMonth(month, -1)),setPeriod(monthPeriod(shiftMonth(month,-1))))}>
          <ChevronLeft />
        </button>
        <b>{<AppText text={monthLabel(month)} />}</b>
        <button type="button" aria-label="Nästa månad" onClick={() => (setMonth(shiftMonth(month, 1)),setPeriod(monthPeriod(shiftMonth(month,1))))}>
          <ChevronRight />
        </button>
      </div>

        <div className="driverCalendarHead">
          <div>
            <CalendarDays />
            <b><AppText text={"Kalender"} /></b>
          </div>
          {selectedDay && (
            <button type="button" onClick={() => setSelectedDay("")}><AppText text={"Visa hela perioden"} /></button>
          )}
        </div>
        <div className="driverCalendarWeekdays" aria-hidden="true">
          {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day) => <span key={day}>{<AppText text={day} />}</span>)}
        </div>
        <div className="driverCalendarGrid">
          {Array.from({ length: calendar.leading }).map((_, index) => <i key={`empty-${index}`} />)}
          {Array.from({ length: calendar.days }).map((_, index) => {
            const day = index + 1;
            const key = `${month}-${String(day).padStart(2, "0")}`;
            const report = daily[key];
            return (
              <button
                type="button"
                key={key}
                className={`${report ? "hasTrips" : ""} ${selectedDay === key ? "selected" : ""}`}
                onClick={() => setSelectedDay(selectedDay === key ? "" : key)}
              >
                <span>{<AppText text={day} />}</span>
                {report && <small>{<AppText text={report.trips} />} · {<AppText text={Number(report.amount).toLocaleString("sv-SE")} />} <AppText text={"kr"} /></small>}
              </button>
            );
          })}
        </div>
      </details>
      {selectedDay && <button className="driverClearDay" type="button" onClick={()=>setSelectedDay("")}><AppText text={"Visar"} />{<AppText text={selectedDay} />} <AppText text={"· Visa hela perioden"} /></button>}

      <details className="driverOptional"><summary><AppText text={"Redovisning och moms"} /></summary>
      {paymentTotals.length > 0 && (
        <div className="driverPaymentBreakdown">
          <h2><AppText text={"Betalsätt under perioden"} /></h2>
          <div>
            {paymentTotals.map(([method, total]) => (
              <span key={method}>
                <b>{<AppText text={paymentLabels[method] || "Annat"} />}</b>
                <small>{<AppText text={total.trips} />} <AppText text={"poster"} /></small>
                <strong>{<AppText text={money(total.amount)} />}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <CommissionBreakdown driver showDriverShare={showDriverShare} title={selectedDay ? "Vald dag · inkört och moms" : "Valt urval · inkört och moms"} amounts={visibleHistory.map((trip:any)=>trip.price)}/>
      </details>
      <label className="driverHistorySearch">
        <Search />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök körning eller betalning"
        />
      </label>

      <div className="driverLedgerList">
        <div className="driverLedgerListHead">
          <h2>{<AppText text={selectedDay ? `Körningar ${selectedDay}` : "Körningar"} />}</h2>
          <span>{<AppText text={visibleHistory.length} />} <AppText text={"st"} /></span>
        </div>
        {loading ? (
          <div className="driverLedgerEmpty"><AppText text={"Hämtar körningar…"} /></div>
        ) : visibleHistory.length === 0 ? (
          <div className="driverLedgerEmpty"><AppText text={"Inga körningar hittades för valet."} /></div>
        ) : (
          visibleHistory.map((trip) => {
            const method = tripPaymentMethod(trip);
            const locked = trip.payment_status === "paid";
            return (
              <article className="driverLedgerRow" key={trip.id}>
                <div className="driverLedgerRowTop">
                  <div>
                    <small>{<AppText text={trip.completed_at ? new Date(trip.completed_at).toLocaleString("sv-SE") : trip.booking_date} />}</small>
                    <b>{<AppText text={trip.street_payment ? `Betalning · ${trip.booking_number}` : `#${trip.booking_number || trip.id}`} />}</b>
                  </div>
                  <strong>{<AppText text={money(trip.price)} />}</strong>
                </div>
                <p><span>{trip.pickup}</span><i>→</i><span>{trip.destination}</span></p>
                <div className="driverLedgerPayment">
                  <span className={trip.driver_reported_paid === true || locked ? "paid" : "unpaid"}>
                    {<AppText text={trip.driver_reported_paid === true || locked ? "Betald" : "Ej betald"} />}
                  </span>
                  <span>{<AppText text={paymentLabels[method] || "Annat"} />}</span>
                  {trip.customer_name && <span>{trip.customer_name}</span>}
                </div>
                <button
                  type="button"
                  className="driverLedgerEdit"
                  disabled={locked}
                  onClick={() => openEdit(trip)}
                >
                  <Pencil /> {<AppText text={locked ? "Bekräftad betalning" : "Rätta uppgifter"} />}
                </button>
              </article>
            );
          })
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent overlayClassName="driverPaymentOverlay" className="driverCompletionDialog driverEditDialog">
          <DialogHeader>
            <DialogTitle><AppText text={"Rätta körningen"} /></DialogTitle>
            <DialogDescription>
              <AppText text={"Ändringen sparas i en historik så att både det gamla och det nya värdet kan kontrolleras."} /></DialogDescription>
          </DialogHeader>
          <div className="driverCompletionFields">
            <label>
              <span><AppText text={"Belopp (kr)"} /></span>
              <input type="number" inputMode="decimal" min="0" max="100000" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} />
            </label>
            <label>
              <span><AppText text={"Betalsätt"} /></span>
              <select value={editMethod} onChange={(event) => setEditMethod(event.target.value)}>
                <option value="card"><AppText text={"Kort i bilen"} /></option>
                <option value="blipp"><AppText text={"Blipp"} /></option>
                <option value="swish"><AppText text={"Swish"} /></option>
                <option value="paypal"><AppText text={"PayPal"} /></option>
                <option value="cash"><AppText text={"Kontant"} /></option>
                <option value="invoice"><AppText text={"Faktura"} /></option>
                <option value="other"><AppText text={"Annat"} /></option>
              </select>
            </label>
            <label className="driverCompletionPaid">
              <input type="checkbox" checked={editPaid} onChange={(event) => setEditPaid(event.target.checked)} />
              <span><AppText text={"Betalningen är mottagen"} /></span>
            </label>
            {editMethod === "other" && (
              <label>
                <span><AppText text={"Beskriv betalsättet"} /></span>
                <input maxLength={200} value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="Exempel: hotellvoucher" />
              </label>
            )}
            <label>
              <span><AppText text={"Orsak till rättelsen"} /></span>
              <textarea maxLength={300} value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Exempel: skrev 505 kr men kunden betalade 550 kr" />
            </label>
          </div>
          {editError && <div className="driverCompletionError" role="alert">{<AppText text={editError} />}</div>}
          <DialogFooter>
            <button type="button" className="driverGpsDisclosureCancel" disabled={saving} onClick={() => setEditing(null)}><AppText text={"Avbryt"} /></button>
            <button type="button" className="driverGpsDisclosureAccept" disabled={saving} onClick={saveEdit}>{<AppText text={saving ? "Sparar…" : "Spara rättelse"} />}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
