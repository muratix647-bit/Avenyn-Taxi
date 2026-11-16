"use client";
import {fetchPriceQuote} from "@/lib/fetch-price-quote";
import {usePickupApproach} from "@/lib/use-pickup-approach";
import SocialLinks from "@/components/social-links";
import CustomerMobileFit from "@/components/customer-mobile-fit";


import PetField from '@/components/pet-field';
import {petText,type PetSelection} from '@/lib/pets';
import AppLanguage, {useAppLanguage,AppText} from "@/components/app-language";
import {isCustomerAppBrowser} from "@/lib/customer-app-mode";
import {createAddressSearch,resolveAddress,warmAddressSearch,knownAddresses} from "@/lib/address-search";
import {cachedAddresses,rememberAddresses,matchingCachedAddresses} from "@/lib/address-suggestions-cache";

import {onlinePaymentOptions,onlinePaymentAvailability} from "@/lib/payment-copy";
import { LandvetterBookingAssistant } from "@/components/landvetter-assistant";
import GothenburgWeather from "@/components/gothenburg-weather";
import SavedAddresses from "@/components/saved-addresses";
import { rebookDetails } from "@/lib/rebook";
import {paymentMethods} from "@/lib/booking-options";
import NightlifeBackdrop from "@/components/nightlife-backdrop";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Baby,
  Boxes,
  CalendarClock,
  CarFront,
  Check,
  ChevronRight,
  CirclePlus,
  CreditCard,
  Crosshair,
  GripVertical,
  KeyRound,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Phone,
  Plane,
  Search,
  ShieldPlus,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {useCustomerRoute} from "@/lib/use-customer-route";
import TrackClient from "@/app/track/[token]/track-client";
import {readGuestBookings,saveGuestBooking,type GuestBooking} from "@/lib/guest-bookings";
import CustomerTripMap from "@/components/customer-trip-map";
import LiveMap from "@/components/live-map";
import QuoteRequestForm from "@/components/quote-request-form";
import CustomerSmartGuide from "@/components/customer-smart-guide";
import ContactForm from "@/components/contact-form";
import AppDownloadBanner from "@/components/app-download-banner";
import InstallApp from "@/components/install-app";
import GoogleReviews from "@/components/google-reviews";
import ServiceRequestForm from "@/components/service-request-form";
import { isLandvetterAirport, LANDVETTER_AIRPORT } from "@/lib/prices";
import { GOTHENBURG_CENTRAL } from "@/lib/places";
import { languages, messages } from "@/lib/customer-i18n";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
type Place = {
  id?: string;
  label: string;
  primary?: string;
  secondary?: string;
  lat?: number;
  lng?: number;
  area?: string;
  kind?: string;
  placeType?: string;
  components?: Record<string, string>;
  fixedPrice?: number;
};
type OfficialPrice = {
  code: string;
  locality: string;
  region: string;
  price: number;
  active: boolean;
};
type PublicOnlineCar = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heading: number;
  updatedAt?: string | null;
};
const homeFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    ["Hur bokar jag taxi i Göteborg?", "Fyll i hämtadress, destination, tid och kontaktuppgifter i bokningsformuläret. Kontrollera sedan resan innan du bekräftar."],
    ["Kan jag förboka taxi?", "Ja. Välj önskat datum och klockslag i bokningen och kontrollera hämtningstiden före bekräftelse."],
    ["Kör ni taxi till Landvetter?", "Ja, Avenyn Taxi kör till och från Göteborg Landvetter Airport. Aktiva officiella fastpriser hämtas från den centrala prislistan."],
    ["Kan jag boka barnstol eller storbil?", "Ja. Barnstol kan läggas till som tillval och storbil kan väljas för större sällskap."],
    ["Kan jag följa taxin live?", "När en förare har tilldelats kan du använda den personliga spårningslänken för att följa bilen."],
    ["Vilka betalningsmetoder accepterar ni?", "De betalningsalternativ som är tillgängliga för resan visas i det aktuella betalningsflödet före betalning."],
  ].map(([name, text]) => ({
    "@type": "Question",
    name,
    acceptedAnswer: { "@type": "Answer", text },
  })),
};
const phoneCountries = [
  { code: "+46", flag: "🇸🇪", name: "Sverige" },
  { code: "+47", flag: "🇳🇴", name: "Norge" },
  { code: "+45", flag: "🇩🇰", name: "Danmark" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+44", flag: "🇬🇧", name: "Storbritannien" },
  { code: "+49", flag: "🇩🇪", name: "Tyskland" },
  { code: "+31", flag: "🇳🇱", name: "Nederländerna" },
  { code: "+33", flag: "🇫🇷", name: "Frankrike" },
  { code: "+34", flag: "🇪🇸", name: "Spanien" },
  { code: "+39", flag: "🇮🇹", name: "Italien" },
  { code: "+48", flag: "🇵🇱", name: "Polen" },
  { code: "+355", flag: "🇦🇱", name: "Albanien" },
  { code: "+383", flag: "🇽🇰", name: "Kosovo" },
  { code: "+389", flag: "🇲🇰", name: "Nordmakedonien" },
  { code: "+387", flag: "🇧🇦", name: "Bosnien" },
  { code: "+385", flag: "🇭🇷", name: "Kroatien" },
  { code: "+90", flag: "🇹🇷", name: "Turkiet" },
  { code: "+41", flag: "🇨🇭", name: "Schweiz" },
  { code: "+43", flag: "🇦🇹", name: "Österrike" },
  { code: "+32", flag: "🇧🇪", name: "Belgien" },
  { code: "+1", flag: "🇺🇸", name: "USA/Kanada" },
  { code: "+971", flag: "🇦🇪", name: "Förenade Arabemiraten" },
];
function internationalPhone(countryCode: string, value: string) {
  const compact = value.trim().replace(/[()\s-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  const digits = compact.replace(/\D/g, "");
  const countryDigits = countryCode.slice(1);
  if (digits.startsWith(countryDigits)) return `+${digits}`;
  return `${countryCode}${digits.replace(/^0+/, "")}`;
}
type BookingConfirmation = {
  ok: true;
  id: number;
  bookingId: string;
  status: string;
  price: number;
  trackingToken: string;
  emailSent: boolean;
  smsSent?: boolean;
  smsError?: string | null;
  booking: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    pickup: string;
    stop?: string;
    destination: string;
    pickupTime: string;
    passengers: number;
    vehicle: "standard" | "large";
    childSeats: number;
    petDetails?: PetSelection;
  };
};



function Address({
  label,
  value,
  set,
  t,
  kind,
  onUseLocation,
  onChooseMap,
  locating = false,
  compact = false,
}: {
  label: string;
  value: Place;
  set: (v: Place) => void;
  t: any;
  kind: "pickup" | "destination";
  onUseLocation?: () => void;
  onChooseMap?: () => void;
  locating?: boolean;
  compact?: boolean;
}) {
  const requestRef = useRef(0);
  const search = useRef(createAddressSearch());
  useEffect(()=>{void warmAddressSearch().catch(()=>{});},[]);
  const [hits, setHits] = useState<Place[]>([]),
    [open, setOpen] = useState(false),
    [searching, setSearching] = useState(false),
    [searchFailed, setSearchFailed] = useState(false),
    [streetNumberHint, setStreetNumberHint] = useState(""),
    [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    ++requestRef.current;
    const query = value.label.trim();
    if (
      value.lat !== undefined ||
      value.lng !== undefined ||
      query.length < 2
    ) {
      setHits([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }
    const key = query.toLocaleLowerCase("sv");
    const cached = cachedAddresses(query);
    if (cached) {
      setHits(cached);
      setActiveIndex(0);
      setSearching(false);
      setSearchFailed(cached.length === 0);
      setOpen(true);
      return;
    }
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    setHits([...knownAddresses(query),...matchingCachedAddresses(query)]);
    setOpen(true);
    setSearching(true);
    setSearchFailed(false);
    const timer = setTimeout(async () => {
      try {
        const result = await search.current(query, controller.signal);
        if (requestId !== requestRef.current) return;
        const places = Array.isArray(result) ? result : [];
        rememberAddresses(query, places);
        setHits(places);
        setActiveIndex(0);
        setSearchFailed(places.length === 0);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted && requestId === requestRef.current) {
          setHits([]);
          setSearchFailed(true);
          setOpen(true);
        }
      } finally {
        if (requestId === requestRef.current) setSearching(false);
      }
    }, 110);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value.label, value.lat, value.lng]);
  const choose = async (p: Place) => {
    const selection=++requestRef.current;
    try { p=await resolveAddress(p); } catch {setSearchFailed(true);return;}
    if(selection!==requestRef.current)return;
    setStreetNumberHint("");
    set(p);
    setOpen(false);
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    try {
      const r = await fetch(`/api/addresses?lat=${p.lat}&lng=${p.lng}`, {
        cache: "no-store",
      });
      const enriched: any = await r.json();
      if (r.ok && selection===requestRef.current)
        set({ ...p, ...enriched, id: p.id || enriched.id, label: p.label });
    } catch {}
  };
  const selected = Number.isFinite(value.lat) && Number.isFinite(value.lng);
  return (
    <div className={`addressField modernAddressField ${kind}`}>
      <div className={`modernAddressLabel ${compact ? "compactAddressLabel" : ""}`}>
        <span>{<AppText text={label} />}</span>
        {kind === "pickup" && (
          <div className="addressLocationActions">
            <button type="button" onClick={onChooseMap} aria-label="Välj hämtplats på karta"><AppText text={"Karta"} /></button>
          </div>
        )}
      </div>
      <div className={`modernAddressInput ${selected ? "selected" : ""}`}>
        {kind === "pickup" ? <button type="button" className="routePoint locationDot" onClick={onUseLocation} disabled={locating} aria-label={locating ? "Hämtar din position" : "Hämta min position"} title="Tryck för att hitta din position" aria-busy={locating}><Crosshair /></button> : <span className="routePoint" aria-hidden="true"><MapPin /></span>}
        {compact && value.label && <span className="addressInlineCaption">{<AppText text={label} />}</span>}
        <input
          aria-label={label}
          autoComplete="off"
          inputMode="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && (searching || hits.length > 0)}
          aria-controls={`${kind}-address-suggestions`}
          value={value.label}
          onChange={(e) => {
            setStreetNumberHint("");
            set({ label: e.target.value });
          }}
          onFocus={() => value.label.trim().length >= 2 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onKeyDown={(event) => {
            if (!open || !hits.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(hits.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              void choose(hits[activeIndex] || hits[0]);
            } else if (event.key === "Escape") setOpen(false);
          }}
          placeholder={compact ? label : t.addressPlaceholder}
        />
        {searching && <i className="addressSpinner" aria-label="Söker adress" />}
        {!searching && value.label && (
          <button
            type="button"
            className="addressClear"
            aria-label="Rensa adress"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              set({ label: "" });
              setHits([]);
              setOpen(false);
            }}
          >
            <X />
          </button>
        )}
      </div>
      {open && searching && (
        <div className="addressSearchStatus" role="status">
          <AppText text={"Söker medan du skriver…"} /></div>
      )}
      {open && hits.length > 0 && (
        <div className="suggestions modernSuggestions" id={`${kind}-address-suggestions`} role="listbox">
          <div className="suggestionHeading">
            <Search />
            <span>{<AppText text={hits.length} />} <AppText text={"snabba adressförslag"} /></span>
            <b><AppText text={"LIVE"} /></b>
          </div>
          {hits.some(p=>p.id?.startsWith("google:"))&&<small><AppText text={"Google Maps"} /></small>}
            {hits.map((p, i) => (
            <button
              type="button"
              key={(p.id || p.label) + i}
              className={i === activeIndex ? "active" : ""}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => choose(p)}
            >
              <MapPin />
              <span>
                <strong>{<AppText text={p.primary || p.label} />}</strong>
                {p.secondary && <small>{<AppText text={p.secondary} />}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && !searching && searchFailed && (
        <div className="addressSearchStatus addressSearchError" role="status">
          <AppText text={"Inga förslag ännu. Kontrollera gata och nummer eller försök igen."} /></div>
      )}
      {streetNumberHint && (
        <div className="addressSearchStatus addressSearchError" role="status">
          {<AppText text={streetNumberHint} />}
        </div>
      )}
    </div>
  );
}

const TILE_SIZE = 256;
function mapProject(lat: number, lng: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const safeLat = Math.max(-85, Math.min(85, lat));
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}
function mapUnproject(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
}

function PermissionFreeMap({
  initial,
  onMoveStart,
  onMoveEnd,
}: {
  initial: { lat: number; lng: number };
  onMoveStart: () => void;
  onMoveEnd: (point: { lat: number; lng: number }) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const drag = useRef<any>(null);
  const centerRef = useRef(initial);
  const [center, setCenter] = useState(initial);
  const [zoom, setZoom] = useState(14);
  const [size, setSize] = useState({ width: 560, height: 280 });

  useEffect(() => {
    const element = mapElement.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height)
        setSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const projected = mapProject(center.lat, center.lng, zoom);
  const firstX = Math.floor((projected.x - size.width / 2) / TILE_SIZE) - 1;
  const lastX = Math.floor((projected.x + size.width / 2) / TILE_SIZE) + 1;
  const firstY = Math.floor((projected.y - size.height / 2) / TILE_SIZE) - 1;
  const lastY = Math.floor((projected.y + size.height / 2) / TILE_SIZE) + 1;
  const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
  const count = 2 ** zoom;
  for (let x = firstX; x <= lastX; x += 1) {
    for (let y = firstY; y <= lastY; y += 1) {
      if (y < 0 || y >= count) continue;
      const wrappedX = ((x % count) + count) % count;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: size.width / 2 + x * TILE_SIZE - projected.x,
        top: size.height / 2 + y * TILE_SIZE - projected.y,
      });
    }
  }

  const finishDrag = (event: any) => {
    if (!drag.current) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    drag.current = null;
    onMoveEnd(centerRef.current);
  };

  return (
    <div
      ref={mapElement}
      className="pickupPickerMap permissionFreeMap"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          projected: mapProject(centerRef.current.lat, centerRef.current.lng, zoom),
        };
        onMoveStart();
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const point = mapUnproject(
          drag.current.projected.x - (event.clientX - drag.current.x),
          drag.current.projected.y - (event.clientY - drag.current.y),
          zoom,
        );
        centerRef.current = point;
        setCenter(point);
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      role="application"
      aria-label="Karta för att välja hämtplats"
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
      <div
        className="permissionFreeMapControls"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Zooma in"
          onClick={(event) => {
            event.stopPropagation();
            setZoom((value) => Math.min(18, value + 1));
          }}
        >+</button>
        <button
          type="button"
          aria-label="Zooma ut"
          onClick={(event) => {
            event.stopPropagation();
            setZoom((value) => Math.max(8, value - 1));
          }}
        >−</button>
      </div>
      <small className="permissionFreeMapCredit"><AppText text={"© OpenStreetMap"} /></small>
    </div>
  );
}

function PickupMapPicker({
  open,
  initial,
  onClose,
  onPick,
  onGps,
  gpsBusy,
  notice,
}: {
  open: boolean;
  initial: Place;
  onClose: () => void;
  onPick: (place: Place) => void;
  onGps: () => void;
  gpsBusy: boolean;
  notice: string;
}) {
  const requestRef = useRef(0);
  const search = useRef(createAddressSearch());
  useEffect(()=>{void warmAddressSearch().catch(()=>{});},[]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [status, setStatus] = useState(
    "Flytta kartan så att markören står där taxin ska hämta dig.",
  );

  useEffect(() => {
    if (open) return;
    requestRef.current += 1;
    setSelected(null);
    setStatus("Flytta kartan så att markören står där taxin ska hämta dig.");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const resolveCenter = async (center: { lat: number; lng: number }) => {
    const id = ++requestRef.current;
    setStatus("Hämtar adressen…");
    try {
      const response = await fetch(
        `/api/addresses?lat=${center.lat}&lng=${center.lng}`,
        { cache: "no-store" },
      );
      const place = await response.json();
      if (!response.ok || !place?.label) throw new Error("not_found");
      if (id !== requestRef.current) return;
      const exactPlace = { ...place, ...center, kind: "address" };
      setSelected(exactPlace);
      setStatus(exactPlace.label);
    } catch {
      if (id === requestRef.current)
        setStatus("Adressen kunde inte hittas här. Flytta markören lite och försök igen.");
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="pickupPickerOverlay" role="presentation">
      <section
        className="pickupPickerDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-picker-title"
      >
        <button className="pickupPickerClose" onClick={onClose} aria-label="Stäng">
          <X />
        </button>
        <small><AppText text={"HÄMTPLATS UTAN PLATSBEHÖRIGHET"} /></small>
        <h2 id="pickup-picker-title"><AppText text={"Välj var vi ska hämta dig"} /></h2>
        <p><AppText text={"Flytta kartan tills markören står på rätt port eller upphämtningsplats."} /></p>
        <div className="pickupPickerMapWrap">
          <PermissionFreeMap
            initial={
              Number.isFinite(initial.lat) && Number.isFinite(initial.lng)
                ? { lat: Number(initial.lat), lng: Number(initial.lng) }
                : { lat: 57.7089, lng: 11.9746 }
            }
            onMoveStart={() => {
              setSelected(null);
              setStatus("Släpp kartan för att hitta adressen…");
            }}
            onMoveEnd={resolveCenter}
          />
          <div className="pickupPickerPin" aria-hidden="true">
            <MapPin />
          </div>
        </div>
        <div className="pickupPickerAddress" aria-live="polite">
          <MapPin />
          <span>{<AppText text={status} />}</span>
        </div>
        {notice && <p className="pickupPickerNotice">{<AppText text={notice} />}</p>}
        <button
          className="pickupPickerConfirm"
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
        >
          <AppText text={"Använd denna hämtplats"} /></button>
        <div className="pickupPickerAlternatives">
          <button onClick={onGps} disabled={gpsBusy}>
            <Crosshair />
            {<AppText text={gpsBusy ? "Hämtar GPS…" : "Använd GPS istället"} />}
          </button>
          <button
            onClick={() => {
              onClose();
              window.setTimeout(
                () =>
                  (document.querySelector(".addressField input") as HTMLInputElement | null)?.focus(),
                50,
              );
            }}
          >
            <AppText text={"Skriv adress"} /></button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function HomeContent({
  initialOfficialPrices = [],
  view = "booking",
  bookingOnly = false,
}: {
  bookingOnly?: boolean;
  initialOfficialPrices?: OfficialPrice[];
  view?: "booking" | "prices" | "about";
}) {
  const [corporateOptions,setCorporateOptions]=useState<any[]>([]);
  const [companyId,setCompanyId]=useState(''),[companyReference,setCompanyReference]=useState(''),[companyError,setCompanyError]=useState('');
  const [companyPriceError,setCompanyPriceError]=useState('');
  const [appMode, setAppMode] = useState(bookingOnly);
  const [selectedTrip,setSelectedTrip]=useState<string|null>(null);
  const [savedTrips,setSavedTrips]=useState<GuestBooking[]>([]);
  const [showSavedTrips,setShowSavedTrips]=useState(false);
  const [savedTripsPage,setSavedTripsPage]=useState(0);
  const [saveTripNotice,setSaveTripNotice]=useState("");
  const [extrasSeen,setExtrasSeen]=useState(false);
  useEffect(()=>{setSavedTrips(readGuestBookings());},[]);
  useEffect(()=>{if(selectedTrip)window.scrollTo({top:0,behavior:"instant"});},[selectedTrip]);
  const [copyNotice,setCopyNotice]=useState("");
  const [appFilmPlaying,setAppFilmPlaying]=useState(true);
  const [appMenu,setAppMenu]=useState(false),[expandedSheet,setExpandedSheet]=useState(false);
  useEffect(() => {
    const detectApp = () => {
      if (!bookingOnly && !isCustomerAppBrowser()) return;
      setAppMode(true);
      // Keep app mode on return from My trips, payment and rebooking links.
      const url = new URL(window.location.href);
      if (url.searchParams.get("native") !== "customer") {
        url.searchParams.set("native", "customer");
        window.history.replaceState(window.history.state, "", url);
      }
    };
    detectApp();
    // Some native builds inject the bridge after React mounts.
    const timer = window.setTimeout(detectApp, 1000);
    window.addEventListener("pageshow", detectApp);
    return () => { window.clearTimeout(timer); window.removeEventListener("pageshow", detectApp); };
  }, [bookingOnly]);
  const [pet,setPet]=useState<PetSelection>(null);
  const [from, setFrom] = useState<Place>({ label: "" }),
    [stop, setStop] = useState<Place>({ label: "" }),
    [stopEnabled, setStopEnabled] = useState(false),
    [to, setTo] = useState<Place>({ label: "" }),
    [time, setTime] = useState("now"),
    [vehicle, setVehicle] = useState("standard"),
    [passengers, setPassengers] = useState(1),
    [seats, setSeats] = useState(0),
    [flight, setFlight] = useState(""),
    [extraMessage, setExtraMessage] = useState(""),
    [paymentMethod,setPaymentMethod] = useState("Kort"),
    [name, setName] = useState(""),
    [countryCode, setCountryCode] = useState("+46"),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [createAccount, setCreateAccount] = useState(false),
    [accountPassword, setAccountPassword] = useState(""),
    [accountPasswordConfirm, setAccountPasswordConfirm] = useState(""),
    [accountNotice, setAccountNotice] = useState(""),
    [step, setStep] = useState(1),
    [done, setDone] = useState<BookingConfirmation | null>(null),
    [busy, setBusy] = useState(false),
    [paymentBusy, setPaymentBusy] = useState(false),
    [error, setError] = useState(""),
    [onlineCount, setOnlineCount] = useState(0),
    [onlineCars, setOnlineCars] = useState<PublicOnlineCar[]>([]),
    [priceSearch, setPriceSearch] = useState(""),
    [officialPrices, setOfficialPrices] = useState<OfficialPrice[]>(initialOfficialPrices),
    [selectedArea, setSelectedArea] = useState<OfficialPrice | null>(null),
    [menu, setMenu] = useState(false),
    [locating, setLocating] = useState(false),
    [locationNotice, setLocationNotice] = useState(""),
    [locationPickerOpen, setLocationPickerOpen] = useState(false),
    [quoteData, setQuoteData] = useState<any>(null),
    [quoteLoading, setQuoteLoading] = useState(false),
    [routeDragOffset, setRouteDragOffset] = useState(0),
    [routeReordering, setRouteReordering] = useState(false),
    [unusedLanguage] = useState("sv");
  const {lang,setLang}=useAppLanguage();
  const [showAllPrices, setShowAllPrices] = useState(false);
  const [priceRegionFilter, setPriceRegionFilter] = useState("Alla");
  const { client: authClient, session, loading: sessionLoading } = useSupabaseSession();
  useEffect(()=>{
    let alive=true;setCorporateOptions([]);setCompanyId('');
    const requested=new URLSearchParams(window.location.search).get('company');
    if(!session){if(!sessionLoading&&requested)setCompanyError('Logga in via Företagsbokning för att boka på företagets faktura.');return;}
    fetch('/api/company-portal',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);return j;}).then(j=>{if(!alive)return;const options=j.access.filter((a:any)=>a.state==='approved'&&a.company?.approved);setCorporateOptions(options);if(requested){if(options.some((a:any)=>a.company.id===requested)){setCompanyId(requested);setPaymentMethod('Faktura');setCompanyError('');}else setCompanyError('Du behöver godkänd behörighet för detta företag. Öppna Företagsbokning för att ansöka.');}}).catch(e=>{if(alive&&requested)setCompanyError(e.message);});
    return()=>{alive=false;};
  },[session?.access_token,sessionLoading]);
  const rebookApplied = useRef(false);
  const [rebookNotice, setRebookNotice] = useState("");
  const [rebookLoading, setRebookLoading] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const bookingId = query.get("rebook");
    if (!bookingId || sessionLoading || rebookApplied.current) return;
    if (!session) { setRebookNotice("Logga in på Mina resor och välj Boka igen eller Boka återresa där."); return; }
    const controller = new AbortController();
    setRebookLoading(true);
    fetch("/api/customer-bookings", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload: any = await response.json();
        if (!response.ok) throw new Error(payload.error || "Resan kunde inte hämtas.");
        const booking = payload.bookings?.find((item: any) => item.id === bookingId);
        if (!booking) throw new Error("Resan hittades inte i Mina resor.");
        const details = rebookDetails(booking, query.get("direction") === "return");
        if (controller.signal.aborted) return;
        setFrom(details.from); setTo(details.to); setStop(details.stop || { label: "" }); setStopEnabled(Boolean(details.stop));
        setPassengers(details.passengers); setVehicle(details.vehicle); setSeats(details.seats); setPet(booking.petDetails||null);
        setTime(""); setFlight(""); setExtraMessage(""); setQuoteData(null); setStep(1);
        setRebookNotice(query.get("direction") === "return" ? "Återresan är förberedd med omvända adresser. Välj en ny tid och kontrollera tillvalen." : "Resan är förberedd. Välj en ny tid och kontrollera adresser och tillval.");
        rebookApplied.current = true;
      }).catch(reason => { if (!controller.signal.aborted) setRebookNotice(reason.message || "Resan kunde inte hämtas."); })
      .finally(() => { if (!controller.signal.aborted) setRebookLoading(false); });
    return () => controller.abort();
  }, [sessionLoading, session?.access_token]);
  const [quoteRefresh,setQuoteRefresh]=useState(0);
  const [quoteError, setQuoteError] = useState(false);
  const quoteRequest = useRef(0),
    bookingPrefillApplied = useRef(false),
    routeSwapGesture = useRef<{ pointerId: number; startY: number } | null>(null);
  const baseMessages = messages[lang] || messages.sv;
  const t =
    lang === "sv"
      ? {
          ...baseMessages,
          flight: "Flygnummer",
          fetchingPrice: "Beräknar pris…",
          roadDistance: "verklig vägsträcka",
          dispatchSees: "Trafikledningen ser resan direkt.",
          errNoPrice:
            "Priset kunde inte beräknas. Kontrollera adresserna eller kontakta oss.",
        }
      : baseMessages;
  const language = languages.find((x) => x.code === lang) || languages[0];
  const routeNeedsAddressSelection = [
    from,
    ...(stopEnabled ? [stop] : []),
    to,
  ].some(
    (place) =>
      place.label.trim().length >= 3 &&
      !isLandvetterAirport(place.label, place.id) &&
      !place.id &&
      !place.area &&
      place.kind !== "price-zone" &&
      (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)),
  );
  useEffect(() => {
    if(view !== "booking")return;
    const hash=window.location.hash;
    if(hash === "#priser")window.location.replace("/priser-omraden#priser");
    else if(hash === "#service-request" || hash === "#bilar")window.location.replace(`/om-avenyn-taxi${hash}`);
  }, [view]);
  useEffect(() => {
    if (session?.user.email) setEmail(session.user.email);
  }, [session?.user.email]);
  useEffect(() => {
    fetch("/api/prices?catalog=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setOfficialPrices(Array.isArray(j.fixedPrices) ? j.fixedPrices : []),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (bookingPrefillApplied.current) return;
    bookingPrefillApplied.current = true;
    const query = new URLSearchParams(window.location.search),
      intent = query.get("booking"),
      pickup = query.get("pickup")?.trim(),
      dropoff = query.get("dropoff")?.trim();
    const airport: Place = { ...LANDVETTER_AIRPORT, kind: "airport" };
    if (intent === "from-landvetter") setFrom(airport);
    else if (intent === "to-landvetter") setTo(airport);
    if (pickup && intent !== "from-landvetter")
      setFrom(
        pickup.toLocaleLowerCase("sv") === "göteborg centralstation"
          ? { ...GOTHENBURG_CENTRAL }
          : { label: pickup },
      );
    if (dropoff && intent !== "to-landvetter") setTo({ label: dropoff });
    if (window.location.hash === "#booking-form") {
      const jump = () =>
        document
          .getElementById("booking-form")
          ?.scrollIntoView({ block: "start", behavior: "auto" });
      requestAnimationFrame(jump);
      window.setTimeout(jump, 250);
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = language.dir;

  }, [lang, language.dir]);
  useEffect(() => {
    try {
      let visitorId = localStorage.getItem("avenyn-visitor-id");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("avenyn-visitor-id", visitorId);
      }
      const day = new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Europe/Stockholm",
        }).format(new Date()),
        key = `avenyn-visit-${day}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitorId, path: location.pathname }),
      }).catch(() => {});
    } catch {}
  }, []);
  useEffect(() => {
    let stopped=false,inFlight=false;const controller=new AbortController();
    const load=async()=>{if(stopped||inFlight||document.hidden)return;inFlight=true;try{
      const response=await fetch('/api/locations',{cache:'no-store',signal:controller.signal});if(!response.ok)return;
      const j=await response.json();if(stopped)return;const cars=Array.isArray(j.cars)?j.cars:[];setOnlineCars(cars);setOnlineCount(cars.length||Number(j.count)||0);
    }catch{}finally{inFlight=false}};
    void load();const timer=setInterval(load,1000);document.addEventListener('visibilitychange',load);
    return()=>{stopped=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',load)};
  }, []);
  useEffect(() => {
    const requestId = ++quoteRequest.current,
      requestKey = `quote-${requestId}-${Date.now()}`;
    setQuoteError(false);
    if (
      from.label.trim().length < 3 ||
      to.label.trim().length < 3 ||
      (stopEnabled && stop.label.trim().length < 3)
    ) {
      setQuoteData(null);
      setQuoteLoading(false);
      return;
    }
    if (routeNeedsAddressSelection) {
      setQuoteLoading(true);
      return;
    }
    setQuoteLoading(true);setCompanyPriceError('');
    const controller = new AbortController(),
      timer = setTimeout(() => {
        const q = new URLSearchParams({
          pickup: from.label,
          destination: to.label,
          requestKey,
        });
        if (from.id) q.set("pickupId", from.id);
        if (to.id) q.set("destinationId", to.id);
        if (stopEnabled) {
          q.set("stop", stop.label);
          if (stop.id) q.set("stopId", stop.id);
          const stopArea = stop.components?.district || stop.area;
          if (stopArea) q.set("stopArea", stopArea);
          if (stop.lat && stop.lng) {
            q.set("stopLat", String(stop.lat));
            q.set("stopLng", String(stop.lng));
          }
        }
        const pickupArea = from.components?.district || from.area,
          dropoffArea = to.components?.district || to.area;
        if (pickupArea) q.set("pickupArea", pickupArea);
        if (dropoffArea) q.set("destinationArea", dropoffArea);
        if (from.lat && from.lng) {
          q.set("pickupLat", String(from.lat));
          q.set("pickupLng", String(from.lng));
        }
        if (to.lat && to.lng) {
          q.set("destinationLat", String(to.lat));
          q.set("destinationLng", String(to.lng));
        }
        if (time) q.set("pickupTime", time);
        q.set("carType",vehicle);q.set("childSeats",String(seats));if(companyId)q.set("companyId",companyId);
        fetchPriceQuote(`/api/prices?${q}`, requestKey, controller.signal,15000,companyId&&session?{Authorization:`Bearer ${session.access_token}`}:{})
          .then((data) => {
            if (
              requestId === quoteRequest.current &&
              data?.requestKey === requestKey
            )
              setQuoteData(data);
          })
          .catch((e) => {
            if(companyId&&!controller.signal.aborted)setCompanyPriceError(e.message);
            if (
              requestId === quoteRequest.current &&
              !controller.signal.aborted
            ) {
              setQuoteData(null);
              setQuoteError(true);
            }
          })
          .finally(() => {
            if (requestId === quoteRequest.current && !controller.signal.aborted) setQuoteLoading(false);
          });
      }, 80);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [from, routeNeedsAddressSelection, stop, stopEnabled, to, time,vehicle,seats,quoteRefresh,companyId,session?.access_token]);
  const isAirportRoute =
    isLandvetterAirport(from.label, from.id) ||
    isLandvetterAirport(to.label, to.id);
  const fixedQuote = quoteData?.quote;
  const showQuoteLoading = quoteLoading;
  const fixedPriceCaption =
    fixedQuote?.companyPrice ? `Avtalat företagspris · inklusive moms` : fixedQuote?.type === "fixed" && fixedQuote?.area
      ? `Fastpris ${fixedQuote.area} ↔ Landvetter Airport${stopEnabled ? " · stoppet ingår i totalen" : ""}`
      : fixedQuote?.type === "fixed"
        ? `Fastpris till/från Landvetter${stopEnabled ? " · stoppet ingår i totalen" : ""}`
      : fixedQuote?.type === "metered"
        ? `${fixedQuote.distanceKm.toFixed(1)} km · ${Math.round(fixedQuote.durationMinutes)} min · ${fixedQuote.bookingType === "prebooking" ? "förbokning" : "direktbokning"}`
        : fixedQuote?.type === "estimated"
          ? `Prisförslag · cirka ${fixedQuote.distanceKm.toFixed(1)} km · ${Math.round(fixedQuote.durationMinutes)} min`
        : "";
  const largeSurcharge = quoteData?.settings?.largeVehicleSurcharge ?? 300,
    childSurcharge = quoteData?.settings?.childSeatSurcharge ?? 100;
  const price = fixedQuote ? Number(fixedQuote.totalPrice) : 0;
  const swapPickupAndStop = () => {
    if (!stopEnabled || !from.label.trim() || !stop.label.trim()) return;
    const previousPickup = from;
    setFrom(stop);
    setStop(previousPickup);
    setQuoteLoading(true);
    setError("");
  };
  const beginRouteSwap = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!from.label.trim() || !stop.label.trim()) return;
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
    if (!cancelled && Math.abs(event.clientY - gesture.startY) >= 32) swapPickupAndStop();
  };
  const [gpsPoint,setGpsPoint]=useState<{lat:number;lng:number}>();
  const [locateRequest,setLocateRequest]=useState(0);
  const [pickupFocusRequest,setPickupFocusRequest]=useState(0);
  const autoLocated=useRef(false);
  const pickupRef=useRef(from);pickupRef.current=from;
  const gpsPickup=useRef<Place|null>(null);
  const bookingStepRef=useRef(step);bookingStepRef.current=step;
  useEffect(()=>{if(gpsPickup.current&&from!==gpsPickup.current){gpsPickup.current=null;setLocationNotice('Hämtplatsen är vald. Tryck på positionsknappen för att använda din position igen.');}},[from]);
  const lastGpsAddress=useRef<{lat:number;lng:number;at:number}|null>(null);
  const locate = async (automatic=false) => {
    const originalPickup=pickupRef.current;

    if (!navigator.geolocation) {
      setError(t.errGeoUnsupported);
      return;
    }
    setError("");
    setLocating(true);
    setLocationNotice(t.geoAllow);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude,
          lng = p.coords.longitude;
        setGpsPoint({lat,lng});setLocateRequest(v=>v+1);
        if(bookingStepRef.current!==1 || pickupRef.current!==originalPickup || (automatic&&originalPickup.label)){setLocating(false);setLocationNotice("");return;}
        const pendingPickup={ label: t.loadingAddress, lat, lng };
        gpsPickup.current=pendingPickup;pickupRef.current=pendingPickup;setFrom(pendingPickup);
        try {
          const r = await fetch(`/api/addresses?lat=${lat}&lng=${lng}`, {
              cache: "no-store",
            }),
            place = await r.json();
          if (!r.ok || !place?.label) throw new Error("address_not_found");
          if(bookingStepRef.current!==1||pickupRef.current!==pendingPickup){setLocating(false);return;}
          const resolved={ ...place, lat, lng };gpsPickup.current=resolved;pickupRef.current=resolved;setFrom(resolved);
          lastGpsAddress.current={lat,lng,at:Date.now()};
          setLocationNotice(t.geoFound);
          setLocationPickerOpen(false);
        } catch {
          if(bookingStepRef.current!==1||pickupRef.current!==pendingPickup){setLocating(false);return;}
          const unresolved={label:"",lat,lng};gpsPickup.current=unresolved;pickupRef.current=unresolved;setFrom(unresolved);
          setLocationNotice(t.geoFailed);
          setError(t.geoFailed);
        }
        setLocating(false);
      },
      (e) => {
        setLocating(false);
        const message = e.code === 1 ? t.geoDenied : t.geoUnavailable;
        setLocationNotice(message);
        setError(message);

      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  };
  useEffect(()=>{if(appMode&&!autoLocated.current){autoLocated.current=true;void locate(true);}},[appMode]);
  useEffect(()=>{
    if(!appMode||step!==1||!navigator.geolocation)return;
    let alive=true,busy=false;const abort=new AbortController();
    const watch=navigator.geolocation.watchPosition(async position=>{
      if(!alive||document.visibilityState!=='visible'||position.coords.accuracy>100||Date.now()-position.timestamp>30000)return;
      const lat=position.coords.latitude,lng=position.coords.longitude;
      setGpsPoint({lat,lng});
      const original=pickupRef.current;
      // A manual address, saved location or airport selection always wins over GPS.
      if(busy||!gpsPickup.current||original!==gpsPickup.current)return;
      const last=lastGpsAddress.current;
      const meters=last?Math.hypot((lat-last.lat)*111320,(lng-last.lng)*111320*Math.cos(lat*Math.PI/180)):Infinity;
      if(last&&(meters<35||Date.now()-last.at<10000))return;
      busy=true;lastGpsAddress.current={lat,lng,at:Date.now()};
      try{
        const response=await fetch(`/api/addresses?lat=${lat}&lng=${lng}`,{cache:'no-store',signal:abort.signal});
        const place=await response.json();
        if(!response.ok||!place?.label)throw new Error('address_not_found');
        if(!alive||bookingStepRef.current!==1||pickupRef.current!==original)return;
        const resolved={...place,lat,lng};gpsPickup.current=resolved;pickupRef.current=resolved;setFrom(resolved);
        setLocationNotice('Hämtadressen följer din position.');
      }catch{if(alive&&pickupRef.current===original)setLocationNotice('Adressen kunde inte uppdateras. Kontrollera hämtplatsen eller tryck på positionsknappen.');}
      finally{busy=false;}
    },error=>{if(alive&&error.code===1)setLocationNotice('Tillåt platsåtkomst för att följa din position. Du kan också skriva hämtadressen.');},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
    return()=>{alive=false;abort.abort();navigator.geolocation.clearWatch(watch);};
  },[appMode,step]);
  useEffect(()=>{if(appMode)document.getElementById("boka")?.scrollTo({top:0,behavior:"instant"});},[step,appMode]);
  const customerRoad=useCustomerRoute(appMode,from,to,stopEnabled?stop:undefined,time);
  const pickupApproach=usePickupApproach(appMode&&step===1,gpsPoint,from);
  const [bookingMapLeg,setBookingMapLeg]=useState<'pickup'|'trip'>('pickup');
  const [bookingOpening,setBookingOpening]=useState(false);
  const [customerCinemaVisible,setCustomerCinemaVisible]=useState(true);

  const showPickupLeg=bookingMapLeg==='pickup'&&pickupApproach.available&&!pickupApproach.nearby;

  const validateTrip = () => {
    const invalid = (message: string) => { setError(message); return false; };
    setError("");
    if (!from.label || !to.label) return invalid(t.errAddresses);
    if (routeNeedsAddressSelection)
      return invalid(
        "Välj den fullständiga adressen i listan och vänta på det nya priset.",
      );
    if (quoteLoading)
      return invalid("Vänta tills det nya priset har räknats ut.");
    const incompletePlace = [from, ...(stopEnabled ? [stop] : []), to].find(
      (place) =>
        !isLandvetterAirport(place.label, place.id) &&
        (!Number.isFinite(place.lat) ||
          !Number.isFinite(place.lng)),
    );
    if (incompletePlace)
      return invalid(
        "Välj adressen eller platsen i listan, eller välj hämtplats på kartan.",
      );
    if (!fixedQuote)
      return invalid(
        quoteLoading
          ? t.fetchingPrice
          : "Priset kunde inte beräknas. Försök igen.",
      );
    if (!time) return invalid(t.errTime);
    if (time !== "now" && (!Number.isFinite(new Date(time).getTime()) || new Date(time).getTime() <= Date.now()))
      return invalid("Välj ett datum och en tid framåt i tiden för din förbokning.");
    return true;
  };
  const submit = async () => {
    if (busy || !validateTrip()) return;
    const bookingEmail = (session?.user.email || email).trim().toLowerCase();
    const bookingPhone = internationalPhone(countryCode, phone);
    if (!name.trim() || !phone.trim())
      return setError("Ange namn och mobilnummer.");
    if (!/^\+[1-9]\d{7,14}$/.test(bookingPhone))
      return setError("Ange ett giltigt mobilnummer med rätt landskod.");
    if (bookingEmail && !/^\S+@\S+\.\S+$/.test(bookingEmail)) return setError(t.errEmail);
    if (createAccount && !session) {
      if(!bookingEmail)return setError("E-post behövs bara om du vill skapa ett konto.");
      if (accountPassword.length < 8)
        return setError("Lösenordet måste innehålla minst 8 tecken.");
      if (accountPassword !== accountPasswordConfirm)
        return setError("Lösenorden är inte likadana.");
      if (!authClient)
        return setError("Kundkontot kunde inte öppnas. Försök igen.");
    }
    if(new URLSearchParams(window.location.search).get('company')&&!companyId)return setError('Välj ett godkänt företag eller öppna Boka privat för en privat resa.');
    if(companyId&&(!session||!corporateOptions.some(a=>a.company.id===companyId)))return setError('Logga in och välj ditt godkända företag.');
    if(companyId&&corporateOptions.find(a=>a.company.id===companyId)?.company.reference_required&&!companyReference.trim())return setError('Ange företagets beställarreferens eller kostnadsställe.');
    setBusy(true);
    setError("");
    setAccountNotice("");
    try {
      const r = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", ...(companyId&&session?{Authorization:`Bearer ${session.access_token}`}:{}) },
          body: JSON.stringify({
            companyId:companyId||undefined,companyReference,
          policyVersion:"2026-10-02-booking-confirmation",
            quoteToken:fixedQuote?.quoteToken,
            pickup: from.label,
            destination: to.label,
            stop: stopEnabled ? stop.label : null,
            stopId: stopEnabled ? stop.id : null,
            stopArea: stopEnabled ? stop.components?.district || stop.area : null,
            stopLat: stopEnabled ? stop.lat : null,
            stopLng: stopEnabled ? stop.lng : null,
            pickupId: from.id,
            destinationId: to.id,
            pickupArea: from.components?.district || from.area,
            destinationArea: to.components?.district || to.area,
            pickupLat: from.lat,
            pickupLng: from.lng,
            destinationLat: to.lat,
            destinationLng: to.lng,
            paymentMethod,
            petDetails:pet,
            customerName: name.trim(),
            customerPhone: bookingPhone,
            customerEmail: bookingEmail,
            pickupTime: time,
            passengers,
            vehicle,
            childSeats: seats,
            flightNumber: flight,
            extraMessage,
            locale: lang,
          }),
        }),
        j:any = await r.json();
      if (!r.ok) {
        if(j.refreshQuote){setQuoteRefresh(n=>n+1);setStep(1);}
        setError(j.error || t.errSend);
        return;
      }
      if (createAccount && !session && authClient) {
        const { data: accountData, error: accountError } =
          await authClient.auth.signUp({
            email: bookingEmail,
            password: accountPassword,
            options: { emailRedirectTo: `${window.location.origin}/customer` },
          });
        if (accountError)
          setAccountNotice(
            "Bokningen är klar, men kontot kunde inte skapas. Öppna Mina resor och försök igen.",
          );
        else if (!accountData.session)
          setAccountNotice(
            "Kontot är skapat. Bekräfta länken som skickats till din e-post för att öppna Mina resor.",
          );
        else setAccountNotice("Kontot är skapat och du är nu inloggad.");
      }
      setDone(j);
      setStep(3);
      if(j.trackingToken){const saved=saveGuestBooking({token:j.trackingToken,number:String(j.id),pickupTime:String(j.booking?.pickupTime||""),savedAt:Date.now()});setSavedTrips(saved.rows);setSaveTripNotice(saved.persisted?"Resan finns i Mina bokningar på den här enheten.":"Resan är bokad, men kan inte sparas på enheten. Kopiera bokningslänken.");}
    } catch {
      setError(t.errSend);
    } finally {
      setBusy(false);
    }
  };
  const bookReturn = () => {
    const previousFrom = from;
    setFrom(to);
    setTo(previousFrom);
    setTime("");
    setFlight("");
    setExtraMessage("");
    setRebookNotice("Återresan är förberedd. Välj datum och tid och kontrollera stopp och tillval.");
    setQuoteData(null);
    setDone(null);
    setError("");
    setStep(1);
    setTimeout(
      () =>
        document
          .getElementById("booking-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  const bookNew = () => {
    setFlight(""); setExtraMessage(""); setSeats(0); setPet(null); setRebookNotice("");
    setFrom({ label: "" });
    setStop({ label: "" });
    setStopEnabled(false);
    setTo({ label: "" });
    setTime("now");
    setQuoteData(null);
    setDone(null);
    setError("");
    setStep(1);
    setTimeout(
      () =>
        document
          .getElementById("booking-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  const payNow = async () => {
    if (!done) return;
    setPaymentBusy(true);
    setError("");
    try {
      const r = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bookingId: done.bookingId,
            trackingToken: done.trackingToken,
            source: "customer",
          }),
        }),
        j:any = await r.json();
      if (!r.ok || !j.url)
        throw new Error(j.error || "Betalningen kunde inte startas.");
      location.assign(j.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Betalningen kunde inte startas.",
      );
      setPaymentBusy(false);
    }
  };
  const normalizedSearch = priceSearch.trim().toLocaleLowerCase("sv");
  const priceMatches =
    normalizedSearch.length >= 3
      ? officialPrices.filter((row) =>
          row.locality.toLocaleLowerCase("sv").includes(normalizedSearch),
        )
      : [];
  const availablePriceRegions = [
    "Alla",
    ...Array.from(new Set(officialPrices.map((row) => row.region))).filter(
      Boolean,
    ),
  ];
  const filteredCatalogPrices = officialPrices
    .filter(
      (row) => priceRegionFilter === "Alla" || row.region === priceRegionFilter,
    )
    .sort((a, b) => a.locality.localeCompare(b.locality, "sv"));
  const displayedCatalogPrices = showAllPrices
    ? filteredCatalogPrices
    : filteredCatalogPrices.slice(0, 9);
  const popularAirportNames = ["avenyn", "central", "mölndal", "partille", "backa", "majorna", "hisingen", "linné"];
  const popularAirportPrices = officialPrices
    .filter((row) => row.active && Number.isFinite(row.price) && row.price > 0)
    .map((row) => ({ row, rank: popularAirportNames.findIndex((name) => row.locality.toLocaleLowerCase("sv").includes(name)) }))
    .sort((a, b) => (a.rank < 0 ? 99 : a.rank) - (b.rank < 0 ? 99 : b.rank) || a.row.locality.localeCompare(b.row.locality, "sv"))
    .slice(0, 8).map(({ row }) => row);
  const nearbyQuoteAreas = [
    { name: "Mölndal", href: "/taxi-molndal", text: "Resor mellan Mölndal, Göteborg och vidare till din destination." },
    { name: "Partille", href: "/taxi-partille", text: "Planera hämtning i Partille, Sävedalen eller Jonsered." },
    { name: "Kungsbacka", href: "/taxi-goteborg-kungsbacka", text: "Förfrågan för resor mellan Göteborg och Kungsbacka." },
    { name: "Kungälv", href: "/taxi-kungalv", text: "Ange adresser och önskad tid för resan till eller från Kungälv." },
    { name: "Lerum", href: "/taxi-lerum", text: "Förboka din planerade resa mellan Lerum och Göteborg." },
    { name: "Alingsås", href: "/taxi-alingsas", text: "Få offert för en resa till stationen, ett hotell eller en annan adress." },
    { name: "Borås", href: "/taxi-boras", text: "Skicka en prisförfrågan för en längre resa till eller från Borås." },
    { name: "Stenungsund", href: "/taxi-goteborg-stenungsund", text: "Planera resa mellan Göteborg och Stenungsund med dina önskemål." },
  ];
  const airportPlace: Place = { ...LANDVETTER_AIRPORT, kind: "airport" };
  const centralPlace: Place = { ...GOTHENBURG_CENTRAL };
  const prepareZoneBooking = (row: OfficialPrice) => {
    if(view !== "booking"){window.location.href=`/?booking=to-landvetter&pickup=${encodeURIComponent(row.locality)}#booking-form`;return;}
    setFrom({ label: row.locality, area: row.locality, kind: "price-zone" });
    setTo(airportPlace);
    setQuoteData(null);
    setSelectedArea(row);
    setStep(1);
    document.getElementById("boka")?.scrollIntoView({ behavior: "smooth" });
  };
  const selectPriceArea = (row: OfficialPrice) => {
    setSelectedArea(row);
    if (window.innerWidth < 900)
      requestAnimationFrame(() =>
        document
          .getElementById("selected-city-price")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
  };
  if(selectedTrip)return <div className="customerEmbeddedTrip"><header className="embeddedTripBar"><button type="button" onClick={()=>setSelectedTrip(null)}>← Tillbaka till bokningen</button><span>Avenyn Taxi</span></header><TrackClient key={selectedTrip} token={selectedTrip} embedded/></div>;
  return (
    <main className={appMode ? "customerSite customerBookingApp restoredCustomerApp" : (view === "booking" ? "customerSite homeRefresh" : "customerSite")} dir={language.dir}>
      {appMode&&<CustomerMobileFit/>}
      {lang === "sv" && view === "prices" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqSchema) }}
        />
      )}
      {!appMode && <QuoteRequestForm />}
      {appMode && <><header className="bookingAppHeader"><button type="button" aria-label="Meny" aria-expanded={appMenu} onClick={()=>setAppMenu(!appMenu)}><Menu/></button><div className="bookingHeaderRoute" aria-label="Tid och avstånd">
          {pickupApproach.available&&!pickupApproach.nearby?<nav aria-label="Välj körväg på kartan"><button type="button" aria-pressed={showPickupLeg} onClick={()=>setBookingMapLeg('pickup')}>Du → A</button><button type="button" aria-pressed={!showPickupLeg} onClick={()=>setBookingMapLeg('trip')}>Resan A → B</button></nav>:<span>{pickupApproach.nearby?'Du är vid A · Resan A → B':'Hämtplats A → Destination B'}</span>}
          <strong role="status">{showPickupLeg?(pickupApproach.route?`Ca ${pickupApproach.route.minutes} min · ${pickupApproach.route.kilometers.toLocaleString('sv-SE',{maximumFractionDigits:1,minimumFractionDigits:1})} km`:pickupApproach.failed?'Körväg saknas':'Beräknar till A…'):(customerRoad.route?`Ca ${customerRoad.route.minutes} min · ${customerRoad.route.kilometers.toLocaleString('sv-SE',{maximumFractionDigits:1,minimumFractionDigits:1})} km`:customerRoad.failed?'Körväg saknas':'Välj hämtning och destination')}</strong>
          {(showPickupLeg?pickupApproach.route:customerRoad.route)&&<small>{(showPickupLeg?pickupApproach.route:customerRoad.route)?.trafficAvailable?'Beräknad körtid med trafik':'Beräknad körtid · utan live-trafik'}</small>}
        </div><img className="bookingHeaderBrand" src="/avenyn-logo-optimized.webp" width="32" height="32" alt="Avenyn Taxi"/></header>{appMenu&&<nav className="customerAppMenu" aria-label="Appmeny"><button onClick={()=>setAppMenu(false)}>Stäng ×</button><a href="tel:+46700315315">Ring oss · 0700 315 315</a><button className="importantBookingShortcut" type="button" onClick={()=>{setShowSavedTrips(true);setExpandedSheet(true);setAppMenu(false);requestAnimationFrame(()=>document.getElementById("booking-form")?.scrollIntoView({block:"start"}));}}>Mina bokningar ({savedTrips.length})</button><button type="button" aria-pressed={appFilmPlaying} onClick={()=>setAppFilmPlaying(v=>!v)}>{appFilmPlaying?"Pausa bakgrundsfilm":"Spela bakgrundsfilm"}</button><a href="/foretag">Boka som företag / Bli företagskund</a><a href="/customer?portal=1">Mitt konto (valfritt)</a><a href="/bokningsvillkor">Bokningsvillkor</a><label>Språk<select value={lang} onChange={e=>setLang(e.target.value)}>{languages.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></label></nav>}<div className="customerAppMap"><CustomerTripMap key={showPickupLeg?"pickup-leg":"trip-leg"} stopLocation={!showPickupLeg&&stopEnabled&&Number.isFinite(stop.lat)&&Number.isFinite(stop.lng)?{lat:Number(stop.lat),lng:Number(stop.lng)}:undefined} routePath={showPickupLeg?pickupApproach.route?.path:customerRoad.route?.path} bookingMode pickupFocusRequest={pickupFocusRequest} userLocation={gpsPoint} locateRequest={locateRequest} cars={[]} customerLocation={Number.isFinite(from.lat)&&Number.isFinite(from.lng)?{lat:Number(from.lat),lng:Number(from.lng)}:undefined} destinationLocation={!showPickupLeg&&Number.isFinite(to.lat)&&Number.isFinite(to.lng)?{lat:Number(to.lat),lng:Number(to.lng)}:undefined}/><button className="customerAppLocate" aria-label="Zooma in på hämtplatsen" disabled={locating} onClick={()=>{if(Number.isFinite(from.lat)&&Number.isFinite(from.lng))setPickupFocusRequest(v=>v+1);else void locate();}}><Crosshair/></button></div></>}

      {!appMode && <header className="customerHeader">
        <a className="customerBrand" href="/">
          <img
            src="/avenyn-logo-optimized.webp"
            width="54"
            height="54"
            alt="Avenyn Taxi"
          />
          <div>
            <b><AppText text={"AVENYN"} /></b>
            <span><AppText text={"TAXI"} /></span>
          </div>
        </a>
        <nav
          className={menu ? "show" : ""}
          aria-label={lang === "sv" ? "Huvudmeny" : "Main menu"}
        >
          <a className="customerNavCta" href="/#booking-form">
            {<AppText text={t.navBook} />}
          </a>
          <a className="customerNavPrice" href="/priser-omraden#priser">
            {<AppText text={t.navPrices} />}
          </a>
          <details className="headerMore"><summary><AppText text="Mer" /></summary><div><a href="/om-avenyn-taxi"><AppText text="Om oss och kontakt" /></a><a href="/taxi-omraden"><AppText text="Alla områden" /></a><a href="/bud-goteborg"><AppText text="Taxibud och budtransport" /></a><a href="/foretagstaxi-goteborg"><AppText text="Företagstaxi" /></a><a href="/taxitjanster-goteborg">Alla taxitjänster</a><a href="/en/services" hrefLang="en">Taxi services in English</a><a href="/bli-akeripartner"><AppText text="Åkeripartner" /></a><a href="https://wa.me/46700315315">WhatsApp</a></div></details>
          <a className="customerNavTrips" href="/customer">
            <UserRound />
            <AppText text={"Mina resor"} /></a>
        </nav>
        <label className="languagePicker">
          <span>{<AppText text={language.flag} />}</span>
          <select
            aria-label={lang === "sv" ? "Språk" : "Language"}
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {<AppText text={l.flag} />} {<AppText text={l.label} />}
              </option>
            ))}
          </select>
        </label>
        <a
          className="whatsappHeader"
          href="https://wa.me/46700315315"
          aria-label="WhatsApp"
        >
          <MessageCircle />
        </a>
        <a className="callButton" href="tel:+46700315315">
          <Phone />
          0700-315 315
        </a>
        <button
          className="menuButton"
          aria-expanded={menu}
          aria-label={lang === "sv" ? "Meny" : "Menu"}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>}
      {!appMode && <InstallApp kind="customer" hideTrigger />}
      
      {view === "booking" && <section className={`bookingHero bookingHeroEditorial ${!appMode?"gothenburgNight":""} ${appMode&&step===2?"appContactStep":""} ${appMode&&(expandedSheet||step>=2)?"appSheetExpanded":""}`} id="boka">
        {appMode?<div className="customerBookingBackdrop"><NightlifeBackdrop playbackEnabled={appFilmPlaying} hideControls repeat /></div>:<NightlifeBackdrop />}
        {!appMode && <div className="bookingFirstHeading">
          <small><AppText text={lang === "sv" ? "Välkommen till Avenyn Taxi · sedan 2003" : t.since} /></small>
          <h1><AppText text={t.heroA} /></h1>
          <p className="bookingFirstTagline"><em><AppText text={lang === "sv" ? "Se priset före bokning." : t.heroB} /></em></p>
          <p className="bookingFirstDescription"><AppText text={lang === "sv" ? "Sök adress, se priset och boka med några enkla steg. Förboka taxi i Göteborg eller till och från Landvetter med biltyp, tid och tillval samlade i samma formulär." : t.heroText} /></p>
        </div>}
        <nav aria-label="Välj bokningssätt" className="corporateEntry"><a href="/#booking-form">Boka taxi</a><a href="/foretag">Boka som företag</a><a href="/foretag#company-apply">Bli företagskund</a></nav>
        <div className="bookingPanel streamlinedBooking" id="booking-form" onPointerDown={()=>setBookingOpening(false)} onFocusCapture={()=>setBookingOpening(false)}>

          {companyError&&<p role="alert">{companyError} <a href="/foretag">Företagsbokning</a></p>}
          {companyId&&<p className="bookingAccountState">Företagsresa · {corporateOptions.find(a=>a.company.id===companyId)?.company.name}</p>}
          {appMode&&step===1&&<button className="appSheetHandle" type="button" aria-expanded={expandedSheet} onClick={()=>{setExtrasSeen(true);setExpandedSheet(!expandedSheet);}}><span/>{expandedSheet?"Dölj tillval":"Tillval & fler val"}</button>}
          {!appMode&&savedTrips.length>0&&<button className="savedTripsShortcut" type="button" onClick={()=>setShowSavedTrips(true)}>Mina bokningar · {savedTrips.length}</button>}
          {showSavedTrips&&<section className="savedTripsPanel" aria-label="Mina bokningar"><div><h2>Mina bokningar</h2><button type="button" onClick={()=>setShowSavedTrips(false)}>Stäng ×</button></div><p>Sparade på den här enheten. Öppna en resa för aktuell status och betalning.</p>{savedTrips.length?(appMode?savedTrips.slice(savedTripsPage*3,savedTripsPage*3+3):savedTrips).map(row=><button className="savedTripRow" key={row.token} onClick={()=>{setSelectedTrip(row.token);setShowSavedTrips(false);}}><span>Bokning #{row.number}<small>{row.pickupTime?new Date(row.pickupTime).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"Öppna resan"}</small></span><ArrowRight/></button>):<p>Du har inga sparade bokningar här ännu.</p>}{appMode&&savedTrips.length>3&&<nav className="appListPages" aria-label="Bokningssidor"><button disabled={savedTripsPage===0} onClick={()=>setSavedTripsPage(p=>p-1)}>← Föregående</button><span>{savedTripsPage+1} / {Math.ceil(savedTrips.length/3)}</span><button disabled={(savedTripsPage+1)*3>=savedTrips.length} onClick={()=>setSavedTripsPage(p=>p+1)}>Nästa →</button></nav>}</section>}
          {step < 3 && (
            <>
              {!appMode && <nav className="bookingStepNav" aria-label="Bokningssteg"><button type="button" aria-current={step === 1 ? "step" : undefined} onClick={() => setStep(1)}><AppText text="1. Din resa" /></button><span aria-current={step === 2 ? "step" : undefined}><AppText text="2. Kontakt och bokning" /></span></nav>}
              <div className="bookingColumns"><div className="bookingTripColumn" style={step === 2 ? {display:"none"} : undefined}>

              <div className="panelTitle">
                <div>
                  <small>{<AppText text={t.bookTaxi} />}</small>
                  <h2>{<AppText text={t.getPrice} />}</h2>
                </div>
                <span className="liveAddressBadge"><i /> <AppText text={"Live adressökning"} /></span>
              </div>
              {(rebookLoading || rebookNotice) && <p className="bookingJourneyNotice" role="status">{<AppText text={rebookLoading ? "Hämtar din tidigare resa…" : rebookNotice} />}</p>}
              <PickupMapPicker
                open={locationPickerOpen}
                initial={from}
                onClose={() => setLocationPickerOpen(false)}
                onPick={(place) => {
                  setFrom(place);
                  setError("");
                  setLocationNotice("Hämtplatsen är vald från kartan.");
                  setLocationPickerOpen(false);
                }}
                onGps={()=>void locate()}
                gpsBusy={locating}
                notice={locationNotice}
              />
              {locationNotice && !(appMode && (locationNotice === t.geoFound || locationNotice === "Hämtplatsen är vald från kartan.")) && (
                <p className="locationNotice" aria-live="polite">
                  {<AppText text={locationNotice} />}
                </p>
              )}
              <div className="airportShortcuts">
                <button type="button" aria-pressed={isLandvetterAirport(to.label, to.id) && !isLandvetterAirport(from.label, from.id)} onClick={() => {
                  if (isLandvetterAirport(from.label, from.id)) setFrom(to);
                  setTo(airportPlace);
                }}>
                  
                  {<AppText text={t.toAirport} />}
                </button>
                <button type="button" aria-pressed={isLandvetterAirport(from.label, from.id) && !isLandvetterAirport(to.label, to.id)} onClick={() => {
                  if (isLandvetterAirport(to.label, to.id)) setTo(from);
                  setFrom(airportPlace);
                }}>
                  
                  {<AppText text={t.fromAirport} />}
                </button>
                <button type="button" aria-pressed={to.id === centralPlace.id && to.label === centralPlace.label} onClick={() => setTo(centralPlace)}>
                  <Navigation />
                  {<AppText text={t.toCentral} />}
                </button>
              </div>
              <section className="modernRouteCard" aria-label="Välj upphämtning och destination">
                <div className="routeConnector" aria-hidden="true" />
                <Address
                  compact={appMode}
                  label={t.from}
                  value={from}
                  set={setFrom}
                  t={t}
                  kind="pickup"
                  locating={locating}
                  onUseLocation={()=>void locate()}
                  onChooseMap={() => setLocationPickerOpen(true)}
                />
                {stopEnabled && (
                  <>
                    <button
                      type="button"
                      className={`routeSwapHandle ${routeReordering ? "dragging" : ""}`}
                      style={{ transform: `translateY(${routeDragOffset}px)` }}
                      disabled={!from.label.trim() || !stop.label.trim()}
                      aria-label="Dra upp eller tryck för att byta plats på upphämtning och extra stopp"
                      onPointerDown={beginRouteSwap}
                      onPointerMove={moveRouteSwap}
                      onPointerUp={(event) => finishRouteSwap(event)}
                      onPointerCancel={(event) => finishRouteSwap(event, true)}
                      onClick={(event) => {
                        if (event.detail === 0) swapPickupAndStop();
                      }}
                    >
                      <GripVertical aria-hidden="true" />
                      <span>
                        <b><AppText text={"Dra för att byta ordning"} /></b>
                        <small><AppText text={"Nytt totalpris räknas ut direkt"} /></small>
                      </span>
                    </button>
                    <Address
                      compact={appMode}
                      label="Extra stopp"
                      value={stop}
                      set={setStop}
                      t={t}
                      kind="destination"
                    />
                  </>
                )}
                <button
                  type="button"
                  className="addStopButton"
                  aria-pressed={stopEnabled}
                  onClick={() => {
                    if (stopEnabled) setStop({ label: "" });
                    setStopEnabled((enabled) => !enabled);
                    setQuoteData(null);
                    setError("");
                  }}
                >
                  {stopEnabled ? <X /> : <CirclePlus />}
                  {<AppText text={stopEnabled ? "Ta bort extra stopp" : "Lägg till stopp"} />}
                </button>
                <Address
                  compact={appMode}
                  label={t.to}
                  value={to}
                  set={setTo}
                  t={t}
                  kind="destination"
                />
              </section>
              <div className="bookingOptionsGroup">
                <div className="bookingTimeField"><span className={appMode ? "bookingSrOnly" : ""}><CalendarClock size={18}/> <AppText text={"När vill du åka?"} /></span>
                  <div className="rideTimeChoice"><button type="button" aria-pressed={time==='now'} onClick={()=>setTime('now')}><AppText text={"Åk nu"} /></button><button type="button" aria-pressed={time!=='now'} onClick={()=>setTime('')}><AppText text={"Förboka"} /></button></div>
                  {time!=='now' && <div className="scheduledPickupField">
                    <label htmlFor="scheduled-pickup"><CalendarClock size={16} aria-hidden="true"/> <AppText text={"Datum och tid"} /><small><AppText text={"Obligatoriskt"} /></small></label>
                    <div className={`scheduledPickupInput ${time ? "hasValue" : "isEmpty"}`}>
                      <input id="scheduled-pickup" aria-describedby="scheduled-pickup-help" type="datetime-local" required value={time} onChange={e=>{setTime(e.target.value);setError("");}} />
                      {!time && <span aria-hidden="true"><AppText text={"Välj datum och tid"} /></span>}
                    </div>
                    <p id="scheduled-pickup-help"><AppText text={"Tryck på fältet och välj när du vill bli hämtad."} /></p>
                  </div>}
                </div>
              <details className={`bookingExtras ${appMode ? "compactExtras" : ""} consolidatedExtras`} >
                <summary><span>{<AppText text={lang === "en" ? "Options" : "Tillval"} />}</span><small>{<AppText text={[vehicle === "large" ? t.large : t.standard, petText(pet), `${passengers} ${lang === "en" ? (passengers === 1 ? "person" : "people") : (passengers === 1 ? "person" : "personer")}`, flight, seats > 0 ? `${seats} ${t.childSeat.toLowerCase()}` : ""].filter(Boolean).join(" · ")} />}</small></summary><PetField value={pet} onChange={setPet}/>
                <div className="bookingExtrasContent">
                  <div className="formGrid optionsVehicleGrid">
                <label>
                  <span>
                    <CarFront />
                    {<AppText text={t.vehicle} />}
                  </span>
                  <select
                    aria-label={t.vehicle}
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  >
                    <option value="standard">{<AppText text={t.standard} />}</option>
                    <option value="large">{<AppText text={t.large} />}</option>
                  </select>
                </label>
                <label>
                  <span>
                    <UsersRound />
                    {<AppText text={t.passengers} />}
                  </span>
                  <div className="passengerPicker" aria-label={t.passengers}>
                    <button
                      type="button"
                      aria-label="Minska antal passagerare"
                      onClick={() => setPassengers(Math.max(1, passengers - 1))}
                      disabled={passengers <= 1}
                    >
                      −
                    </button>
                    <strong aria-label={`${passengers} ${t.people}`}>
                      {appMode ? <><UsersRound size={14} aria-hidden="true" />{<AppText text={passengers} />}</> : <>{<AppText text={passengers} />} {<AppText text={t.people} />}</>}
                    </strong>
                    <button
                      type="button"
                      aria-label="Öka antal passagerare"
                      onClick={() => {
                        const nextPassengers = Math.min(7, passengers + 1);
                        setPassengers(nextPassengers);
                        if (nextPassengers > 4) setVehicle("large");
                      }}
                      disabled={passengers >= 7}
                    >
                      +
                    </button>
                  </div>
                </label>
                  </div>
                <label>
                  <span>
                    <Plane />
                    {<AppText text={t.flight} />}
                  </span>
                  <input
                    value={flight}
                    onChange={(e) => setFlight(e.target.value)}
                    aria-label={t.flight}
                    placeholder={`${t.flight} (${t.optional.toLowerCase()})`}
                  />
                </label>
              <div className="childSeat">
                <div>
                  <Baby />
                  <span>
                    <b>{<AppText text={t.childSeat} />}</b>
                    <small>+{<AppText text={childSurcharge} />} <AppText text={"kr"} /></small>
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setSeats(Math.max(0, seats - 1))}
                  >
                    −
                  </button>
                  <b>{<AppText text={seats} />}</b>
                  <button
                    type="button"
                    onClick={() => setSeats(Math.min(3, seats + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
                </div>
              </details>
              </div>
              <details className="bookingTravelTools"><summary><AppText text={"Flyg & sparade adresser"} /></summary>
              <LandvetterBookingAssistant direction={isLandvetterAirport(from.label, from.id) ? "from" : isLandvetterAirport(to.label, to.id) ? "to" : null} flight={flight} onFlight={setFlight} onDirection={direction => {
                if (direction === "from") { if (isLandvetterAirport(to.label, to.id)) setTo(from); setFrom(airportPlace); }
                else { if (isLandvetterAirport(from.label, from.id)) setFrom(to); setTo(airportPlace); }
                setError("");
              }} />
              {!sessionLoading && <SavedAddresses key={session?.user.id || "guest"} owner={session?.user.id || "guest"} from={from} to={to} onPick={(field, place) => { if (field === "from") setFrom(place); else setTo(place); setError(""); }} />}
              </details>
              <div
                className={"priceBox " + (fixedQuote ? "priceReady" : "")}
                aria-live="polite"
                aria-busy={showQuoteLoading}
              >
                <span>
                  {<AppText text={routeNeedsAddressSelection
                    ? "Välj adressförslaget för nytt pris"
                    : showQuoteLoading
                      ? "Uppdaterar pris…"
                    : quoteError
                      ? "Pristjänsten svarar inte just nu. Försök igen."
                    : fixedQuote
                      ? stopEnabled
                        ? "Ditt totalpris"
                        : fixedQuote.type === "fixed"
                        ? t.yourFixedPrice
                        : fixedQuote.type === "estimated"
                          ? "Ditt prisförslag"
                          : "Ditt beräknade pris"
                      : isAirportRoute
                        ? t.errNoPrice
                        : t.selectForPrice} />}
                  {fixedQuote && (
                    <small>
                      {<AppText text={routeNeedsAddressSelection
                        ? "Senaste priset visas tills den nya adressen har valts."
                        : showQuoteLoading
                          ? "Senaste priset visas medan den nya rutten räknas."
                          : `${fixedPriceCaption} · Priset hålls i 10 minuter`} />}
                    </small>
                  )}
                </span>
                <b>
                  {<AppText text={fixedQuote ? price + " kr" : showQuoteLoading ? "…" : "—"} />}
                </b>
              </div>
              {companyPriceError&&<p role="alert">{companyPriceError}</p>}
              {quoteError && !showQuoteLoading && !routeNeedsAddressSelection && <button type="button" className="bookingContinue" onClick={() => setQuoteRefresh(n => n + 1)}><AppText text="Försök igen – hämta pris" /></button>}
              {<button type="button" className="bookingContinue" onClick={() => {if(!validateTrip())return;setStep(2);setExpandedSheet(true); requestAnimationFrame(() => document.getElementById("booking-contact-title")?.focus());}}><AppText text="Fortsätt till kontaktuppgifter" /><ArrowRight/></button>}
              </div><div className="bookingDetailsColumn" style={step === 1 ? {display:"none"} : undefined}>
              <div className="bookingContactHeading">
                {appMode&&<button type="button" onClick={()=>{setStep(1);setExpandedSheet(false);}}>← Ändra resa</button>}
                <p className="guestBookingNotice"><AppText text={companyId?"Boka för företag":"Boka utan konto"}/></p>
                <h2 id="booking-contact-title" tabIndex={-1}>{<AppText text={lang === "en" ? "Contact details & payment" : "Kontaktuppgifter och betalning"} />}</h2>

              </div>
              {session && (
                <div className="bookingAccountState">
                  <ShieldCheck />
                  <span>
                    <b><AppText text={"Inloggad"} /></b>
                    <small><AppText text={"Bokningen sparas automatiskt i Mina resor."} /></small>
                  </span>
                </div>
              )}
              {corporateOptions.length>0&&<><label className="contactField"><span>Boka för</span><select value={companyId} onChange={e=>{setCompanyId(e.target.value);setCompanyReference('');setPaymentMethod(e.target.value?'Faktura':'Kort');}}><option value="">Privat resa</option>{corporateOptions.map(a=><option key={a.id} value={a.company.id}>{a.company.name}</option>)}</select></label>{companyId&&<><p className="bookingAccountState">Faktura till {corporateOptions.find(a=>a.company.id===companyId)?.company.invoice_email} · {corporateOptions.find(a=>a.company.id===companyId)?.company.payment_days} dagar. Ange resenärens kontaktuppgifter nedan.</p><label className="contactField"><span>Beställarreferens / kostnadsställe {corporateOptions.find(a=>a.company.id===companyId)?.company.reference_required?'*':'(valfritt)'}</span><input maxLength={160} value={companyReference} onChange={e=>setCompanyReference(e.target.value)}/></label></>}</>}
              <label className="contactField"><span>{<AppText text={lang === "en" ? "Payment method" : "Betalsätt"} />}</span><select value={companyId?"Faktura":paymentMethod} disabled={!!companyId} onChange={e=>setPaymentMethod(e.target.value)}>{(companyId?["Faktura"]:paymentMethods.filter(m=>m!=="Faktura")).map(m=><option key={m} value={m}>{<AppText text={m} />}</option>)}</select></label>

              <label className="contactField">
                <span>{t.name}</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <div className="contactField phoneContactField">
                <span>{<AppText text={t.mobile} />}</span>
                <div className="phoneFieldRow">
                  <select
                    aria-label="Land och landskod"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {phoneCountries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {<AppText text={country.flag} />} {<AppText text={country.code} />} · {country.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    aria-label="Mobilnummer"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel-national"
                    placeholder={
                      countryCode === "+46" ? "070 123 45 67" : "Mobilnummer"
                    }
                  />
                </div>

              </div>
              <details className="bookingOptionalContact"><summary><AppText text={"E-post, konto & meddelande (valfritt)"} /></summary>              <label className="contactField">
                <span><AppText text="E-post (valfritt)" /></span>
                <input
                  required={createAccount&&!session}
                  readOnly={Boolean(session)}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>

              {!session && (
                <section
                  className={
                    createAccount
                      ? "bookingAccountChoice active"
                      : "bookingAccountChoice"
                  }
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                    />
                    <span>
                      <UserPlus />
                      <b><AppText text={"Skapa kundkonto samtidigt"} /></b>
                      <small>
                        <AppText text={"Se bokningen, taxin och flyget under Mina resor."} /></small>
                    </span>
                  </label>
                  {createAccount && (
                    <div className="bookingPasswordGrid">
                      <label>
                        <span>
                          <KeyRound />
                          <AppText text={"Lösenord"} /></span>
                        <input
                          type="password"
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="Minst 8 tecken"
                        />
                      </label>
                      <label>
                        <span>
                          <KeyRound />
                          <AppText text={"Upprepa lösenord"} /></span>
                        <input
                          type="password"
                          value={accountPasswordConfirm}
                          onChange={(e) =>
                            setAccountPasswordConfirm(e.target.value)
                          }
                          autoComplete="new-password"
                          placeholder="Samma lösenord igen"
                        />
                      </label>
                    </div>
                  )}
                  <p>
                    <AppText text={"Har du redan konto?"} /><a href="/customer"><AppText text={"Logga in här"} /></a>.
                  </p>
                </section>
              )}
              <label className="contactField">
                <span><AppText text={"Extra meddelande"} /></span>
                <textarea
                  value={extraMessage}
                  onChange={(e) => setExtraMessage(e.target.value)}
                  placeholder="Portkod, bagage eller annan information"
                  rows={3}
                />
              </label>
              </details>
              {fixedQuote && !routeNeedsAddressSelection && !showQuoteLoading && (
              <details className="bookingReview" aria-label="Kontrollera din resa">
                <summary><AppText text={"Din resa ·"} />{<AppText text={price.toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} />} <AppText text={"kr"} /></summary>
                <dl><div><dt><AppText text={"Hämtning"} /></dt><dd>{<AppText text={time === "now" ? "Så snart som möjligt" : time.replace("T", " kl. ")} />}</dd></div>
                <div><dt><AppText text={"Bil och sällskap"} /></dt><dd>{<AppText text={vehicle === "large" ? "Storbil" : "Standardbil"} />} · {<AppText text={passengers} />} <AppText text={"passagerare"} /></dd></div>
                <div><dt><AppText text={"Tillval i priset"} /></dt><dd>{<AppText text={[seats > 0 ? `${seats} barnstol${seats > 1 ? "ar" : ""}` : "", stopEnabled ? "Ett extra stopp" : ""].filter(Boolean).join(" · ") || "Inga extra tillval"} />}</dd></div>
                {flight && <div><dt><AppText text={"Flygnummer"} /></dt><dd>{<AppText text={flight.toUpperCase()} />}</dd></div>}
                <div className="bookingReviewTotal"><dt>{<AppText text={fixedQuote?.type === "fixed" ? "Fast totalpris" : fixedQuote?.type === "estimated" ? "Prisförslag" : "Beräknat totalpris"} />}</dt><dd>{<AppText text={price.toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} />} <AppText text={"kr"} /></dd></div></dl>
                <p>{<AppText text={fixedQuote?.type === "fixed" ? "Vald biltyp och valda tillval ingår i totalpriset." : "Priset är beräknat för vald biltyp och valda tillval. Kontrollera priset innan du bekräftar."} />}</p>
                {isAirportRoute && <p>{<AppText text={isLandvetterAirport(from.label, from.id) ? "Hämtning på Landvetter: ange ankommande flygnummer. Bekräfta mötesplatsen med föraren när du har hämtat bagaget." : "Till Landvetter: välj hämtningstid med marginal för resan och incheckningen."} />}</p>}
              </details>
              )}
<p className="bookingTermsNotice"><AppText text={"Genom att boka godkänner du"} /><a href="/bokningsvillkor" target="_blank" rel="noreferrer"><AppText text={"bokningsvillkoren"} /></a><AppText text={". Avbokning inom 24 timmar eller utebliven resa: fullt pris."} /></p>
              <button className="bookPrimary" disabled={busy || rebookLoading || showQuoteLoading || routeNeedsAddressSelection} onClick={submit}>
                {<AppText text={busy ? t.saving : fixedQuote && !routeNeedsAddressSelection && !showQuoteLoading ? `${t.confirm} · ${price} kr` : t.confirm} />}
                <ChevronRight />
              </button>
              </div></div>
            </>
          )}
          {step === 3 && done && (
            <div className="bookingSuccess" lang="sv">
              <div className="successIcon">
                <Check />
              </div>
              <small><AppText text={"BOKNINGEN ÄR MOTTAGEN"} /></small>
              <h2><AppText text={"Tack, "} />{<AppText text={done.booking.customerName} />}!</h2>
              <p>
                {<AppText text={done.emailSent
                  ? "En bokningsbekräftelse har skickats till din e-post."
                  : "Bokningen är sparad och synlig i trafikledningen."} />}
              </p>
              <p role="status"><AppText text={done.smsSent ? "SMS-bekräftelsen har skickats till SMS-tjänsten för leverans till din mobil." : done.smsError || "Bokningen är sparad. SMS-bekräftelsen kunde inte skickas; kontakta oss om du behöver hjälp."} /></p>
              {accountNotice && (
                <div className="bookingAccountNotice">
                  <UserRound />
                  {<AppText text={accountNotice} />}
                </div>
              )}
              {saveTripNotice&&<p className="savedTripNotice" role="status">{saveTripNotice}</p>}
              <div className="confirmationOverview"><b>{done.booking.pickup}</b><span>↓</span><b>{done.booking.destination}</b><small>{new Date(done.booking.pickupTime).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} · #{done.id}</small><strong>{done.price} kr</strong></div>
              <div className="confirmationActions">
              <button
                className="payNowButton"
                disabled={paymentBusy}
                onClick={payNow}
              >
                <CreditCard />
                {<AppText text={paymentBusy
                  ? "Öppnar säker betalning…"
                  : `Betala ${done.price} kr nu`} />}
              </button>
              <details className="paymentMethods"><summary>Betalningsalternativ</summary><p>{<AppText text={onlinePaymentOptions} />}. {<AppText text={onlinePaymentAvailability} />}</p></details>
              {/landvetter|airport|flygplats/i.test(`${done.booking.pickup} ${done.booking.destination}`) && <p className="flightReminder">Du kan lägga till eller ändra ditt flygnummer via <a href={"/track/"+done.trackingToken} onClick={e=>{e.preventDefault();setSelectedTrip(done.trackingToken);}}>din bokningslänk</a>, även senare.</p>}
              <a className="trackButton" href={"/track/" + done.trackingToken} onClick={e=>{e.preventDefault();setSelectedTrip(done.trackingToken);}}>
                <AppText text={"Öppna bokningen & följ din taxi"} /><Navigation />
              </a>
              <button type="button" className="copyBookingLink" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+"/track/"+done.trackingToken);setCopyNotice("Bokningslänken är kopierad. Där kan du också betala.");}catch{setCopyNotice("Din bokningslänk: "+window.location.origin+"/track/"+done.trackingToken);}}}>Kopiera boknings- och betalningslänk</button>
              {copyNotice&&<p className="copyNotice" role="status">{copyNotice}</p>}
              <a className="successAccountLink" href="#mina-bokningar" onClick={e=>{e.preventDefault();setShowSavedTrips(true);document.getElementById("booking-form")?.scrollIntoView({block:"start"});}}>
                <UserRound />
                <AppText text={"Mina bokningar på den här enheten"} /></a>
              <div className="successActions">
                <button className="returnButton" onClick={bookReturn}>
                  <AppText text={"Boka återresa"} /><ChevronRight />
                </button>
                <button onClick={bookNew}><AppText text={"Boka ny resa"} /></button>
              </div>
              </div>
              <details className="confirmationDetails"><summary>Alla resuppgifter</summary><div className="confirmationGrid">
                <section className="confirmationRoute">
                  <span><AppText text={"Resa"} /></span>
                  <div>
                    <b>{done.booking.pickup}</b>
                    <Navigation />
                    {done.booking.stop && <><b>{<AppText text={done.booking.stop} />}</b><Navigation /></>}
                    <b>{done.booking.destination}</b>
                  </div>
                </section>
                <section>
                  <span><AppText text={"Bokningsnummer"} /></span>
                  <b>#{<AppText text={done.id} />}</b>
                </section>
                <section>
                  <span><AppText text={"Namn"} /></span>
                  <b>{<AppText text={done.booking.customerName} />}</b>
                </section>
                <section>
                  <span><AppText text={"Datum och tid"} /></span>
                  <b>
                    {new Date(done.booking.pickupTime).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                  </b>
                </section>
                <section>
                  <span><AppText text={"Passagerare"} /></span>
                  <b>{<AppText text={done.booking.passengers} />}</b>
                </section>
                <section>
                  <span><AppText text={"Biltyp"} /></span>
                  <b>
                    {<AppText text={done.booking.vehicle === "large"
                      ? "Storbil"
                      : "Vanlig bil"} />}
                  </b>
                </section>
                <section>
                  <span><AppText text={"Barnstol och tillval"} /></span>
                  <b>
                    {<AppText text={done.booking.childSeats
                      ? `${done.booking.childSeats} barnstol${done.booking.childSeats > 1 ? "ar" : ""}`
                      : "Inga tillval"} />}
                  </b>
                </section>
                {done.booking.petDetails&&<section><span><AppText text="Djur"/></span><b>{petText(done.booking.petDetails)}</b></section>}
                <section>
                  <span><AppText text={"Pris"} /></span>
                  <b>{<AppText text={done.price} />} <AppText text={"kr"} /></b>
                </section>
              </div></details>

            </div>
          )}
          {error && <div className="formError">{<AppText text={error} />}</div>}
        </div>
        {!appMode && <div className="heroCopy">
          <div className="heroFacts">
            <span>
              <Check />
              {<AppText text={t.fact1} />}
            </span>
            <span>
              <Check />
              {<AppText text={t.fact2} />}
            </span>
            <span>
              <Check />
              {<AppText text={t.fact3} />}
            </span>
          </div>
          <div className="heroEditorialActions"><a href="/#booking-form">{<AppText text={lang === "sv" ? "Sök adress och se pris" : lang === "en" ? "Plan your journey" : t.navBook} />}<ArrowRight/></a><a href="tel:+46700315315"><Phone/>{<AppText text={lang === "sv" ? "Prata med oss" : lang === "en" ? "Call us" : "+46 700 315 315"} />}</a></div>
          <div className="heroEditorialCaption">{<AppText text={lang === "sv" ? "Göteborg. Landvetter. Västkusten." : "Göteborg · Landvetter · West Coast"} />}</div>
          <div className="premiumPaymentNote"><CreditCard/><span>{<AppText text={`${onlinePaymentOptions}. ${lang === "en" ? "Available options are shown at checkout." : onlinePaymentAvailability}`} />}</span></div>
          <div className="companyStory">
            <strong>{<AppText text={lang === "sv" ? "Lokalt sedan 2003." : t.since} />}</strong>
            <p>
              {<AppText text={lang === "sv"
                ? "Lokala förare, personlig service och trygga resor i Göteborg med omnejd."
                : t.heroText} />}
            </p>
          </div>
        </div>
        }
      </section>}
      {!appMode && view === "booking" && <p className="homeFilmCredits"><a href="/valkommen/kallor#bakgrundsfilm">Filmkällor och licenser</a></p>}
      {!appMode && view === "booking" && <section className="homeCompactIntro"><div><small><AppText text={"AVENYN TAXI · SEDAN 2003"} /></small><h2><AppText text={"Taxi nära dig i Göteborg"} /></h2><p><AppText text={"Från Avenyn och Centralstationen till Landvetter och Västkusten. Välj vanlig bil eller storbil för upp till sju passagerare, med barnstol och stopp som tillval. Vi hjälper dig hela vägen."} /></p><nav><a href="/priser-omraden"><AppText text={"Priser och områden"} /><ArrowRight/></a><a href="/taxi-landvetter"><AppText text={"Taxi Landvetter"} /><ArrowRight/></a><a href="/taxi-goteborg"><AppText text={"Taxi nära mig – boka i Göteborg"} /><ArrowRight/></a><a href="/om-avenyn-taxi"><AppText text={"Om Avenyn Taxi"} /><ArrowRight/></a></nav></div></section>}
      {!appMode && view === "booking" && lang === "sv" && <>
        <section className="homeTravelSection" aria-labelledby="home-bud-title"><header><small>BUDTRANSPORT · GÖTEBORG</small><h2 id="home-bud-title">Behöver du skicka dokument, nycklar eller ett paket?</h2><p>Fråga Avenyn Taxi om taxibud och expressbud i Göteborg med omnejd. Skicka hämtadress, leveransadress och önskad tid för pris och tillgänglighet.</p></header><nav className="homeTravelActions" aria-label="Budtransport"><a href="/bud-goteborg">Läs om taxibud i Göteborg</a><a href="/om-avenyn-taxi#service-request">Begär pris för budkörning</a></nav></section>
        <section className="homeTravelSection"><header><small>TAXI I CENTRALA GÖTEBORG</small><h2>Var vill du bli hämtad?</h2><p>Hitta information om mötesplatser, hotellhämtning och resor till Landvetter.</p></header><nav className="homeDestinationChips" aria-label="Taxi i centrala Göteborg"><a href="/taxi-centrum">Taxi Göteborg centrum</a><a href="/taxi-avenyn">Taxi på Avenyn</a><a href="/taxi-goteborg-central">Taxi Göteborg Centralstation</a></nav></section>
        <GoogleReviews />
        <section className="homeTravelSection homeAirportPrices" aria-labelledby="home-airport-prices-title">
          <header><small><AppText text={"FASTPRIS TILL OCH FRÅN FLYGPLATSEN"} /></small><h2 id="home-airport-prices-title"><AppText text={"Taxi till Landvetter – aktuella fastpriser"} /></h2><p><AppText text={"Välj område och ange din adress. Pris för biltyp och tillval visas före bekräftelse."} /></p></header>
          {popularAirportPrices.length > 0 && <div className="homeAirportPriceGrid">{popularAirportPrices.slice(0,4).map((row) => <article key={row.code}><h3>{row.locality}</h3><p><AppText text={"till / från Landvetter"} /></p><strong>{<AppText text={row.price.toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} />} <AppText text={"kr"} /></strong><button type="button" onClick={() => prepareZoneBooking(row)} aria-label={`Boka taxi från ${row.locality} till Landvetter`}><AppText text={"Boka med fastpris"} /></button></article>)}</div>}
          <nav className="homeTravelActions" aria-label="Landvetterpriser och bokning"><a href="/priser-omraden#priser"><AppText text={"Se alla Landvetterpriser"} /></a><a href="/taxi-landvetter"><AppText text={"Taxi Landvetter – hämtning och flyginformation"} /></a></nav>
        </section>
        <section className="homeTravelSection homeNearbyQuotes" aria-labelledby="home-nearby-quotes-title">
          <header><small><AppText text={"GÖTEBORG MED OMNEJD"} /></small><h2 id="home-nearby-quotes-title"><AppText text={"Vart vill du resa?"} /></h2><p><AppText text={"Göteborg, Västkusten eller längre bort? Skicka adresser och önskad tid för pris och tillgänglighet. Din resa bekräftas efter att förfrågan har godkänts."} /></p></header>
          <nav className="homeDestinationChips" aria-label="Orter runt Göteborg">{nearbyQuoteAreas.map(area=><a key={area.href} href={area.href}>{area.name}<ArrowRight/></a>)}</nav>
          <nav className="homeTravelActions" aria-label="Planera regional resa"><a href="/?quote=1#quote-form"><AppText text={"Begär offert för din resa"} /><ArrowRight/></a><a href="/taxi-omraden"><AppText text={"Se alla områden"} /></a></nav>
        </section>
      </>}
      {view === "prices" && <section className="simplePageIntro"><small><AppText text={"PRISER OCH OMRÅDEN"} /></small><h1><AppText text={"Hitta priset för din resa"} /></h1><p><AppText text={"Sök Landvetterpriser och läs om våra resor i Göteborg och längs Västkusten."} /></p><a href="/#booking-form"><AppText text={"Till bokningen"} /><ArrowRight/></a></section>}
      {view === "about" && <section className="simplePageIntro"><small><AppText text={"AVENYN TAXI · GÖTEBORG"} /></small><h1><AppText text={"Personlig service sedan 2003"} /></h1><p><AppText text={"Lär känna Avenyn Taxi, kontakta oss eller skicka en transportförfrågan."} /></p><p>{lang === "en" ? "Avenyn Taxi is a registered business name of " : "Avenyn Taxi är ett registrerat särskilt företagsnamn för "}<strong translate="no">Citra Trans och Bilservice Aktiebolag</strong>. {lang === "en" ? "The company operates Avenyn Taxi and the website www.avenyntaxi.se." : "Bolaget driver Avenyn Taxi och webbplatsen www.avenyntaxi.se."}</p><p><strong>{lang === "en" ? "Company details" : "Företagsuppgifter"}</strong><br/>{lang === "en" ? "Company registration number: " : "Organisationsnummer: "}<span translate="no">556597-4796</span><br/>{lang === "en" ? "Registered address: " : "Registrerad adress: "}Stora Kronogårdsgatan 92, 422 44 Hisings Backa, Sverige<br/><a href="mailto:info@avenyntaxi.se">info@avenyntaxi.se</a> · <a href="tel:+46700315315">0700 315 315</a></p><a href="/#booking-form"><AppText text={"Boka din resa"} /><ArrowRight/></a></section>}
      {!appMode && lang === "sv" && view === "booking" && (
        <section className="homeSeo" aria-labelledby="home-faq-title">
          <section className="homeFaq" aria-labelledby="home-faq-title">
            <h3 id="home-faq-title"><AppText text={"Vanliga frågor om taxi i Göteborg"} /></h3>
            <details><summary><AppText text={"Hur bokar jag taxi i Göteborg?"} /></summary><p><AppText text={"Fyll i hämtadress, destination, tid och kontaktuppgifter i bokningsformuläret. Kontrollera sedan resan innan du bekräftar."} /></p></details>
            <details><summary><AppText text={"Kan jag förboka taxi?"} /></summary><p><AppText text={"Ja. Välj önskat datum och klockslag i bokningen och kontrollera hämtningstiden före bekräftelse."} /></p></details>
            <details><summary><AppText text={"Kör ni taxi till Landvetter?"} /></summary><p><AppText text={"Ja, Avenyn Taxi kör till och från Göteborg Landvetter Airport. Aktiva officiella fastpriser hämtas från den centrala prislistan."} /></p></details>
            <details><summary><AppText text={"Kan jag boka barnstol eller storbil?"} /></summary><p><AppText text={"Ja. Barnstol kan läggas till som tillval och storbil kan väljas för större sällskap."} /></p></details>
            <details><summary><AppText text={"Kan jag följa taxin live?"} /></summary><p><AppText text={"När en förare har tilldelats kan du använda den personliga spårningslänken för att följa bilen."} /></p></details>
            <details><summary><AppText text={"Vilka betalningsmetoder accepterar ni?"} /></summary><p><AppText text={"De betalningsalternativ som är tillgängliga för resan visas i det aktuella betalningsflödet före betalning."} /></p></details>
          </section>
          <nav className="homeAreaExplore" aria-label="Lokala taxiguider"><a href="/taxi-omraden">Göteborg och orter inom cirka 20 mil <ArrowRight/></a><a href="/taxi-vastkusten">Resor till Västkusten <ArrowRight/></a></nav>

        </section>
      )}
      {!appMode && view === "booking" && <><AppDownloadBanner /><div className="homeWeatherSecondary"><GothenburgWeather /></div></>}
      <section className="serviceBand" aria-label="Taxi Göteborg – bokning, Landvetter och service">
        <a href="/taxi-landvetter">
          <Plane />
          <span>
            <b>{<AppText text={t.benefitAirport} />}</b>
            <small>{<AppText text={t.benefitAirportText} />}</small>
          </span>
        </a>
        <a href="/om-avenyn-taxi">
          <ShieldCheck />
          <span>
            <b>{<AppText text={t.benefitSafe} />}</b>
            <small>{<AppText text={t.benefitSafeText} />}</small>
          </span>
        </a>
        <a href="/#booking-form">
          <UsersRound />
          <span>
            <b>{<AppText text={t.benefitPeople} />}</b>
            <small>{<AppText text={t.benefitPeopleText} />}</small>
          </span>
        </a>
        <a href="/om-avenyn-taxi">
          <MessageCircle />
          <span>
            <b>{<AppText text={t.benefitService} />}</b>
            <small>{<AppText text={t.benefitServiceText} />}</small>
          </span>
        </a>
      </section>
      {lang === "sv" && view === "about" && (
        <section className="avenynHistory" aria-labelledby="avenyn-history-title">
          <div className="avenynHistoryYear" aria-hidden="true">
            <span><AppText text={"SEDAN"} /></span>
            <strong>2003</strong>
          </div>
          <div className="avenynHistoryCopy">
            <small><AppText text={"VÅR HISTORIA"} /></small>
            <h2 id="avenyn-history-title"><AppText text={"Från Göteborg, för Göteborg"} /></h2>
            <p>
              <AppText text={"Avenyn Taxi har funnits i Göteborg sedan 2003. Vår idé har alltid varit enkel: personlig service, lokala förare och trygga resor när kunden behöver oss."} /></p>
            <p>
              <AppText text={"I dag kör vi privatpersoner, företag och resenärer i Göteborg med omnejd och till Landvetter. Vi utvecklar tjänsten vidare med enkel bokning, tydliga priser och liveuppföljning – men behåller samma personliga bemötande."} /></p>
            <div className="avenynHistoryFacts">
              <span><b><AppText text={"20+ år"} /></b><small><AppText text={"i Göteborg"} /></small></span>
              <span><b><AppText text={"Dygnet runt"} /></b><small><AppText text={"bokning och service"} /></small></span>
              <span><b><AppText text={"Lokalt"} /></b><small><AppText text={"Göteborg med omnejd"} /></small></span>
            </div>
          </div>
        </section>
      )}
      {lang === "sv" && view === "about" && (
        <section className="businessServices" id="service-request" aria-labelledby="business-services-title">
          <div className="businessServicesIntro">
            <small><AppText text={"BUD &amp; FÖRSÄKRINGSRESOR"} /></small>
            <h2 id="business-services-title"><AppText text={"Transport när det gäller mer än en vanlig taxiresa"} /></h2>
            <p><AppText text={"Beställ bud i Göteborg eller skicka en förfrågan om en planerad resa som ska betalas av Försäkringskassan, regionen eller ett försäkringsbolag."} /></p>
          </div>
          <div className="businessServiceGrid">
            <article>
              <span className="businessServiceIcon"><Boxes /></span>
              <small><AppText text={"BUD GÖTEBORG"} /></small>
              <h3><AppText text={"Bud, expressbud och företagsleveranser"} /></h3>
              <p><AppText text={"Vi hämtar och lämnar dokument, nycklar, mindre paket och andra försändelser i Göteborg med omnejd. Skicka adresser, önskad tid och paketets storlek så återkommer vi med pris och tillgänglighet."} /></p>
              <a href="/bud-goteborg"><AppText text={"Läs om budkörning"} /><ChevronRight /></a>
            </article>
            <article>
              <span className="businessServiceIcon"><ShieldPlus /></span>
              <small><AppText text={"FÖRSÄKRINGSRESA"} /></small>
              <h3><AppText text={"Så går en försäkringsresa till"} /></h3>
              <ol>
                <li><AppText text={"Kontakta vården, Försäkringskassan eller ditt försäkringsbolag och be om beslut, reseintyg eller betalningsgodkännande."} /></li>
                <li><AppText text={"Be om referensnummer och vem som ska betala resan."} /></li>
                <li><AppText text={"Skicka därefter din reseförfrågan till oss med adresser, datum och tid."} /></li>
              </ol>
              <p className="serviceNotice"><AppText text={"Avenyn Taxi kan planera transporten, men beslut om ersättning fattas av regionen, Försäkringskassan eller försäkringsbolaget."} /></p>
              <div className="officialServiceLinks">
                <a href="/forsakringsresor-goteborg"><AppText text={"Läs hela guiden"} /></a>
                <a href="https://www.forsakringskassan.se/privatperson/sjuk-eller-skadad/resor-till-jobbet-vid-sjukdom-eller-skada" target="_blank" rel="noreferrer"><AppText text={"Försäkringskassan"} /></a>
                <a href="https://www.1177.se/Vastra-Gotaland/sa-fungerar-varden/sjukresor-och-fardtjanst/sjukresor-i-vastra-gotaland/" target="_blank" rel="noreferrer"><AppText text={"1177 Västra Götaland"} /></a>
              </div>
            </article>
          </div>
          <ServiceRequestForm />
        </section>
      )}
      {view === "about" && <section className="carsSection" id="bilar">
        <div>
          <small>{<AppText text={t.live} />}</small>
          <h2>{<AppText text={t.nearby} />}</h2>
          <p>{<AppText text={t.nearbyText} />}</p>
          <div className="availability">
            <i />
            {<AppText text={onlineCount ? `${onlineCount} ${t.driversOnline}` : t.noneOnline} />}
          </div>
        </div>
        <LiveMap
          colorsOnly cars={[]}
          customerLocation={
            Number.isFinite(from.lat) && Number.isFinite(from.lng)
              ? { lat: Number(from.lat), lng: Number(from.lng) }
              : undefined
          }
          destinationLocation={
            Number.isFinite(to.lat) && Number.isFinite(to.lng)
              ? { lat: Number(to.lat), lng: Number(to.lng) }
              : undefined
          }
        />
      </section>}
      {view === "prices" && <section className="pricingSection cityPriceSection" id="priser">
        <div className="pricingIntro">
          <small><AppText text={"FASTPRISER · LANDVETTER"} /></small>
          <h2><AppText text={"Hitta ditt fasta pris"} /></h2>
          <p>
            <AppText text={"Sök ditt område eller välj i listan. Priset gäller till och från Landvetter."} /></p>
          <label>
            <Search />
            <input
              value={priceSearch}
              onChange={(e) => setPriceSearch(e.target.value)}
              placeholder="Sök område, till exempel Avenyn"
              aria-label="Sök område i prislistan"
            />
          </label>
          {normalizedSearch.length > 0 && normalizedSearch.length < 3 && (
            <p className="searchHint"><AppText text={"Skriv minst 3 bokstäver."} /></p>
          )}
          {priceMatches.length > 0 && (
            <div className="citySearchResults" aria-label="Sökresultat">
              {priceMatches.map((row) => (
                <button key={row.locality} onClick={() => selectPriceArea(row)}>
                  <span>
                    {row.locality}
                    <small>{<AppText text={row.region} />}</small>
                  </span>
                  <b>{<AppText text={row.price} />} <AppText text={"kr"} /></b>
                </button>
              ))}
            </div>
          )}
          {normalizedSearch.length >= 3 && priceMatches.length === 0 && (
            <p className="searchHint">
              <AppText text={"Ingen konfigurerad fastprisort hittades."} /></p>
          )}
          {selectedArea && (
            <div
              className="selectedCityPrice"
              id="selected-city-price"
              aria-live="polite"
            >
              <span>
                <small><AppText text={"PRIS TILL/FRÅN LANDVETTER"} /></small>
                <strong>{selectedArea.locality}</strong>
                <em><AppText text={"Officiellt fastpris"} /></em>
              </span>
              <b>{<AppText text={selectedArea.price} />} <AppText text={"kr"} /></b>
              <button onClick={() => prepareZoneBooking(selectedArea)}>
                <AppText text={"Boka med fastpris"} /><ChevronRight />
              </button>
            </div>
          )}
        </div>
        <div className="priceCatalog">
          <header className="priceCatalogHeader">
            <div>
              <small><AppText text={"OMRÅDEN A–Ö"} /></small>
              <h3><AppText text={"Prislista"} /></h3>
            </div>
            <span>{<AppText text={filteredCatalogPrices.length} />} <AppText text={"områden"} /></span>
          </header>
          <div
            className="priceRegionTabs"
            role="group"
            aria-label="Filtrera prislistan efter region"
          >
            {availablePriceRegions.map((region) => (
              <button
                type="button"
                key={region}
                className={priceRegionFilter === region ? "active" : ""}
                aria-pressed={priceRegionFilter === region}
                onClick={() => {
                  setPriceRegionFilter(region);
                  setShowAllPrices(false);
                }}
              >
                {<AppText text={region === "Alla" ? "Alla områden" : region} />}
              </button>
            ))}
          </div>
          <div className="priceCatalogGrid">
            {displayedCatalogPrices.map((row) => (
              <button
                key={row.locality}
                onClick={() => selectPriceArea(row)}
                aria-label={`Visa fastpriset ${row.price} kronor från ${row.locality} till Landvetter`}
              >
                <span>
                  <strong>{row.locality}</strong>
                  <small>{<AppText text={row.region} />}</small>
                </span>
                <b>{<AppText text={row.price} />} <AppText text={"kr"} /></b>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
          {filteredCatalogPrices.length > 9 && (
            <button
              type="button"
              className="showMorePrices"
              aria-expanded={showAllPrices}
              onClick={() => setShowAllPrices((visible) => !visible)}
            >
              {<AppText text={showAllPrices
                ? "Visa färre områden"
                : `Visa ${filteredCatalogPrices.length - 9} fler områden`} />}
              <ChevronRight aria-hidden="true" />
            </button>
          )}
        </div>
      </section>}
      {!appMode && <><footer className="customerFooter">
        <div className="footerBrand">
          <img
            src="/avenyn-logo-optimized.webp"
            width="64"
            height="64"
            alt="Avenyn Taxi"
          />
          <div>
            <b><AppText text={"Avenyn Taxi"} /></b>
            <span>{<AppText text={t.since} />}</span>
          </div>
        </div>
        <div>
          <b>{<AppText text={t.contactUs} />}</b>
          <a href="https://maps.google.com/?q=Kungsportsavenyn+1,+Göteborg">
            <MapPin />
            <AppText text={"Kungsportsavenyn 1, Göteborg"} /></a>
          <a href="tel:+46700315315">+46 700 315 315</a>
          <a href="https://wa.me/46700315315">
            <MessageCircle /> {<AppText text={t.whatsapp} />}
          </a>
          <a href="mailto:info@avenyntaxi.se"><AppText text={"info@avenyntaxi.se"} /></a>
          <p style={{margin:0,lineHeight:1.6,overflowWrap:"anywhere"}}>{lang === "en" ? "Avenyn Taxi is operated by " : "Avenyn Taxi drivs av "}<strong translate="no">Citra Trans och Bilservice Aktiebolag</strong>.<br/>{lang === "en" ? "Company registration number: " : "Organisationsnummer: "}<span translate="no">556597-4796</span>.</p>
        </div>
        <div>
          <b>{<AppText text={t.company} />}</b>
          <a href="/bli-akeripartner"><AppText text={"Bli åkeripartner"} /></a>
          <a href="/"><AppText text={"Avenyn Taxi"} /></a>
          <a href="/taxi-goteborg"><AppText text={"Taxi Göteborg"} /></a>
          <a href="/taxi-landvetter"><AppText text={"Taxi Landvetter"} /></a>
          <a href="/taxi-goteborg-central"><AppText text={"Göteborg Central"} /></a>
        </div>
        {view === "about" ? <ContactForm /> : <div><b><AppText text={"Mer information"} /></b><a href="/priser-omraden"><AppText text={"Priser och områden"} /></a><a href="/om-avenyn-taxi"><AppText text={"Om oss och kontakt"} /></a><a href="/foretagstaxi-goteborg"><AppText text={"Företagstaxi Göteborg"} /></a><a href="/bud-goteborg"><AppText text={"Taxibud Göteborg"} /></a><a href="/taxitjanster-goteborg">Alla taxitjänster</a><a href="/en/services" hrefLang="en">Taxi services in English</a></div>}
        <div className="footerSocialSection"><b>Följ Avenyn Taxi</b><SocialLinks /></div>
        <div className="footerStaffLinks">
          <a className="footerAppDownload" href="/customer?install=1">
            <AppText text={"Installera kundapp"} /></a>
          <a className="footerAppDownload" href="/driver?install=1">
            <AppText text={"Installera förarapp"} /></a>
          <a href="/driver"><AppText text={"Förarapp"} /></a>
          <a href="/dispatch"><AppText text={"Admin"} /></a>
          <a href="/akeri"><AppText text={"Åkeriinloggning"} /></a>
          <a href="/integritet"><AppText text={"Integritet"} /></a>
          <a href="/bokningsvillkor"><AppText text={"Bokningsvillkor"} /></a>
          <a href="/radera-konto"><AppText text={"Radera konto"} /></a>
        </div>
      </footer>
      <nav className="customerMobileTabs" aria-label="Kundmeny">
        <a className={view === "booking" ? "active" : ""} href="/#booking-form">
          <CarFront />
          <span><AppText text={"Boka"} /></span>
        </a>
        <a href="/priser-omraden#priser">
          <Search />
          <span><AppText text={"Priser"} /></span>
        </a>
        <a href="/customer">
          <UserRound />
          <span><AppText text={"Mina resor"} /></span>
        </a>
      </nav>
      {!appMode&&<CustomerSmartGuide />}
      <div className="floatingContactActions">
      <a className="phoneFloat" href="tel:+46700315315" aria-label="Ring Avenyn Taxi, 0700-315 315"><Phone aria-hidden="true" /><span dir="ltr">0700-315 315</span></a>
      <a
        className="whatsappFloat"
        href="https://wa.me/46700315315"
        aria-label="WhatsApp"
      >
        <MessageCircle />
        <span>{<AppText text={t.whatsapp} />}</span>
      </a></div></>}
    </main>
  );
}

export default function Home(props: React.ComponentProps<typeof HomeContent>) {return <AppLanguage kind="customer" picker={false}><HomeContent {...props}/></AppLanguage>}
