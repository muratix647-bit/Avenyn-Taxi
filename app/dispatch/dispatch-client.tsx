"use client";
import {petText} from '@/lib/pets';
import PetOptionsAdmin from '@/components/pet-options-admin';
import EconomyPanel from "@/components/economy-panel";
import BusinessBilling from "@/components/business-billing";
import StreetPayments from "@/components/street-payments";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRightLeft,
  Archive,
  BarChart3,
  Banknote,
  CarFront,
  Clock3,
  CreditCard,
  History,
  LayoutDashboard,
  MailPlus,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Plus,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import DispatchLiveMap from "@/components/dispatch-live-map";
import DispatchAcceptanceNotice from "@/components/dispatch-acceptance-notice";
import BookingTimeline from "@/components/booking-timeline";
import BookingEditDialog from "@/components/booking-edit-dialog";
import ManualBookingDialog from "@/components/manual-booking-dialog";
import DriverEditorDialog from "@/components/driver-editor-dialog";
import PartnerAdmin from "@/components/partner-admin";
import PeriodPicker from "@/components/report-period";
import {isOwnCompany,monthPeriod,stockholmDay} from "@/lib/report-period";
import DynamicPriceAdmin from "@/components/dynamic-price-admin";
import DelegatePartner from "@/components/delegate-partner";
import CommissionBreakdown from "@/components/commission-breakdown";
import PartnerCommissionAdmin from "@/components/partner-commission-admin";
import PriceAdmin from "@/components/price-admin";
import BookingAlert from "@/components/booking-alert";
import PrebookingWatch from "@/components/prebooking-watch";
import DispatchFlightTest from "@/components/dispatch-flight-test";
import SupabaseLogin from "@/components/supabase-login";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AppChat from "@/components/app-chat";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
import { authHeaders } from "@/lib/supabase-browser";
const labels: Record<string, string> = {
  new: "Ny",
  scheduled: "Förbokad",
  offered: "Erbjuden",
  assigned: "Tilldelad",
  accepted: "Accepterad",
  en_route: "På väg",
  arrived: "Framme",
  passenger_onboard: "Kund i bilen",
  completed: "Avslutad",
  cancelled: "Avbokad",
};
const driverLabels: Record<string, string> = {
  available: "Tillgänglig",
  busy: "Upptagen",
  paused: "Pausad",
  offline: "Offline",
};

type BookingTone = "unassigned" | "assigned" | "active" | "completed" | "cancelled";

function bookingTone(booking: any): BookingTone {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "completed") return "completed";
  if (["en_route", "arrived", "passenger_onboard"].includes(booking.status))
    return "active";
  return booking.assigned_driver_id ? "assigned" : "unassigned";
}

function driverNameFor(booking: any, drivers: any[]) {
  return (
    booking.driver_name ||
    drivers.find((driver: any) => driver.id === booking.assigned_driver_id)?.name ||
    ""
  );
}

function bookingPriority(booking: any) {
  if (booking.status === "new" && !booking.assigned_driver_id) return 0;
  if (!booking.assigned_driver_id) return 1;
  return 2;
}

type PaymentTone = "paid" | "pending" | "refunded" | "unpaid";

function paymentTone(booking: any): PaymentTone {
  const bookingStatus = String(booking?.payment_status || "").toLowerCase();
  const requestStatus = String(
    booking?.latest_payment_request?.status || "",
  ).toLowerCase();
  if (bookingStatus === "refunded" || requestStatus === "refunded")
    return "refunded";
  if (bookingStatus === "paid" || requestStatus === "paid") return "paid";
  if (["creating", "pending"].includes(requestStatus)) return "pending";
  return "unpaid";
}

function paymentLabel(booking: any) {
  const tone = paymentTone(booking);
  if (tone === "paid") return "Betald via appen";
  if (tone === "pending") return "Väntar på betalning";
  if (tone === "refunded") return "Återbetald";
  return "Ej betald";
}

function PaymentBadge({ booking }: { booking: any }) {
  const tone = paymentTone(booking);
  return (
    <span className={`dispatchPaymentBadge dispatchPaymentBadge--${tone}`}>
      <CreditCard />
      {paymentLabel(booking)}
    </span>
  );
}

const reportedPaymentLabels: Record<string, string> = {
  app: "Betald via appen",
  card: "Kort i bilen",
  swish: "Swish",
  paypal: "PayPal",
  cash: "Kontant",
  invoice: "Faktura",
  other: "Annat",
};

function reportedPaymentLabel(booking: any) {
  const method = String(booking?.driver_reported_payment_method || "");
  if (method === "other" && booking?.payment_method === "Betallänk") return "Betallänk";
  if (method) return reportedPaymentLabels[method] || method;
  if (paymentTone(booking) === "paid") return booking.payment_method || "Betald via appen";
  return "Inte registrerat";
}

function tripDurationLabel(booking: any) {
  if (!booking?.picked_up_at || !booking?.completed_at) return "Tid saknas";
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(booking.completed_at).getTime() -
        new Date(booking.picked_up_at).getTime()) /
        60000,
    ),
  );
  return `${minutes} min`;
}
const emptyDispatchData = {
  bookings: [],
  drivers: [],
  vehicles: [],
  archivedBookings: [],
  archivedDrivers: [],
  fareSettings: {},
  fixedPrices: [],
  siteVisits: {},
  warnings: {},
};

function objectRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, any> =>
          Boolean(row) && typeof row === "object",
      )
    : [];
}

function mergeDriverPosition(driver: any, position: any) {
  if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng) ||
      !(Date.parse(position.updated_at) > (Date.parse(driver.updated_at) || 0))) return driver;
  return { ...driver, lat: position.lat, lng: position.lng, heading: position.heading, updated_at: position.updated_at };
}

function normalizeDispatchData(value: any) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...emptyDispatchData,
    ...source,
    bookings: objectRows(source.bookings),
    drivers: objectRows(source.drivers),
    vehicles: objectRows(source.vehicles),
    archivedBookings: objectRows(source.archivedBookings),
    archivedDrivers: objectRows(source.archivedDrivers),
    fixedPrices: objectRows(source.fixedPrices),
    siteVisits: source.siteVisits && typeof source.siteVisits === "object" ? source.siteVisits : {},
    fareSettings:
      source.fareSettings && typeof source.fareSettings === "object"
        ? source.fareSettings
        : {},
    warnings:
      source.warnings && typeof source.warnings === "object"
        ? source.warnings
        : {},
  };
}
export default function DispatchClient() {
  const {
    client,
    session,
    loading,
    error: authError,
    setError: setAuthError,
  } = useSupabaseSession("dispatch");
  const [d, setD] = useState<any>(emptyDispatchData),
    [error, setError] = useState(""),
    [tab, setTab] = useState<
      | "overview"
      | "bookings"
      | "economy"
      | "businessBilling"
      | "payments"
      | "drivers"
      | "driverTrips"
      | "map"
      | "vehicles"
      | "prices"
      | "partners"
      | "customers"
      | "history"
      | "trash"
      | "statistics"
      | "settings"
    >("overview"),
    [view, setView] = useState<"active" | "archive">("active"),
    [statusFilter, setStatusFilter] = useState("all"),
    [paymentFilter, setPaymentFilter] = useState<PaymentTone | "all">("all");
  const [economyAdminUser, setEconomyAdminUser] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setEconomyAdminUser(null);
    if (client && session?.user.id) {
      const userId = session.user.id;
      Promise.all([client.rpc("is_admin"), client.rpc("is_dispatch_admin")])
        .then(results => {
          if (active && results.some(result => !result.error && result.data === true)) setEconomyAdminUser(userId);
        }).catch(() => { if (active) setEconomyAdminUser(null); });
    }
    return () => { active = false; };
  }, [client, session?.access_token, session?.user.id]);
  const canViewEconomy = !!session && economyAdminUser === session.user.id;
  const [partnerDriverLinks,setPartnerDriverLinks]=useState<any[]>([]);
  const [partnerChoices,setPartnerChoices]=useState<any[]>([]);
  useEffect(()=>{if(!session?.access_token)return;let active=true;fetch("/api/partners/resources",{headers:{Authorization:`Bearer ${session.access_token}`}}).then(r=>r.json()).then((j:any)=>{if(active){setPartnerChoices(j.partners||[]);setPartnerDriverLinks(j.driver_links||[])}}).catch(()=>{});return()=>{active=false};},[session?.access_token]);
  const [invoiceBookingId,setInvoiceBookingId]=useState('');
  const [driverReportId, setDriverReportId] = useState("all");
  const [reportPeriod,setReportPeriod]=useState(()=>monthPeriod());
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [manualBookingOpen,setManualBookingOpen]=useState(false);
  const [manualBookingSeed,setManualBookingSeed]=useState<any|null>(null);
  const [driverEditorOpen, setDriverEditorOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<any | null>(null);
  const [driverTripToArchive, setDriverTripToArchive] = useState<any | null>(null);
  const [bookingToPermanentlyDelete,setBookingToPermanentlyDelete] = useState<any|null>(null);
  const [permanentDeleteBusy,setPermanentDeleteBusy] = useState(false);
  const [permanentDeleteError,setPermanentDeleteError] = useState("");
  const [bookingToArchive, setBookingToArchive] = useState<any | null>(null);
  const [vehicleToArchive, setVehicleToArchive] = useState<any | null>(null);
  const [driverNotice, setDriverNotice] = useState("");
  const [driverInviteNotices, setDriverInviteNotices] = useState<
    Record<string, { message: string; tone: "loading" | "success" | "error" }>
  >({});
  const [smsNotice,setSmsNotice]=useState("");
  const [vehicleNotice, setVehicleNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<any>({
    vehicleNumber: "",
    registrationNumber: "",
    make: "",
    model: "",
    color: "",
    passengerCapacity: 4,
    vehicleClass: "Standard",
    active: true,
    driverId: "",
  });
  const api = async (url: string, init: RequestInit = {}) => {
    const send = async (accessSession: typeof session) =>
      fetch(url, {
        ...init,
        credentials: "same-origin",
        headers: {
          ...((init.headers || {}) as Record<string, string>),
          ...((await authHeaders(accessSession)) as Record<string, string>),
        },
      });
    const activeSession = client
      ? (await client.auth.getSession()).data.session
      : session;
    const response = await send(activeSession);
    if (response.status !== 401 || !client) return response;

    const { data, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !data.session) return response;
    return send(data.session);
  };
  const loadInFlight = useRef(false);
  const loadQueued = useRef(false);
  const load = async (showProgress = false) => {
    if(loadInFlight.current){loadQueued.current=true;return;}
    loadInFlight.current=true;
    if (showProgress) setRefreshing(true);
    try {
      const response = await api(`/api/dispatch?refresh=${Date.now()}`);
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Trafikledningen kunde inte hämtas.");
        return;
      }
      setD((current: any) => {
        const next = normalizeDispatchData(payload);
        const previous = new Map(objectRows(current?.drivers).map(driver => [driver.id, driver]));
        next.drivers = next.drivers.map(driver => mergeDriverPosition(driver, previous.get(driver.id)));
        return next;
      });
      setError("");
    } catch {
      setError("Trafikledningen kunde inte hämtas. Försök igen.");
    } finally {
      if (showProgress) setRefreshing(false);
      loadInFlight.current=false;
      if(loadQueued.current){loadQueued.current=false;void load();}
    }
  };
  useEffect(() => {
    if (!session || !client) return;
    load();
    let stopped = false;
    let positionRequest: AbortController | null = null;
    const applyLocations = (locations: any[]) => {
      if (stopped) return;
      const positions = new Map(locations.map(location => [location.driver_id, {
        lat: Number(location.latitude), lng: Number(location.longitude),
        heading: Number(location.heading || 0), updated_at: location.updated_at,
      }]));
      setD((current: any) => ({ ...current, drivers: objectRows(current?.drivers)
        .map(driver => mergeDriverPosition(driver, positions.get(driver.id))) }));
    };
    const loadPositions = async () => {
      if (stopped || document.hidden || positionRequest) return;
      const controller = new AbortController();
      positionRequest = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await api('/api/dispatch-locations', { signal: controller.signal, cache: 'no-store' });
        if (response.ok) applyLocations(objectRows((await response.json()).locations));
      } catch { /* Keep the last position; retry on the next tick. */ }
      finally { window.clearTimeout(timeout); positionRequest = null; }
    };
    void loadPositions();
    const positionTimer = window.setInterval(loadPositions, 1000);
    document.addEventListener('visibilitychange', loadPositions);
    const channel = client
      .channel("dispatch:queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload: any) => {
          const location = payload?.new;
          if (!location?.driver_id) return;
          applyLocations([location]);
        },
      )
      .subscribe();
    const t = setInterval(load, 30000);
    return () => {
      stopped = true;
      window.clearInterval(positionTimer);
      document.removeEventListener('visibilitychange', loadPositions);
      positionRequest?.abort();
      clearInterval(t);
      client.removeChannel(channel);
    };
  }, [session, client]);
  const pendingActions = useRef(new Set<string>());
  const [actionNotice, setActionNotice] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const act = async (body: any) => {
    const key = JSON.stringify(body);
    if (pendingActions.current.has(key)) return {ok:false,error:"Ändringen behandlas redan."};
    pendingActions.current.add(key);
    setActionNotice("");
    try {
      const r = await api("/api/dispatch", {method:"POST",headers:{"content-type":"application/json"},body:key});
      const j: any = await r.json();
      if (!r.ok || j.ok === false) {
        const message = j.error || "Ändringen kunde inte sparas.";
        setError(message);
        return {...j,ok:false,error:message};
      }
      await load();
      setActionNotice(j.message || (body.action.startsWith("restore") ? "Återställt." : /archive|delete/.test(body.action) ? "Borttagningen är sparad." : "Ändringen är sparad."));
      return j;
    } catch {
      const message = "Kunde inte kontakta servern. Kontrollera anslutningen och försök igen.";
      setError(message);
      return {ok:false,error:message};
    } finally { pendingActions.current.delete(key); }
  };
  const paymentSmsButton = (b:any) => {
    if (b.driver_reported_paid || ['paid','refunded'].includes(b.payment_status) || b.archived_at || b.status==='cancelled') return null;
    const amount = Number(b.driver_reported_amount ?? b.actual_price ?? b.fixed_price);
    if (!Number.isFinite(amount) || amount<3) return null;
    return <><button type="button" className="sendBookingSmsButton" onClick={async()=>{
      try {
        const response = await api('/api/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'copy_payment_link',bookingId:b.id,amount})});
        const result = await response.json();
        if (!response.ok || !result.url) throw Error(result.error || 'Betallänken kunde inte hämtas.');
        try {
          await navigator.clipboard.writeText(result.url);
          setActionNotice('Betallänken är kopierad. Klistra in den i ditt SMS.');
        } catch {
          window.prompt('Kopiera betallänken och klistra in den i ditt SMS.',result.url);
        }
      } catch(error) {
        setError(error instanceof Error ? error.message : 'Betallänken kunde inte hämtas.');
      }
    }}>Kopiera betallänk</button>{b.customer_phone && <button type="button" className="sendBookingSmsButton" onClick={()=>{
      if(window.confirm(`Skicka en betallänk för bokning #${b.booking_number ?? b.number ?? ''}?\nBelopp: ${amount.toLocaleString('sv-SE')} kr\nMobilnummer: ${b.customer_phone}`))
        void act({action:'send_payment_sms',bookingId:b.id,phone:b.customer_phone,amount});
    }}><MessageCircle/> Skicka betallänk via SMS</button>}</>;
  };
  const archiveItem = async (body:any, close:()=>void) => {
    setArchiveBusy(true); setArchiveError("");
    const result = await act(body);
    setArchiveBusy(false);
    if(result?.ok) close(); else setArchiveError(result?.error || "Kunde inte radera.");
  };
  const openNewBooking = () => {
    setManualBookingSeed(null);
    setManualBookingOpen(true);
  };
  const openReturnTrip = (booking: any) => {
    setManualBookingSeed(booking);
    setManualBookingOpen(true);
  };
  const inviteDriver = async (driver: any, delivery: "email" | "sms") => {
    const destination = delivery === "sms" ? driver.phone : driver.email;
    const channelName = delivery === "sms" ? "SMS" : "e-post";
    setDriverInviteNotices((current) => ({
      ...current,
      [driver.id]: {
        message: `Skickar via ${channelName} till ${destination || "föraren"}…`,
        tone: "loading",
      },
    }));
    try {
      const result = await act({
        action: delivery === "sms" ? "invite_driver_sms" : "invite_driver",
        driverId: driver.id,
      });
      setDriverInviteNotices((current) => ({
        ...current,
        [driver.id]: result?.ok
          ? {
              message:
                delivery === "sms"
                  ? `SMS med Förarapp och lösenordslänk skickat till ${driver.phone}.`
                  : `Inbjudan skickad till ${driver.email}. Föraren kan nu välja sitt lösenord.`,
              tone: "success",
            }
          : {
              message: result?.error || "Inbjudan kunde inte skickas.",
              tone: "error",
            },
      }));
    } catch {
      setDriverInviteNotices((current) => ({
        ...current,
        [driver.id]: {
          message:
            "Inbjudan kunde inte skickas. Kontrollera anslutningen och försök igen.",
          tone: "error",
        },
      }));
    }
  };
  const editVehicle = (vehicle: any) => {
    setVehicleForm({
      id: vehicle.id,
      vehicleNumber: vehicle.vehicle_number || vehicle.name || "",
      registrationNumber: vehicle.registration_number || vehicle.reg || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      color: vehicle.color || "",
      passengerCapacity: vehicle.passenger_capacity || 4,
      vehicleClass: vehicle.vehicle_class || "Standard",
      active: vehicle.active !== false,
      driverId: vehicle.driver_id || "",
    });
    setVehicleNotice("");
    window.setTimeout(() => {
      document
        .getElementById("vehicle-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };
  const saveVehicle = async () => {
    const result = await act({ action: "save_vehicle", vehicle: vehicleForm });
    if (result?.ok) {
      setVehicleNotice(
        vehicleForm.id ? "Bilen har uppdaterats." : "Bilen har lagts till.",
      );
      setVehicleForm({
        vehicleNumber: "",
        registrationNumber: "",
        make: "",
        model: "",
        color: "",
        passengerCapacity: 4,
        vehicleClass: "Standard",
        active: true,
        driverId: "",
      });
    }
  };
  if (loading)
    return (
      <main className="portal">
        <section className="portalcard">
          <p>Öppnar trafikledningen…</p>
        </section>
      </main>
    );
  if (!session && client)
    return (
      <SupabaseLogin
        client={client}
        title="Admin / Dispatch"
        error={authError}
        setError={setAuthError}
      />
    );
  if (!session || !client)
    return (
      <main className="portal">
        <section className="portalcard">
          <div className="notice">
            {authError || "Inloggningen kunde inte öppnas."}
          </div>
          <button type="button" onClick={() => window.location.reload()}>
            Försök igen
          </button>
        </section>
      </main>
    );
  const inactiveBookings = d.bookings.filter((b:any)=>["completed","cancelled"].includes(b.status)).sort((a:any,b:any)=>String(b.completed_at||b.updated_at||b.pickup_time||"").localeCompare(String(a.completed_at||a.updated_at||a.pickup_time||"")));
  const rows = d.bookings.filter((b:any)=>!["completed","cancelled"].includes(b.status));
  const filteredBookings =
    statusFilter === "all"
      ? rows
      : rows.filter((x: any) => x.status === statusFilter);
  const shownBookings =
    filteredBookings
          .map((booking: any, index: number) => ({ booking, index }))
          .sort(
            (a: any, b: any) =>
              bookingPriority(a.booking) - bookingPriority(b.booking) ||
              a.index - b.index,
          )
          .map(({ booking }: any) => booking);
  const active = d.bookings.filter(
    (x: any) => !["completed", "cancelled"].includes(x.status),
  );
  const onlineDrivers = d.drivers.filter((x: any) => x?.online);
  // Keep every saved driver position on the map. A driver going offline (or a
  // locked phone temporarily pausing live updates) must not remove the car;
  // Dispatch should continue to see its latest known position and timestamp.
  const trackedDrivers = d.drivers.filter(
    (x: any) =>
      x?.lat !== null &&
      x?.lat !== undefined &&
      x?.lat !== "" &&
      x?.lng !== null &&
      x?.lng !== undefined &&
      x?.lng !== "" &&
      Number.isFinite(Number(x?.lat)) &&
      Number.isFinite(Number(x?.lng)),
  );
  const onlineTrackedDrivers = trackedDrivers.filter((x: any) => x?.online);
  const allBookings = d.bookings;
  const paymentBookings = [...allBookings].sort((a: any, b: any) =>
    String(b.created_at || b.pickup_time || "").localeCompare(
      String(a.created_at || a.pickup_time || ""),
    ),
  );
  const shownPaymentBookings =
    paymentFilter === "all"
      ? paymentBookings
      : paymentBookings.filter(
          (booking: any) => paymentTone(booking) === paymentFilter,
        );
  const paidBookings = paymentBookings.filter(
    (booking: any) => paymentTone(booking) === "paid",
  );
  const paidTotal = paidBookings.reduce(
    (sum: number, booking: any) => sum + Number(booking.price || 0),
    0,
  );
  const completed = allBookings.filter((x: any) => x.status === "completed");
  const now = new Date(),
    today = now.toISOString().slice(0, 10),
    month = today.slice(0, 7),
    weekStart = new Date(now.getTime() - 6 * 86400000)
      .toISOString()
      .slice(0, 10);
  const todayTrips = allBookings.filter(
    (x: any) => String(x.booking_date || x.pickup_time).slice(0, 10) === today,
  );
  const weekTrips = allBookings.filter((x: any) => {
    const date = String(x.booking_date || x.pickup_time).slice(0, 10);
    return date >= weekStart && date <= today;
  });
  const monthTrips = allBookings.filter(
    (x: any) => String(x.booking_date || x.pickup_time).slice(0, 7) === month,
  );
  const revenue = todayTrips
    .filter((x: any) => x.status === "completed")
    .reduce((sum: number, x: any) => sum + Number(x.price || 0), 0);
  const monthRevenue = monthTrips
    .filter((x: any) => x.status === "completed")
    .reduce((sum: number, x: any) => sum + Number(x.price || 0), 0);
  const driverPerformance = d.drivers
    .map((driver: any) => {
      const trips = completed.filter(
        (booking: any) => booking.assigned_driver_id === driver.id,
      );
      return {
        name: driver.name,
        trips: trips.length,
        revenue: trips.reduce(
          (sum: number, booking: any) => sum + Number(booking.price || 0),
          0,
        ),
      };
    })
    .sort((a: any, b: any) => b.revenue - a.revenue);
  const driverReportBookings = completed
    .filter((booking: any) => {
      if (
        driverReportId !== "all" &&
        booking.assigned_driver_id !== driverReportId
      )
        return false;
      const date = booking.completed_at ? stockholmDay(booking.completed_at) : String(booking.booking_date || booking.pickup_time || '').slice(0,10);
      return date>=reportPeriod.from && date<=reportPeriod.to;
    })
    .sort((a: any, b: any) =>
      String(b.completed_at || b.pickup_time || "").localeCompare(
        String(a.completed_at || a.pickup_time || ""),
      ),
    );
  const driverReportTotal = driverReportBookings.reduce(
    (sum: number, booking: any) => sum + Number(booking.price || 0),
    0,
  );
  const driverReportPaid = driverReportBookings.filter(
    (booking: any) =>
      booking.driver_reported_paid === true || paymentTone(booking) === "paid",
  );
  const driverReportGroups = d.drivers
    .map((driver: any) => {
      const trips = driverReportBookings.filter(
        (booking: any) => booking.assigned_driver_id === driver.id,
      );
      return {
        id: driver.id,
        name: driver.name,
        trips: trips.length,
        revenue: trips.reduce(
          (sum: number, booking: any) => sum + Number(booking.price || 0),
          0,
        ),
      };
    })
    .filter((driver: any) => driver.trips > 0 || driverReportId === driver.id)
    .sort((a: any, b: any) => b.revenue - a.revenue);
  const menuGroups: {label:string; icon:typeof LayoutDashboard; items:{tab:typeof tab;label:string}[]}[] = [
    {label:"Översikt",icon:LayoutDashboard,items:[{tab:"overview",label:"Översikt"}]},
    {label:"Bokningar",icon:Activity,items:[{tab:"bookings",label:"Aktiva och kommande"},{tab:"history",label:"Avslutade / avbokade"}]},
    {label:"Trafikledning",icon:MapIcon,items:[{tab:"map",label:"Karta"},{tab:"drivers",label:"Förare"},{tab:"vehicles",label:"Fordon"}]},
    {label:"Ekonomi",icon:Banknote,items:[...(canViewEconomy ? [{tab:"economy" as const,label:"Ekonomirapporter"}] : []),{tab:"businessBilling",label:"Kundfakturor"},{tab:"driverTrips",label:"Förarkörningar"},{tab:"payments",label:"Betalningar"},{tab:"prices",label:"Priser"},{tab:"statistics",label:"Statistik"}]},
    {label:"Inställningar",icon:Settings,items:[{tab:"settings",label:"Systeminställningar"},{tab:"customers",label:"Kunder"},{tab:"partners",label:"Åkeripartners"},{tab:"trash",label:"Papperskorg"}]},
  ];
  const selectedMenu = menuGroups.find(group=>group.items.some(item=>item.tab===tab)) || menuGroups[0];
  const customers = Array.from(
    new globalThis.Map(
      allBookings.map((x: any) => [x.customer_email || x.customer_phone, x]),
    ).values(),
  );
  const trashedVehicles = d.vehicles.filter((vehicle: any) => vehicle.active === false);
  const activeVehicles = d.vehicles.filter((vehicle: any) => vehicle.active !== false);
  const trashedPrices = (d.fixedPrices || []).filter((price: any) => price.active === false);
  const trashCount =
    d.archivedBookings.length +
    d.archivedDrivers.length +
    trashedVehicles.length +
    trashedPrices.length;
  return (
    <main className="dispatchShell">
      <aside className="dispatchSide">
        <Link className="dispatchLogo" href="/" aria-label="Till huvudmenyn">
          <img src="/avenyn-logo-optimized.webp" width="56" height="56" alt="Avenyn Taxi" />
          <div>
            <b>AVENYN TAXI</b>
            <span>Admin / Dispatch</span>
          </div>
        </Link>
        <nav className="dispatchPrimaryNav" aria-label="Huvudmeny">
          {menuGroups.map(group=>{const Icon=group.icon;const selected=group===selectedMenu;return <div key={group.label} className="dispatchMenuGroup"><button className={selected?"selected":""} aria-current={selected?"true":undefined} onClick={()=>setTab(group.items[0].tab)}><Icon/>{group.label}</button>{group.items.length>1 && <div className="dispatchInlineSubNav" role="group" aria-label={group.label}>{group.items.map(item=><button key={item.tab} className={tab===item.tab?"selected":""} aria-current={tab===item.tab?"page":undefined} onClick={()=>setTab(item.tab)}>{item.label}</button>)}</div>}</div>;})}
        </nav>
        {selectedMenu.items.length>1 && <nav className="dispatchSubNav" aria-label={selectedMenu.label}>
          {selectedMenu.items.map(item=><button key={item.tab} className={tab===item.tab?"selected":""} aria-current={tab===item.tab?"page":undefined} onClick={()=>setTab(item.tab)}>{item.label}</button>)}
        </nav>}
        <div className="sideBottom">
          <Link href="/">Till huvudmenyn</Link>
          <button className="textButton" onClick={() => client.auth.signOut()}>
            Logga ut
          </button>
        </div>
      </aside>
      <section className="dispatchMain">
        <header>
          <div>
            <small>AVENYN TAXI · ORG.NR 556597-4796</small>
            <h1>
              {
                {
                  overview: "Översikt",
                  bookings: "Bokningar",
                  economy: "Ekonomi",
                  businessBilling: "Kundfakturor",
                  payments: "Betalningar",
                  drivers: "Förare",
                  driverTrips: "Förarkörningar",
                  map: "Karta",
                  vehicles: "Fordon",
                  prices: "Priser",
                  customers: "Kunder",
                  partners: "Åkeripartners",
                  history: "Avslutade / avbokade",
                  trash: "Papperskorg",
                  statistics: "Statistik",
                  settings: "Inställningar",
                }[tab]
              }
            </h1>
          </div>
          <AppChat key={session.user.id} role="dispatch" accessToken={session.access_token}/>
          <button onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={refreshing ? "spinning" : ""} />
            {refreshing ? "Uppdaterar…" : "Uppdatera"}
          </button>
        </header>
        <BookingAlert owner={session.user.id} bookings={d.bookings || []} onOpen={()=>setTab("bookings")} />
        {error && (
          <div className="notice" role="alert">
            {error} Bokningar och förare visas med senast tillgängliga data.
            <button type="button" onClick={() => void load()}>
              Försök igen
            </button>
          </div>
        )}
        {smsNotice&&<div className="dispatchSmsNotice" role="status">{smsNotice}</div>}
        {actionNotice && <div className="dispatchActionNotice" role="status">{actionNotice}<button aria-label="Stäng meddelandet" onClick={()=>setActionNotice("")}>×</button></div>}
        {(tab === "overview" || tab === "bookings") && <><div className="dispatchStats">
          <div>
            <span>
              <Clock3 />
              Nya bokningar
            </span>
            <b>{d.bookings.filter((x: any) => x.status === "new").length}</b>
          </div>
          <div>
            <span>
              <CarFront />
              Aktiva resor
            </span>
            <b>{active.filter((x: any) => x.status !== "new").length}</b>
          </div>
          <div>
            <span>
              <UsersRound />
              Förare online
            </span>
            <b>{onlineDrivers.length}</b>
          </div>
        </div>
        <PrebookingWatch owner={session.user.id} bookings={d.bookings || []} onEdit={setEditingBooking} /></>}
        <DispatchAcceptanceNotice bookings={d.bookings || []} onOpen={setEditingBooking} />
        {tab === "overview" && <BookingTimeline api={api} />}
        {tab === "overview" && (
          <>
            <details className="dispatchFlightDisclosure"><summary>Flyginformation · Landvetter</summary><DispatchFlightTest accessToken={session.access_token} /></details>
            <section className="dispatchTable">
            <div className="tableHead">
              <div>
                <h2>Dagens översikt</h2>
                <span>
                  {todayTrips.length} körningar ·{" "}
                  {revenue.toLocaleString("sv-SE")} kr
                </span>
              </div>
            </div>
            {active.slice(0, 8).map((b: any) => (
              <article
                className={`bookingRow bookingRow--${bookingTone(b)}`}
                key={b.id}
              >
                <div className="bookingId">
                  <b>#{b.booking_number || b.id}</b>
                  {b.price_breakdown?.last_dispatch_edit_at && (
                    <span className="editedBadge">Redigerad</span>
                  )}
                  <span className={`pill ${b.status} pill--${bookingTone(b)}`}>
                    {labels[b.status] || b.status}
                  </span>
                  {driverNameFor(b, d.drivers) ? (
                    <span className="driverBadge driverBadge--assigned">
                      Tilldelad: {driverNameFor(b, d.drivers)}
                    </span>
                  ) : (
                    <span className="driverBadge driverBadge--unassigned">
                      Ej tilldelad
                    </span>
                  )}
                  <PaymentBadge booking={b} />
                </div>
                <div className="bookingRoute">
                  <b>{b.pickup}</b>
                  <span>→ {b.destination}</span>
                </div>
                {b.pet_details&&<p className="petTripBadge">Djur: {petText(b.pet_details)}</p>}<div className="bookingCustomer">
                  <b>{b.customer_name}</b>
                </div>
                <strong>{b.price} kr</strong>
                <button
                  type="button"
                  className="editBookingButton"
                  onClick={() => setEditingBooking(b)}
                >
                  <Pencil /> Redigera
                </button>
                <button type="button" className="returnTripButton" onClick={() => openReturnTrip(b)}>
                  <ArrowRightLeft /> Returresa
                </button>
                <button
                  type="button"
                  className="historyDeleteButton"
                  onClick={() => setBookingToArchive(b)}
                >
                  <Trash2 /> Radera
                </button>
              </article>
            ))}
            </section>
          </>
        )}
        {tab === "map" && (
          <section className="dispatchMap dispatchMapFull">
            <div className="mapHeading">
              <div>
                <h2>Förare i trafik</h2>
                <p>Alla bilar med en sparad position visas alltid. Aktiva förare uppdateras live; annars visas senaste position och tid.</p>
              </div>
              <span>{trackedDrivers.length} på kartan · {onlineTrackedDrivers.length} online</span>
            </div>
            <DispatchLiveMap cars={trackedDrivers} bookings={d.bookings} />
          </section>
        )}
        {tab === "prices" && (
          <><DynamicPriceAdmin accessToken={session.access_token}/><PriceAdmin
            settings={d.fareSettings}
            rows={d.fixedPrices || []}
            onSave={act}
          /></>
        )}
        {tab === "bookings" ? (
          <section className="dispatchTable dispatchBookingsBoard">
            <div className="tableHead">
              <div>
                <h2>Aktiva bokningar</h2>
                <span>
                  {shownBookings.length}{" "}
                  visas
                </span>
              </div>
              <div className="tableTools">
                {<button className="newManualBooking" onClick={openNewBooking}><Plus/>Ny bokning</button>}
                <select
                  aria-label="Filtrera status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Alla statusar</option>
                  {Object.entries(labels).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button onClick={()=>setTab("history")}><History/>Avslutade / avbokade</button>
              </div>
            </div>
            {shownBookings.length === 0 ? (
              <div className="emptyTrip">
                <CarFront />
                <p>
                  Inga aktiva bokningar.
                </p>
              </div>
            ) : (
              shownBookings.map((b: any) => (
                <article
                  className={`bookingRow bookingRow--${bookingTone(b)}`}
                  key={b.id}
                >
                  <div className="bookingId">
                    <b>#{b.booking_number || b.id}</b>
                    {b.price_breakdown?.last_dispatch_edit_at && (
                      <span className="editedBadge">Redigerad</span>
                    )}
                    <span className={`pill ${b.status} pill--${bookingTone(b)}`}>
                      {labels[b.status] || b.status}
                    </span>
                    {driverNameFor(b, d.drivers) ? (
                      <span className="driverBadge driverBadge--assigned">
                        Tilldelad: {driverNameFor(b, d.drivers)}
                      </span>
                    ) : (
                      <span className="driverBadge driverBadge--unassigned">
                        Ej tilldelad
                      </span>
                    )}
                    <PaymentBadge booking={b} />
                  </div>
                  <div className="bookingRoute">
                    <time className="dispatchPickupTime" dateTime={b.pickup_time}><span>Hämtning</span>{new Date(b.pickup_time).toLocaleString("sv-SE", {timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</time>
                    <b><span className="routePoint">A</span>{b.pickup}</b>
                    <span className="dispatchDestination"><span className="routePoint">B</span>{b.destination}</span>

                  </div>
                  <div className="bookingCustomer"><small>Kund</small>
                    <b>{b.customer_name}</b>
                    <a href={"tel:" + b.customer_phone}>
                      <Phone />
                      {b.customer_phone}
                    </a>
                  </div>
                  <div className="dispatchAssignment"><small>Åkare och fordon</small><DelegatePartner booking={b} partners={partnerChoices} drivers={d.drivers} vehicles={d.vehicles} accessToken={session.access_token} onChanged={()=>void load()} onShowMap={()=>setTab("map")}/></div>
                  <strong className="dispatchBookingPrice"><small>Pris</small>{b.price} kr</strong>
                  <div className="dispatchBookingActions">
                  {paymentSmsButton(b)}
                  {['faktura','invoice'].includes(String(b.driver_reported_payment_method||b.payment_method||'').toLowerCase())&&<button onClick={()=>{setInvoiceBookingId(b.id);setTab('businessBilling');}}>Planera SMS-faktura</button>}
                  <button
                    type="button"
                    className="editBookingButton"
                    onClick={() => setEditingBooking(b)}
                  >
                    <Pencil /> Redigera
                  </button>
                  <button type="button" className="returnTripButton" onClick={() => openReturnTrip(b)}>
                    <ArrowRightLeft /> Returresa
                  </button>
                  <button type="button" className="sendBookingSmsButton" onClick={async()=>{setSmsNotice("Skickar SMS-bekräftelse…");const result=await act({action:"send_booking_sms",bookingId:b.id});if(result?.ok)setSmsNotice(result.message||"SMS-bekräftelsen har skickats till SMS-tjänsten.");else setSmsNotice("")}}>
                    <MessageCircle/> Skicka SMS-bekräftelse
                  </button>
                  <>
                      {!['completed','cancelled'].includes(b.status) && (
                        <button className="approve" onClick={()=>act({action:"release_to_all",bookingId:b.id})}>Lägg ut i auktion · alla förare</button>
                      )}
                      <button className="approve" onClick={()=>act({action:"auto_assign",bookingId:b.id})}>Tilldela automatiskt</button>
                      <select
                        aria-label="Tilldela förare"
                        value={b.assigned_driver_id || ""}
                        onChange={(e) =>
                          act({
                            action: e.target.value === "all" ? "release_to_all" : "assign",
                            bookingId: b.id,
                            driverId: e.target.value,
                          })
                        }
                      >
                        <option value="" disabled>Välj förare</option>
                        <option value="all">Auktion · alla förare igen</option>
                        {d.drivers
                          .filter(
                            (x: any) =>
                              x.approved && x.active !== false && !x.archived_at,
                          )
                          .map((x: any) => (
                            <option value={x.id} key={x.id}>
                              {x.name}
                            </option>
                          ))}
                      </select>
                      <select
                        aria-label="Status"
                        value={b.status}
                        onChange={(e) =>
                          act({
                            action: "status",
                            bookingId: b.id,
                            status: e.target.value,
                          })
                        }
                      >
                        {Object.entries(labels).map(([v, l]) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button
                        className="iconAction danger"
                        title="Flytta till Papperskorgen"
                        onClick={() => setBookingToArchive(b)}
                      >
                        <Trash2 /> Radera
                      </button>
                    </>
                  </div>
                </article>
              ))
            )}
          </section>
        ) : tab === "economy" ? (
          canViewEconomy ? <EconomyPanel key={session.user.id} supabase={client} drivers={[...d.archivedDrivers, ...d.drivers]} /> : <p role="alert">Administratörsbehörighet krävs för ekonomirapporter.</p>
        ) : tab === "businessBilling" ? (
          <BusinessBilling onEditBooking={setEditingBooking} accessToken={session.access_token} initialBooking={invoiceBookingId} onBookingOpened={()=>setInvoiceBookingId('')} />
        ) : tab === "payments" ? (
          <section className="paymentsPanel">
            <StreetPayments accessToken={session.access_token} dispatch />
            <div className="paymentSummaryGrid">
              <div className="paymentSummaryCard paymentSummaryCard--paid">
                <span>Betalt via appen</span>
                <b>{paidTotal.toLocaleString("sv-SE")} kr</b>
                <small>{paidBookings.length} bokningar</small>
              </div>
              <div className="paymentSummaryCard paymentSummaryCard--pending">
                <span>Väntar på betalning</span>
                <b>
                  {
                    paymentBookings.filter(
                      (booking: any) => paymentTone(booking) === "pending",
                    ).length
                  }
                </b>
                <small>skickade betalningslänkar</small>
              </div>
              <div className="paymentSummaryCard">
                <span>Ej betalda</span>
                <b>
                  {
                    paymentBookings.filter(
                      (booking: any) => paymentTone(booking) === "unpaid",
                    ).length
                  }
                </b>
                <small>bokningar</small>
              </div>
            </div>
            <div className="dispatchTable">
              <div className="tableHead">
                <div>
                  <h2>Betalningsstatus</h2>
                  <span>{shownPaymentBookings.length} bokningar visas</span>
                </div>
                <select
                  aria-label="Filtrera betalningsstatus"
                  value={paymentFilter}
                  onChange={(event) =>
                    setPaymentFilter(event.target.value as PaymentTone | "all")
                  }
                >
                  <option value="all">Alla betalningar</option>
                  <option value="paid">Betalda via appen</option>
                  <option value="pending">Väntar på betalning</option>
                  <option value="unpaid">Ej betalda</option>
                  <option value="refunded">Återbetalda</option>
                </select>
              </div>
              {shownPaymentBookings.length === 0 ? (
                <div className="emptyTrip">
                  <CreditCard />
                  <p>Inga bokningar med den betalningsstatusen.</p>
                </div>
              ) : (
                shownPaymentBookings.map((booking: any) => (
                  <article className="paymentBookingRow" key={booking.id}>
                    <div>
                      <b>#{booking.booking_number || booking.id}</b>
                      <small>{booking.customer_name}</small>
                    </div>
                    <div className="paymentBookingRoute">
                      <b>{booking.pickup}</b>
                      <span>→ {booking.destination}</span>
                    </div>
                    <div>
                      <PaymentBadge booking={booking} />
                      <small>
                        {paymentTone(booking) === "paid"
                          ? booking.payment_method || "Stripe"
                          : driverNameFor(booking, d.drivers) || "Förare ej tilldelad"}
                      </small>
                    </div>
                    <strong>{Number(booking.price || 0).toLocaleString("sv-SE")} kr</strong>
                    <div className="paymentRowActions">
                      <button onClick={() => setEditingBooking(booking)}><Pencil /> Redigera</button>
                      <button onClick={() => openReturnTrip(booking)}><ArrowRightLeft /> Returresa</button>
                      {!booking.archived_at && <button className="danger" onClick={() => setBookingToArchive(booking)}><Trash2 /> Radera</button>}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : tab === "drivers" ? (
          <section className="driverAdmin">
            <div className="tableHead">
              <div>
                <h2>
                  {view === "active" ? "Förarkonton" : "Arkiverade förare"}
                </h2>
                <span>
                  {(view === "active" ? d.drivers : d.archivedDrivers).length}{" "}
                  registrerade
                </span>
              </div>
              <div className="tableTools">
                <button
                  type="button"
                  className="driverAddButton"
                  onClick={() => {
                    setEditingDriver(null);
                    setDriverEditorOpen(true);
                  }}
                >
                  <UsersRound />
                  Lägg till förare
                </button>
                <button
                  onClick={() =>
                    setView(view === "active" ? "archive" : "active")
                  }
                >
                  <Archive />
                  {view === "active" ? "Öppna arkiv" : "Till aktiva"}
                </button>
              </div>
            </div>
            {view === "active" && (
              <>
                <p className="dispatchHint">
                  Lägg till föraren här. En personlig länk skickas till e-postadressen så att föraren kan välja lösenord och logga in.
                </p>
                {driverNotice && <div className="driverInviteNotice">{driverNotice}</div>}
              </>
            )}
            <label className="dispatchDriverSearch">Sök förare<input type="search" placeholder="Namn, e-post eller telefon" value={driverSearch} onChange={e=>setDriverSearch(e.target.value)}/></label>
            {(view === "active" ? d.drivers : d.archivedDrivers).filter((x:any)=>`${x.name} ${x.email} ${x.phone}`.toLocaleLowerCase("sv").includes(driverSearch.trim().toLocaleLowerCase("sv"))).length === 0 && <p className="dispatchHint">Inga förare matchar urvalet.</p>}
            {(view === "active" ? d.drivers : d.archivedDrivers).filter((x:any)=>`${x.name} ${x.email} ${x.phone}`.toLocaleLowerCase("sv").includes(driverSearch.trim().toLocaleLowerCase("sv"))).map(
              (x: any) => (
                <article className="driverAdminRow" key={x.id}>
                  <div className="avatar">{x.name?.[0] || "F"}</div>
                  <div>
                    <b>{x.name}</b>
                    <span>{x.email}</span>
                    <small>{x.phone || "Telefon saknas"}</small>
                    <small className="driverLicenseNumber">
                      Taxiförarlegitimation: {x.taxi_driver_license_number || "saknas"}
                    </small>
                  </div>
                  <div className="driverAccountStatus">
                    <span className={x.online ? "liveStatus" : "offStatus"}>
                      {x.online
                        ? driverLabels[x.availability_status] || "Online"
                        : "Offline"}
                    </span>
                    <small className={x.approved ? "approvedStatus" : "pausedStatus"}>
                      {x.approved ? "Godkänd" : "Pausad"}
                    </small>
                    <small className={x.auth_user_id ? "loginReadyStatus" : "loginMissingStatus"}>
                      {x.auth_user_id ? "Inloggning skapad" : "Saknar inloggning"}
                    </small>
                  </div>
                  <span className="driverLocation">
                    {x.lat ? (
                      <>
                      <MapPin />
                      {Number(x.lat).toFixed(4)}, {Number(x.lng).toFixed(4)}
                      </>
                    ) : (
                      "Ingen liveposition"
                    )}
                  </span>
                  {view === "active" ? (
                    <div className="driverAdminActions">
                      <button
                        type="button"
                        className="driverTripsButton"
                        onClick={() => {
                          setDriverReportId(x.id);
                          setTab("driverTrips");
                        }}
                      >
                        <Clock3 /> Körningar
                      </button>
                      <button
                        type="button"
                        className="editDriverButton"
                        onClick={() => {
                          setEditingDriver(x);
                          setDriverEditorOpen(true);
                        }}
                      >
                        <Pencil /> Redigera
                      </button>
                      <details className="dispatchRowMenu"><summary>Fler åtgärder</summary><div className="dispatchRowMenuItems">
                      <button
                        type="button"
                        className="inviteDriverButton"
                        disabled={driverInviteNotices[x.id]?.tone === "loading"}
                        onClick={() => inviteDriver(x, "email")}
                      >
                        <MailPlus /> {x.auth_user_id ? "Ny e-postlänk" : "Skicka e-post"}
                      </button>
                      <button
                        type="button"
                        className="inviteDriverSmsButton"
                        disabled={
                          driverInviteNotices[x.id]?.tone === "loading" ||
                          !x.phone
                        }
                        title={x.phone ? "Skicka Avenyn Taxi Förarapp och personlig lösenordslänk via SMS" : "Mobilnummer saknas"}
                        onClick={() => inviteDriver(x, "sms")}
                      >
                        <MessageCircle /> {x.auth_user_id ? "Skicka nya länkar" : "App + lösenord via SMS"}
                      </button>
                      <button
                        className={x.approved ? "pause" : "approve"}
                        onClick={() =>
                          act({
                            action: "approve",
                            driverId: x.id,
                            approved: !x.approved,
                          })
                        }
                      >
                        {x.approved ? "Pausa" : "Aktivera"}
                      </button>
                      <button
                        className="iconAction danger"
                        title="Radera förare"
                        aria-label={`Radera ${x.name}`}
                        onClick={() => setDriverToDelete(x)}
                      >
                        <Trash2 /> Radera
                      </button>
                      </div></details>
                      {driverInviteNotices[x.id] && (
                        <div
                          className={`driverInviteRowNotice driverInviteRowNotice--${driverInviteNotices[x.id].tone}`}
                          role="status"
                          aria-live="polite"
                        >
                          {driverInviteNotices[x.id].message}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="driverAdminActions">
                      <button
                        className="restoreDriverButton"
                        title="Återställ förare"
                        onClick={() =>
                          act({ action: "restore_driver", driverId: x.id })
                        }
                      >
                        <RotateCcw /> Återställ
                      </button>
                    </div>
                  )}
                </article>
              ),
            )}
          </section>
        ) : tab === "driverTrips" ? (
          <section className="driverTripsAdmin">
            <div className="tableHead driverTripsHead">
              <div>
                <h2>Körningar per förare</h2>
                <span>Belopp, tider och registrerat betalsätt</span>
              </div>
              <div className="driverTripsFilters">
                <button
                  type="button"
                  className="driverTripAddButton"
                  onClick={openNewBooking}
                >
                  <Plus /> Lägg till körning
                </button>
                <label>
                  <span>Förare</span>
                  <select
                    value={driverReportId}
                    onChange={(event) => setDriverReportId(event.target.value)}
                  >
                    <option value="all">Alla förare</option>
                    {d.drivers.map((driver: any) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </label>
                <PeriodPicker value={reportPeriod} onChange={setReportPeriod}/>
              </div>
            </div>
            <div className="driverTripTotals">
              <div>
                <span>Avslutade körningar</span>
                <b>{driverReportBookings.length}</b>
              </div>
              <div>
                <span>Registrerat belopp</span>
                <b>{driverReportTotal.toLocaleString("sv-SE")} kr</b>
              </div>
              <div>
                <span>Betalda</span>
                <b>{driverReportPaid.length}</b>
              </div>
              <div>
                <span>Ej betalda / ej markerade</span>
                <b>{driverReportBookings.length - driverReportPaid.length}</b>
              </div>
            </div>
            <CommissionBreakdown showDriverShare={!driverReportBookings.some((b:any)=>{const id=b.assigned_partner_id||partnerDriverLinks.find(l=>l.driver_id===b.assigned_driver_id)?.partner_id;const p=partnerChoices.find(x=>x.id===id);return p&&!isOwnCompany(p.company);})} title="Vald period · inkört och moms" amounts={driverReportBookings.map((b:any)=>b.price)}/>
            <PartnerCommissionAdmin bookings={driverReportBookings} accessToken={session.access_token}/>
            {driverReportId === "all" && driverReportGroups.length > 0 && (
              <div className="driverReportNames" aria-label="Välj förare">
                {driverReportGroups.map((driver: any) => (
                  <button
                    type="button"
                    key={driver.id}
                    onClick={() => setDriverReportId(driver.id)}
                  >
                    <span>{driver.name}</span>
                    <b>{driver.trips} körningar</b>
                    <strong>{driver.revenue.toLocaleString("sv-SE")} kr</strong>
                  </button>
                ))}
              </div>
            )}
            <div className="driverTripReportList">
              {driverReportBookings.length === 0 ? (
                <div className="driverTripReportEmpty">
                  <Clock3 />
                  <p>Inga avslutade körningar för den valda perioden.</p>
                </div>
              ) : (
                driverReportBookings.map((booking: any) => {
                  const driver = d.drivers.find(
                    (item: any) => item.id === booking.assigned_driver_id,
                  );
                  const paid =
                    booking.driver_reported_paid === true ||
                    paymentTone(booking) === "paid";
                  const paymentRegistered =
                    booking.driver_reported_paid !== null &&
                    booking.driver_reported_paid !== undefined;
                  return (
                    <article className="driverTripReportRow" key={booking.id}>
                      <div className="driverTripReportIdentity">
                        <b>{driver?.name || booking.driver_name || "Förare saknas"}</b>
                        <span>#{booking.booking_number || booking.id}</span>
                      </div>
                      <div className="driverTripReportRoute">
                        <b>{booking.pickup}</b>
                        <span>→ {booking.destination}</span>
                      </div>
                      <div className="driverTripReportTime">
                        <span>
                          Hämtning {booking.booking_date} {String(booking.pickup_time || "").slice(-8, -3) || String(booking.pickup_time || "").slice(0, 5)}
                        </span>
                        <span>
                          Slutförd {booking.completed_at ? new Date(booking.completed_at).toLocaleString("sv-SE") : "tid saknas"}
                        </span>
                        <small>Körtid: {tripDurationLabel(booking)}</small>
                      </div>
                      <div className="driverTripReportPayment">
                        <b>{Number(booking.price || 0).toLocaleString("sv-SE")} kr</b>
                        <span>{reportedPaymentLabel(booking)}</span>
                        <small className={paid ? "driverTripPaid" : "driverTripUnpaid"}>
                          {paid
                            ? "Betald"
                            : paymentRegistered
                              ? "Ej betald"
                              : "Betalning ej registrerad"}
                        </small>
                        {booking.driver_reported_payment_note && (
                          <small>{booking.driver_reported_payment_note}</small>
                        )}
                      </div>
                      <div className="driverTripReportActions">
                        <button
                          type="button"
                          className="driverTripEditButton"
                          onClick={() => setEditingBooking(booking)}
                        >
                          <Pencil /> Redigera
                        </button>
                        <button type="button" className="driverTripReturnButton" onClick={() => openReturnTrip(booking)}>
                          <ArrowRightLeft /> Returresa
                        </button>
                        <button
                          type="button"
                          className="driverTripDeleteButton"
                          onClick={() => setDriverTripToArchive(booking)}
                        >
                          <Trash2 /> Radera
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
        {tab === "vehicles" && (
          <section className="driverAdmin vehicleAdmin">
            <div className="tableHead">
              <div>
                <h2>Fordonsregister</h2>
                <span>{activeVehicles.length} aktiva bilar</span>
              </div>
            </div>
            <div className="vehicleEditor" id="vehicle-editor">
              <div className="vehicleEditorHeading">
                <div>
                  <small>{vehicleForm.id ? "REDIGERAR FORDON" : "NYTT FORDON"}</small>
                  <b>
                    {vehicleForm.id
                      ? `${vehicleForm.vehicleNumber || "Bil"} · ${vehicleForm.registrationNumber || "Registrering saknas"}`
                      : "Lägg till bil"}
                  </b>
                </div>
                {vehicleForm.id && <span>Ändra uppgifterna och tryck Spara bil</span>}
              </div>
              {vehicleNotice && <p className="vehicleNotice" role="status">{vehicleNotice}</p>}
              <label>
                Bilnummer
                <input
                  value={vehicleForm.vehicleNumber}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      vehicleNumber: e.target.value,
                    })
                  }
                  placeholder="Bil 1"
                />
              </label>
              <label>
                Registreringsnummer
                <input
                  value={vehicleForm.registrationNumber}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      registrationNumber: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="ABC123"
                />
              </label>
              <label>
                Märke
                <input
                  value={vehicleForm.make}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, make: e.target.value })
                  }
                  placeholder="Mercedes"
                />
              </label>
              <label>
                Modell
                <input
                  value={vehicleForm.model}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, model: e.target.value })
                  }
                />
              </label>
              <label>
                Färg
                <input
                  value={vehicleForm.color}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, color: e.target.value })
                  }
                />
              </label>
              <label>
                Passagerare
                <input
                  type="number"
                  min="1"
                  max="9"
                  value={vehicleForm.passengerCapacity}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      passengerCapacity: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Fordonsklass
                <select
                  value={vehicleForm.vehicleClass}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      vehicleClass: e.target.value,
                    })
                  }
                >
                  <option>Standard</option>
                  <option>Storbil</option>
                  <option>Premium</option>
                </select>
              </label>
              <label>
                Tilldelad förare
                <select
                  value={vehicleForm.driverId}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, driverId: e.target.value })
                  }
                >
                  <option value="">Ingen</option>
                  {d.drivers
                    .filter((x: any) => x.approved)
                    .map((x: any) => (
                      <option value={x.id} key={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="vehicleActive">
                <input
                  type="checkbox"
                  checked={vehicleForm.active}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, active: e.target.checked })
                  }
                />
                Aktiv
              </label>
              <button type="button" className="approve" onClick={saveVehicle}>
                {vehicleForm.id ? "Spara bil" : "Lägg till bil"}
              </button>
              {vehicleForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setVehicleForm({
                      vehicleNumber: "",
                      registrationNumber: "",
                      make: "",
                      model: "",
                      color: "",
                      passengerCapacity: 4,
                      vehicleClass: "Standard",
                      active: true,
                      driverId: "",
                    })
                  }
                >
                  Avbryt
                </button>
              )}
            </div>
            {activeVehicles.length ? (
              activeVehicles.map((x: any) => {
                const assignedDriver = d.drivers.find(
                  (driver: any) => driver.id === x.driver_id,
                );
                const driverOnline = Boolean(
                  assignedDriver?.is_online ||
                    assignedDriver?.availability_status === "available" ||
                    assignedDriver?.availability_status === "busy",
                );
                return (
                <article className="driverAdminRow vehicleAdminRow" key={x.id}>
                  <div className="avatar">
                    <CarFront />
                  </div>
                  <div>
                    <b>
                      {x.vehicle_number || x.name || "Bil"} ·{" "}
                      {x.registration_number || x.reg || "Registrering saknas"}
                    </b>
                    <span>
                      {[x.make, x.model, x.color].filter(Boolean).join(" · ")}
                    </span>
                    <small>
                      {x.passenger_capacity || 4} passagerare ·{" "}
                      {x.vehicle_class || "Standard"}
                    </small>
                    <span className={`vehicleDriverBadge ${assignedDriver ? (driverOnline ? "isOnline" : "isOffline") : "isUnassigned"}`}>
                      {assignedDriver
                        ? `${assignedDriver.name} · ${driverOnline ? "Online" : "Offline"}`
                        : "Ingen förare kopplad"}
                    </span>
                  </div>
                  <div
                    className={x.active === false ? "offStatus" : "liveStatus"}
                  >
                    {x.active === false ? "Inaktiv" : "Aktiv"}
                  </div>
                  <div className="vehicleRowActions">
                  <button
                    type="button"
                    className="editVehicleButton"
                    onClick={() => editVehicle(x)}
                  >
                    <Pencil /> Redigera
                  </button>
                  <button
                    type="button"
                    className="vehicleDeleteButton"
                    onClick={() => setVehicleToArchive(x)}
                  >
                    <Trash2 /> Radera
                  </button>
                  </div>
                </article>
                );
              })
            ) : (
              <div className="emptyTrip">
                <CarFront />
                <p>Inga fordon registrerade ännu.</p>
              </div>
            )}
          </section>
        )}
        {tab === "customers" && (
          <section className="dispatchTable">
            <div className="tableHead">
              <div>
                <h2>Kunder</h2>
                <span>{customers.length} unika kunder</span>
              </div>
            </div>
            {customers.map((x: any) => (
              <article
                className="bookingRow"
                key={x.customer_email || x.customer_phone}
              >
                <div className="bookingCustomer">
                  <b>{x.customer_name}</b>
                  <a href={"tel:" + x.customer_phone}>
                    <Phone />
                    {x.customer_phone}
                  </a>
                </div>
                <span>{x.customer_email}</span>
                <span>
                  {
                    [...d.bookings, ...d.archivedBookings].filter(
                      (b: any) =>
                        (b.customer_email || b.customer_phone) ===
                        (x.customer_email || x.customer_phone),
                    ).length
                  }{" "}
                  bokningar
                </span>
              </article>
            ))}
          </section>
        )}
        {tab === "history" && (
          <section className="dispatchTable">
            <div className="tableHead">
              <div>
                <h2>Avslutade och avbokade</h2>
                <span>{inactiveBookings.length} bokningar och körningar</span>
              </div>
            </div>
            {inactiveBookings.length === 0 && <div className="emptyTrip"><History/><p>Inga avslutade eller avbokade bokningar.</p></div>}
            {inactiveBookings.map((b: any) => (
              <article
                className={`bookingRow bookingRow--${bookingTone(b)}`}
                key={b.id}
              >
                <div className="bookingId">
                  <b>#{b.booking_number || b.id}</b>
                  {b.price_breakdown?.last_dispatch_edit_at && (
                    <span className="editedBadge">Redigerad</span>
                  )}
                  <span className={`pill ${b.status} pill--${bookingTone(b)}`}>
                    {labels[b.status] || b.status}
                  </span>
                  {driverNameFor(b, d.drivers) ? (
                    <span className="driverBadge driverBadge--assigned">
                      Tilldelad: {driverNameFor(b, d.drivers)}
                    </span>
                  ) : (
                    <span className="driverBadge driverBadge--unassigned">
                      Ej tilldelad
                    </span>
                  )}
                  {b.status==='completed'&&paymentSmsButton(b)}
                  {b.status==='completed'&&canViewEconomy&&<button onClick={()=>{setInvoiceBookingId(b.id);setTab('businessBilling');}}>Fakturera bokning</button>}
                  <PaymentBadge booking={b} />
                </div>
                <div className="bookingRoute">
                  <b>{b.pickup}</b>
                  <span>→ {b.destination}</span>
                  <small>
                    {b.booking_date}{" "}
                    {b.pickup_time?.slice?.(11) || b.pickup_time}
                  </small>
                </div>
                <div className="bookingCustomer">
                  <b>{b.customer_name}</b>
                </div>
                <strong>{b.price} kr</strong>
                <button
                  type="button"
                  className="editBookingButton"
                  onClick={() => setEditingBooking(b)}
                >
                  <Pencil /> Redigera
                </button>
                <button type="button" className="returnTripButton" onClick={() => openReturnTrip(b)}>
                  <ArrowRightLeft /> Returresa
                </button>
                <button
                  type="button"
                  className="historyDeleteButton"
                  onClick={() => setBookingToArchive(b)}
                >
                  <Trash2 /> Radera
                </button>
              </article>
            ))}
          </section>
        )}
        {tab === "partners" && <PartnerAdmin accessToken={session.access_token} />}

        {tab === "trash" && (
          <section className="trashPanel">
            <div className="trashIntro">
              <div>
                <Trash2 />
                <span>
                  <h2>Papperskorg</h2>
                  <p>Raderade poster sparas här. Bokningar och körningar kan återställas eller raderas permanent.</p>
                </span>
              </div>
              <b>{trashCount} poster</b>
            </div>
            {trashCount === 0 ? (
              <div className="trashEmpty">
                <Archive />
                <p>Papperskorgen är tom.</p>
              </div>
            ) : (
              <div className="trashGroups">
                <section>
                  <h3>Bokningar och körningar <span>{d.archivedBookings.length}</span></h3>
                  {d.archivedBookings.map((booking: any) => (
                    <article className="trashRow" key={booking.id}>
                      <div><b>#{booking.booking_number || booking.id}</b><span>{booking.pickup} → {booking.destination}</span></div>
                      <strong>{Number(booking.price || 0).toLocaleString("sv-SE")} kr</strong>
                      <div className="trashBookingActions"><button onClick={() => act({ action: "restore_booking", bookingId: booking.id })}><RotateCcw /> Återställ</button><button className="permanentDeleteButton" onClick={()=>{setPermanentDeleteError("");setBookingToPermanentlyDelete(booking)}}><Trash2/>Radera permanent</button></div>
                    </article>
                  ))}
                </section>
                <section>
                  <h3>Förare <span>{d.archivedDrivers.length}</span></h3>
                  {d.archivedDrivers.map((driver: any) => (
                    <article className="trashRow" key={driver.id}>
                      <div><b>{driver.name}</b><span>{driver.email || driver.phone}</span></div>
                      <button onClick={() => act({ action: "restore_driver", driverId: driver.id })}><RotateCcw /> Återställ</button>
                    </article>
                  ))}
                </section>
                <section>
                  <h3>Fordon <span>{trashedVehicles.length}</span></h3>
                  {trashedVehicles.map((vehicle: any) => (
                    <article className="trashRow" key={vehicle.id}>
                      <div><b>{vehicle.vehicle_number || vehicle.name}</b><span>{vehicle.registration_number || vehicle.reg}</span></div>
                      <button onClick={() => act({ action: "restore_vehicle", vehicleId: vehicle.id })}><RotateCcw /> Återställ</button>
                    </article>
                  ))}
                </section>
                <section>
                  <h3>Priser <span>{trashedPrices.length}</span></h3>
                  {trashedPrices.map((price: any) => (
                    <article className="trashRow" key={price.code || price.locality}>
                      <div><b>{price.locality}</b><span>{price.region} · {Number(price.price || 0).toLocaleString("sv-SE")} kr</span></div>
                      <button onClick={() => act({ action: "save_fixed_price", code: price.code, locality: price.locality, region: price.region, destination: price.destination, price: price.price, active: true })}><RotateCcw /> Återställ</button>
                    </article>
                  ))}
                </section>
              </div>
            )}
          </section>
        )}
        {tab === "statistics" && (
          <section className="dispatchTable">
            <div className="tableHead">
              <div>
                <h2>Nyckeltal</h2>
                <span>Direkt från bokningsdatabasen</span>
              </div>
            </div>
            <div className="visitStatsTitle"><BarChart3/><div><b>Besök på hemsidan</b><span>Unika webbläsare · inga namn eller personuppgifter sparas</span></div></div>
            <div className="visitStatsGrid"><div><span>Idag</span><b>{Number(d.siteVisits.today_visitors||0).toLocaleString("sv-SE")}</b></div><div><span>Senaste 7 dagarna</span><b>{Number(d.siteVisits.week_visitors||0).toLocaleString("sv-SE")}</b></div><div><span>Denna månad</span><b>{Number(d.siteVisits.month_visitors||0).toLocaleString("sv-SE")}</b></div><div><span>Totalt unika</span><b>{Number(d.siteVisits.total_visitors||0).toLocaleString("sv-SE")}</b></div><div><span>Sidvisningar</span><b>{Number(d.siteVisits.total_page_views||0).toLocaleString("sv-SE")}</b></div></div>
            <div className="dispatchStats">
              <div>
                <span>Körningar idag</span>
                <b>{todayTrips.length}</b>
              </div>
              <div>
                <span>Körningar 7 dagar</span>
                <b>{weekTrips.length}</b>
              </div>
              <div>
                <span>Körningar månad</span>
                <b>{monthTrips.length}</b>
              </div>
              <div>
                <span>Omsättning idag</span>
                <b>{revenue.toLocaleString("sv-SE")} kr</b>
              </div>
              <div>
                <span>Omsättning månad</span>
                <b>{monthRevenue.toLocaleString("sv-SE")} kr</b>
              </div>
              <div>
                <span>Genomsnittligt ordervärde</span>
                <b>
                  {completed.length
                    ? Math.round(
                        completed.reduce(
                          (sum: number, x: any) => sum + Number(x.price || 0),
                          0,
                        ) / completed.length,
                      )
                    : 0}{" "}
                  kr
                </b>
              </div>
              <div>
                <span>Avbokningar</span>
                <b>
                  {
                    allBookings.filter((x: any) => x.status === "cancelled")
                      .length
                  }
                </b>
              </div>
            </div>
            <div className="fixedPriceList">
              {driverPerformance.map((driver: any) => (
                <article className="fixedPriceRow" key={driver.name}>
                  <div>
                    <b>{driver.name}</b>
                    <span>Förare</span>
                  </div>
                  <strong>{driver.trips} avslutade</strong>
                  <b>{driver.revenue.toLocaleString("sv-SE")} kr</b>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === "settings" && (
          <><PetOptionsAdmin api={api}/><section className="dispatchTable">
            <div className="tableHead">
              <div>
                <h2>Systeminställningar</h2>
                <span>Gemensam Supabase-backend</span>
              </div>
            </div>
            <p className="dispatchHint">
              Svenska är standardspråk. Auth, RLS, Realtime, priszoner,
              bokningar, förare och livepositioner är kopplade till samma
              databas. Prisändringar görs under Priser och loggas automatiskt.
            </p>
          </section></>
        )}
      </section>
      <BookingEditDialog
        booking={editingBooking}
        drivers={d.drivers}
        open={Boolean(editingBooking)}
        api={api}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingBooking(null);
        }}
        onSaved={async()=>{await load();if(tab==='businessBilling'&&editingBooking)setInvoiceBookingId(editingBooking.id);}}
      />
      <ManualBookingDialog initialBooking={manualBookingSeed} open={manualBookingOpen} onOpenChange={(nextOpen)=>{setManualBookingOpen(nextOpen);if(!nextOpen)setManualBookingSeed(null);}} drivers={d.drivers} onCreate={async body=>{setSmsNotice(manualBookingSeed?"Skapar returresan…":"Skapar bokningen…");const result=await act(body);if(result?.ok)setSmsNotice(result.smsError||(result.smsSent?(manualBookingSeed?"Returresan är skapad och SMS har skickats till kunden.":"Bokningen är skapad och SMS har skickats till kunden."):(manualBookingSeed?"Returresan är skapad.":"Bokningen är skapad.")));else setSmsNotice("");return result;}}/>
      <DriverEditorDialog
        open={driverEditorOpen}
        driver={editingDriver}
        onOpenChange={(nextOpen) => {
          setDriverEditorOpen(nextOpen);
          if (!nextOpen) setEditingDriver(null);
        }}
        onSave={async (body) => {
          const result = await act(body);
          if (result?.ok && result?.driverInvite?.sent)
            setDriverNotice(`Föraren är tillagd och inbjudan har skickats till ${body.driver.email}.`);
          else if (result?.ok && result?.driverInvite?.error)
            setDriverNotice(result.driverInvite.error);
          return result;
        }}
      />
      <AlertDialog
        open={Boolean(bookingToArchive)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archiveBusy) { setBookingToArchive(null); setArchiveError(""); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flytta bokning #{bookingToArchive?.booking_number || ""} till Papperskorgen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bokningen tas bort från de aktiva listorna men sparas i
              Papperskorgen och kan återställas senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && <p role="alert" className="permanentDeleteError">{archiveError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveBusy}
              onClick={async (event) => {
                event.preventDefault();
                if (bookingToArchive?.id) await archiveItem({action:"archive_booking",bookingId:bookingToArchive.id},()=>setBookingToArchive(null));
              }}
            >
              Flytta till Papperskorgen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(bookingToPermanentlyDelete)} onOpenChange={open=>{if(!open&&!permanentDeleteBusy)setBookingToPermanentlyDelete(null)}}>
        <AlertDialogContent className="permanentBookingDeleteDialog">
          <AlertDialogHeader><AlertDialogTitle>Radera bokning #{bookingToPermanentlyDelete?.booking_number} permanent?</AlertDialogTitle><AlertDialogDescription>Bokningen, körningen och deras kopplade historik tas bort helt. Den försvinner även från rapporter och kan inte återställas. En genomförd betalning återbetalas inte av denna åtgärd.</AlertDialogDescription></AlertDialogHeader>
          {permanentDeleteError&&<p className="permanentDeleteError" role="alert">{permanentDeleteError}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={permanentDeleteBusy}>Avbryt</AlertDialogCancel><button className="permanentDeleteButton" disabled={permanentDeleteBusy} onClick={async()=>{setPermanentDeleteBusy(true);setPermanentDeleteError("");try{const result=await act({action:"permanently_delete_booking",bookingId:bookingToPermanentlyDelete.id,confirmPermanentDelete:true,bookingNumber:bookingToPermanentlyDelete.booking_number});if(result?.ok)setBookingToPermanentlyDelete(null);else setPermanentDeleteError(result?.error||"Bokningen kunde inte raderas.")}catch{setPermanentDeleteError("Bokningen kunde inte raderas. Försök igen.")}finally{setPermanentDeleteBusy(false)}}}>{permanentDeleteBusy?"Raderar…":"Radera permanent"}</button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(vehicleToArchive)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archiveBusy) { setVehicleToArchive(null); setArchiveError(""); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera {vehicleToArchive?.vehicle_number || vehicleToArchive?.name || "fordonet"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Fordonet inaktiveras, kopplas bort från föraren och flyttas till
              Papperskorgen. Det kan återställas senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && <p role="alert" className="permanentDeleteError">{archiveError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveBusy}
              onClick={async (event) => {
                event.preventDefault();
                if (vehicleToArchive?.id) await archiveItem({action:"archive_vehicle",vehicleId:vehicleToArchive.id},()=>setVehicleToArchive(null));
              }}
            >
              Flytta till Papperskorgen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(driverToDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archiveBusy) { setDriverToDelete(null); setArchiveError(""); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera {driverToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Föraren flyttas till Papperskorgen och kan inte ta emot nya
              körningar. Tidigare körhistorik sparas och föraren kan
              återställas senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && <p role="alert" className="permanentDeleteError">{archiveError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveBusy}
              onClick={async (event) => {
                event.preventDefault();
                if (driverToDelete?.id) await archiveItem({action:"delete_driver",driverId:driverToDelete.id},()=>setDriverToDelete(null));
              }}
            >
              Radera förare
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(driverTripToArchive)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archiveBusy) { setDriverTripToArchive(null); setArchiveError(""); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Radera körning #{driverTripToArchive?.booking_number || ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Körningen flyttas till Papperskorgen och tas bort från förarens
              sammanställning. Den kan återställas senare, så ingen historik
              försvinner permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && <p role="alert" className="permanentDeleteError">{archiveError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveBusy}
              onClick={async (event) => {
                event.preventDefault();
                if (driverTripToArchive?.id) await archiveItem({action:"archive_booking",bookingId:driverTripToArchive.id},()=>setDriverTripToArchive(null));
              }}
            >
              Radera körning
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
