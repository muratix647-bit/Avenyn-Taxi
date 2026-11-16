"use client";

import "leaflet/dist/leaflet.css";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { demandZones, type DemandBooking } from "@/lib/dispatch-demand";
import {loadMapEngine, type TrackingMap, type TrackingMarker} from "@/lib/live-map-engine";
import { CarFront, Crosshair, Radio } from "lucide-react";

type Vehicle = {
  id?: string | null;
  number?: string | null;
  registrationNumber?: string | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  vehicleClass?: string | null;
};

type DriverLocation = {
  id?: string | null;
  lat: number | string;
  lng: number | string;
  heading?: number | string | null;
  name?: string | null;
  availability_status?: string | null;
  online?: boolean | null;
  phone?: string | null;
  updated_at?: string | null;
  vehicle?: Vehicle | null;
};

type NumericDriverLocation = Omit<DriverLocation, "lat" | "lng" | "heading"> & {
  lat: number;
  lng: number;
  heading: number;
};

const GOTHENBURG: [number, number] = [11.9746, 57.7089];
const statusLabel: Record<string, string> = {
  available: "Tillgänglig",
  busy: "Upptagen",
  paused: "Pausad",
  offline: "Offline",
};

function carId(car: NumericDriverLocation) {
  return String(car.id ?? car.name ?? `${car.lat}:${car.lng}`);
}

function ageSeconds(updatedAt?: string | null, now = Date.now()) {
  if (!updatedAt) return null;
  const value = new Date(updatedAt).getTime();
  return Number.isFinite(value) ? Math.max(0, Math.round((now - value) / 1000)) : null;
}

function ageText(seconds: number | null) {
  if (seconds === null) return "GPS-tid saknas";
  if (seconds < 60) return `GPS uppdaterad för ${seconds} sek sedan`;
  if (seconds < 3600) return `GPS uppdaterad för ${Math.floor(seconds / 60)} min sedan`;
  if (seconds < 86400) return `GPS uppdaterad för ${Math.floor(seconds / 3600)} tim sedan`;
  return `GPS uppdaterad för ${Math.floor(seconds / 86400)} dygn sedan`;
}

function vehicleTitle(vehicle?: Vehicle | null) {
  if (!vehicle) return "Ingen bil kopplad";
  return [vehicle.number, vehicle.registrationNumber].filter(Boolean).join(" · ") || "Bil kopplad";
}

function vehicleDetails(vehicle?: Vehicle | null) {
  if (!vehicle) return "Koppla en bil under Fordon";
  return [vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(" · ") || vehicle.vehicleClass || "Fordonsuppgifter saknas";
}

function createLeafletMarkerElement(
  car: NumericDriverLocation,
  selected: boolean,
  fresh: boolean,
) {
  const root = document.createElement("button");
  root.type = "button";
  root.className = `dispatchTaxiMarker avenynLeafletMarker ${fresh ? "isLive" : "isStale"}`;
  root.setAttribute("aria-label", `Visa ${car.name ?? "förare"}`);
  root.setAttribute("aria-pressed", String(selected));

  const icon = document.createElement("span");
  icon.className = "avenynTaxiIcon";
  const taxi = document.createElement("small");
  taxi.textContent = "TAXI";
  const symbol = document.createElement("span");
  symbol.className = "dispatchCarSymbol";
  symbol.textContent = "🚕";
  const logo = document.createElement("img");
  logo.src = "/avenyn-logo-optimized.webp";
  logo.width = 28;
  logo.height = 28;
  logo.alt = "";
  logo.setAttribute("aria-hidden", "true");
  icon.appendChild(taxi);icon.appendChild(symbol);icon.appendChild(logo);

  const label = document.createElement("b");
  label.textContent = car.name ?? "Förare";
  root.appendChild(icon);root.appendChild(label);
  return root;
}

function DispatchLiveMapContent({ cars, bookings }: { cars: DriverLocation[]; bookings: DemandBooking[] }) {
  const demandLayer = useRef<{remove():void} | null>(null);
  const [showDemand, setShowDemand] = useState(true);
  const [provider,setProvider]=useState("");
  const [mapError,setMapError]=useState("");
  const [traffic,setTraffic]=useState(false);
  const [satellite,setSatellite]=useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<TrackingMap | null>(null);
  const markersRef = useRef(new Map<string, TrackingMarker>());
  const markerElementsRef = useRef(new Map<string, HTMLButtonElement>());
  const latestCarsRef = useRef(new Map<string, NumericDriverLocation>());
  const animationsRef = useRef(
    new Map<
      string,
      {
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        startedAt: number;
      }
    >(),
  );
  const fittedViewportRef = useRef("");
  const [viewportReset,setViewportReset]=useState(0);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followId, setFollowId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const validCars = useMemo(
    () =>
      (Array.isArray(cars) ? cars : [])
        .filter((car): car is DriverLocation => Boolean(car) && typeof car === "object")
        .filter(
          (car) =>
            car.lat !== null &&
            car.lat !== undefined &&
            String(car.lat).trim() !== "" &&
            car.lng !== null &&
            car.lng !== undefined &&
            String(car.lng).trim() !== "",
        )
        .map((car) => ({
          ...car,
          lat: Number(car.lat),
          lng: Number(car.lng),
          heading: Number(car.heading ?? 0),
        }))
        .filter(
          (car): car is NumericDriverLocation =>
            Number.isFinite(car.lat) &&
            Number.isFinite(car.lng) &&
            car.lat >= -85 &&
            car.lat <= 85 &&
            car.lng >= -180 &&
            car.lng <= 180,
        ),
    [cars],
  );
  const demandMinute = Math.floor(now / 60000);
  const zones = useMemo(() => demandZones(bookings, validCars, demandMinute * 60000), [bookings, validCars, demandMinute]);
  const positionSignature = validCars
    .map((car) => `${carId(car)}:${car.lat}:${car.lng}:${car.updated_at ?? ""}`)
    .join("|");
  const idSignature = validCars.map(carId).sort().join("|");
  const viewportSignature = validCars
    .map((car) => `${carId(car)}:${car.lat.toFixed(5)}:${car.lng.toFixed(5)}`)
    .sort()
    .join("|");
  const selected = validCars.find((car) => carId(car) === selectedId) ?? null;
  const followed = validCars.find((car) => carId(car) === followId) ?? null;
  const freshCount = validCars.filter(
    (car) =>
      Boolean(car.online) &&
      (ageSeconds(car.updated_at, now) ?? Number.POSITIVE_INFINITY) <= 90,
  ).length;
  latestCarsRef.current = new Map(validCars.map((car) => [carId(car), car]));

  useEffect(()=>{const fail=()=>setMapError("Google Maps nekade åtkomst. Kontrollera webbnyckelns domäner, API och fakturering.");window.addEventListener("avenyn-map-auth-error",fail);return()=>window.removeEventListener("avenyn-map-auth-error",fail);},[]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedId && !validCars.some((car) => carId(car) === selectedId))
      setSelectedId(null);
    if (followId && !validCars.some((car) => carId(car) === followId))
      setFollowId(null);
  }, [idSignature, selectedId, followId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    void loadMapEngine().then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, {
        zoomControl: false,
        minZoom: 6,
        maxZoom: 19,
      }).setView([GOTHENBURG[1], GOTHENBURG[0]], 12);
      leaflet.control.zoom({ position: "topright" }).addTo(map);
      leaflet.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "© OpenStreetMap-bidragsgivare",
        },
      ).addTo(map);
      mapRef.current = map;
      setProvider(leaflet.provider);
      setReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    }).catch(()=>setMapError("Kartan kunde inte laddas. Ladda om sidan."));
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      markerElementsRef.current.clear();
      animationsRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void loadMapEngine().then((leaflet) => {
      if (cancelled || !mapRef.current) return;
      const bounds = leaflet.latLngBounds(validCars.map((car) => [car.lat, car.lng]));
      if (followed) {
        map.flyTo([followed.lat, followed.lng], Math.max(map.getZoom(), 16), { duration: 0.85 });
      } else if (bounds.isValid() && fittedViewportRef.current !== `${idSignature}:${viewportReset}`) {
        fittedViewportRef.current = `${idSignature}:${viewportReset}`;
        if (validCars.length === 1) {
          const car = validCars[0];
          map.flyTo([car.lat, car.lng], 16, { duration: 0.7 });
        } else {
          map.fitBounds(bounds, {
            paddingTopLeft: [80, 80],
            paddingBottomRight: [80, 100],
            maxZoom: 15,
            animate: true,
            duration: 0.7,
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [positionSignature, viewportSignature, ready, followId, viewportReset]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void loadMapEngine().then((leaflet) => {
      if (cancelled || mapRef.current !== map) return;
      const activeIds = new Set(validCars.map(carId));
      markersRef.current.forEach((marker, id) => {
        if (activeIds.has(id)) return;
        marker.remove();
        markersRef.current.delete(id);
        markerElementsRef.current.delete(id);
        animationsRef.current.delete(id);
      });

      validCars.forEach((car) => {
        const id = carId(car);
        const fresh =
          Boolean(car.online) &&
          (ageSeconds(car.updated_at) ?? Number.POSITIVE_INFINITY) <= 90;
        const existingMarker = markersRef.current.get(id);
        const existingElement = markerElementsRef.current.get(id);
        if (existingMarker && existingElement) {
          existingElement.classList.toggle("isLive", fresh);
          existingElement.classList.toggle("isStale", !fresh);
          existingElement.setAttribute("aria-pressed", String(id === selectedId));
          const label=existingElement.querySelector("b");if(label)label.textContent=car.name??"Förare";
          const current = existingMarker.getLatLng();
          if (current.lat !== car.lat || current.lng !== car.lng)
            animationsRef.current.set(id, {
              fromLat: current.lat,
              fromLng: current.lng,
              toLat: car.lat,
              toLng: car.lng,
              startedAt: Date.now(),
            });
          return;
        }

        const element = createLeafletMarkerElement(car, id === selectedId, fresh);
        const icon = leaflet.divIcon({
          className: "avenynLeafletIcon",
          html: element,
          iconSize: [160, 100],
          iconAnchor: [80, 50],
        });
        const marker = leaflet.marker([car.lat, car.lng], {
          icon,
          title: car.name ?? "Förare",
          riseOnHover: true,
        }).addTo(map);
        marker.on("click", () => {
          const latest = latestCarsRef.current.get(id);
          if (latest) selectDriver(latest);
        });
        markersRef.current.set(id, marker);
        markerElementsRef.current.set(id, element);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [positionSignature, idSignature, ready, selectedId]);

  useEffect(()=>{markerElementsRef.current.forEach((element,id)=>{const car=latestCarsRef.current.get(id);const fresh=!!car?.online&&(ageSeconds(car?.updated_at,now)??Infinity)<=90;element.classList.toggle("isLive",fresh);element.classList.toggle("isStale",!fresh);});},[now]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      animationsRef.current.forEach((animation, id) => {
        const marker = markersRef.current.get(id);
        if (!marker) {
          animationsRef.current.delete(id);
          return;
        }
        const progress = Math.min(1, (now - animation.startedAt) / 1000);
        marker.setLatLng([
          animation.fromLat + (animation.toLat - animation.fromLat) * progress,
          animation.fromLng + (animation.toLng - animation.fromLng) * progress,
        ]);
        if (progress >= 1) animationsRef.current.delete(id);
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    void loadMapEngine().then(L => {
      if (cancelled || mapRef.current !== map) return;
      demandLayer.current?.remove();
      const layer = L.layerGroup().addTo(map);
      demandLayer.current = layer;
      if (showDemand) zones.forEach(zone => {
        const detail = document.createElement("div");
        detail.textContent = `${zone.waiting} väntande bokningar nästa timme · ${zone.available} lediga bilar med färsk GPS inom 3 km. Området är ungefärligt.`;
        L.circle([zone.lat,zone.lng], {radius:1800,color:zone.color,fillColor:zone.color,weight:2,fillOpacity:.26}).bindPopup(detail).addTo(layer);
      });
    });
    return () => { cancelled = true; demandLayer.current?.remove(); demandLayer.current = null; };
  }, [ready, zones, showDemand]);

  const showDemandAreas = () => {
    setFollowId(null);
    setShowDemand(true);
    if (zones.length) mapRef.current?.fitBounds(zones.map(z => [z.lat,z.lng] as [number,number]), {padding:[65,65],maxZoom:12});
  };

  const selectDriver = (car: NumericDriverLocation, follow = false) => {
    const id = carId(car);
    setSelectedId(id);
    setFollowId(follow ? id : null);
    mapRef.current?.flyTo(
      [car.lat, car.lng],
      Math.max(mapRef.current.getZoom(), follow ? 16 : 15),
      { duration: 0.6 },
    );
  };

  return (
    <div>
      {provider==="openstreetmap"&&<p className="mapSetupNotice">Google-kartan väntar på webbnyckeln. Livepositionerna visas tills vidare på reservkartan.</p>}
      {mapError&&ready&&<p role="alert" className="mapSetupNotice">{mapError}</p>}
      {provider==="google"&&<div className="mapModeControls"><button type="button" aria-pressed={traffic} onClick={()=>{setTraffic(!traffic);mapRef.current?.setTraffic?.(!traffic);}}>Trafik {traffic?"på":"av"}</button><button type="button" aria-pressed={satellite} onClick={()=>{setSatellite(!satellite);mapRef.current?.setSatellite?.(!satellite);}}>{satellite?"Vanlig karta":"Satellit"}</button></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center",padding:"12px 0"}}>
        <button type="button" aria-pressed={showDemand} onClick={()=>setShowDemand(v=>!v)}>{showDemand ? "Dölj efterfrågan" : "Visa efterfrågan"}</button>
        {zones.length>0 && <button type="button" onClick={showDemandAreas}>Visa områden</button>}
        <span>🟡 Bokningar · 🟠 Fler bokningar · 🔴 Minst 3, fler än lediga bilar</span>
        <small style={{flexBasis:"100%"}}>Riktiga, ej tilldelade bokningar nästa timme · Uppdateras automatiskt. {zones.length===0 ? "Inga väntande bokningar med kartposition just nu." : "Tryck på ett område för antal. Färgerna anger efterfrågan, inte pristillägg."}</small>
      </div>
    <div className="dispatchTrackingGrid">
      <div className="liveMap dispatchLiveMap">
        <div ref={containerRef} className="dispatchMapCanvas" />
        <button type="button" className="mapResetView" onClick={()=>{setFollowId(null);setViewportReset(v=>v+1);}}>Visa alla bilar</button>
        {!ready && <div className="dispatchMapLoading">{mapError||"Öppnar livekartan…"}</div>}
        {selected && (
          <div className="dispatchDriverPopup" role="status">
            <button type="button" aria-label="Stäng förarinformation" onClick={() => setSelectedId(null)}>×</button>
            <span>
              {selected.online && (ageSeconds(selected.updated_at, now) ?? Number.POSITIVE_INFINITY) <= 90
                ? "LIVEPOSITION"
                : "SENASTE KÄNDA POSITION"}
            </span>
            <b>{selected.name ?? "Förare"}</b>
            <small>{selected.online ? statusLabel[selected.availability_status ?? ""] ?? "Online" : "Offline"}</small>
            <strong>{vehicleTitle(selected.vehicle)}</strong>
            <time>{ageText(ageSeconds(selected.updated_at, now))}</time>
            {selected.phone&&<a style={{display:"block",padding:"10px 0",fontWeight:700}} href={`tel:${selected.phone.replace(/[^+\d]/g, "")}`}>Ring föraren</a>}
          </div>
        )}
        {!validCars.length && !zones.length && (
          <div className="dispatchMapEmpty">
            <CarFront />
            <b>Ingen sparad GPS-position</b>
            <span>En bil visas här så snart förarappen har skickat sin första position.</span>
          </div>
        )}
        <div className="dispatchMapLiveStatus">
          <Radio />
          <span>{followed ? `Följer ${followed.name ?? "förare"}` : `${freshCount} live · ${validCars.length - freshCount} senaste position`}</span>
          <b>{validCars.length} på kartan</b>
        </div>
      </div>

      <aside className="dispatchOnlineDrivers" aria-label="Onlineförare och bilar">
        <header>
          <div><small>KARTÖVERSIKT</small><h3>Förare och bilar</h3></div>
          <b>{validCars.length}</b>
        </header>
        <div>
          {validCars.map((car) => {
            const id = carId(car);
            const seconds = ageSeconds(car.updated_at, now);
            const fresh =
              Boolean(car.online) &&
              (seconds ?? Number.POSITIVE_INFINITY) <= 90;
            return (
              <article className={fresh ? "isLive" : "isStale"} key={id}>
                <button type="button" className="dispatchDriverSelect" onClick={() => selectDriver(car)}>
                  <span className="dispatchDriverStatusDot" />
                  <span>
                    <b>{car.name ?? "Förare"}</b>
                    <small>{car.online ? statusLabel[car.availability_status ?? ""] ?? "Online" : "Offline"}</small>
                  </span>
                </button>
                <div className="dispatchVehicleLine">
                  <CarFront />
                  <span><b>{vehicleTitle(car.vehicle)}</b><small>{vehicleDetails(car.vehicle)}</small></span>
                </div>
                <time>{fresh ? "Live · " : "Senaste kända · "}{ageText(seconds)}</time>
                <button
                  type="button"
                  className={`dispatchFollowButton${followId === id ? " active" : ""}`}
                  onClick={() => {
                    if (followId === id) setFollowId(null);
                    else selectDriver(car, true);
                  }}
                >
                  <Crosshair /> {followId === id ? "Sluta följa" : "Följ på kartan"}
                </button>
              </article>
            );
          })}
          {!validCars.length && <p>Ingen förare har ännu en sparad GPS-position.</p>}
        </div>
      </aside>
    </div>
    </div>
  );
}

class DispatchMapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dispatch-kartan kunde inte visas", error, info);
  }

  render() {
    if (this.state.failed)
      return (
        <div className="dispatchMapEmpty dispatchMapFallback" role="status">
          <CarFront />
          <b>Kartan kunde inte visas</b>
          <span>Onlineförarna visas fortfarande under fliken Förare.</span>
        </div>
      );
    return this.props.children;
  }
}

export default function DispatchLiveMap({ cars = [], bookings = [] }: { cars?: DriverLocation[]; bookings?: DemandBooking[] }) {
  return (
    <DispatchMapBoundary>
      <DispatchLiveMapContent cars={cars} bookings={bookings} />
    </DispatchMapBoundary>
  );
}
