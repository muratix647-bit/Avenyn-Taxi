"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

type Point = { lat: number; lng: number };
type Car = Point & { id?: string; name?: string; online?: number; heading?: number; updatedAt?: string | null };
const GOTHENBURG: [number, number] = [11.9746, 57.7089];
const TAXI_TONES = 5;

function coveragePolygon(center: [number, number], radiusKm = 30, points = 72) {
  const [lng, lat] = center;
  const coordinates = Array.from({ length: points + 1 }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    const latOffset = (radiusKm / 111.32) * Math.sin(angle);
    const lngOffset =
      (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) *
      Math.cos(angle);
    return [lng + lngOffset, lat + latOffset];
  });
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}

function fallbackBounds(points: Point[]) {
  if (!points.length) return { west: 11.72, east: 12.22, south: 57.54, north: 57.86 };
  if (points.length === 1) return { west: points[0].lng - .035, east: points[0].lng + .035, south: points[0].lat - .022, north: points[0].lat + .022 };
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const latPad = Math.max(.012, (Math.max(...lats) - Math.min(...lats)) * .2);
  const lngPad = Math.max(.018, (Math.max(...lngs) - Math.min(...lngs)) * .2);
  return { west: Math.min(...lngs) - lngPad, east: Math.max(...lngs) + lngPad, south: Math.min(...lats) - latPad, north: Math.max(...lats) + latPad };
}

function mercatorY(lat: number) {
  const radians = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function fallbackMarkerPosition(point: Point, bounds: ReturnType<typeof fallbackBounds>) {
  const northY = mercatorY(bounds.north);
  const southY = mercatorY(bounds.south);
  const left = ((point.lng - bounds.west) / (bounds.east - bounds.west)) * 100;
  const top = ((northY - mercatorY(point.lat)) / (northY - southY)) * 100;
  return {
    left: `${Math.max(5, Math.min(95, left))}%`,
    top: `${Math.max(9, Math.min(91, top))}%`,
  };
}

function createMarkerElement(
  kind: "taxi" | "pickup" | "destination",
  label: string,
  taxiNumber?: number,
) {
  const marker = document.createElement("div");
  marker.className = `advancedMapMarker ${kind}${kind === "taxi" ? ` tone-${(taxiNumber || 1) % TAXI_TONES}` : ""}`;
  marker.setAttribute("aria-label", label);
  const icon = document.createElement("span");
  icon.className = "advancedMapMarkerIcon";
  const iconText = document.createElement("span");
  iconText.textContent =
    kind === "taxi" ? "🚕" : kind === "pickup" ? "A" : "B";
  icon.appendChild(iconText);
  marker.appendChild(icon);
  const text = document.createElement("b");
  text.textContent = label;
  marker.appendChild(text);
  return marker;
}

export default function LiveMap({ cars, exact = false, colorsOnly = false, interactionLocked = false, customerLocation: pickupPoint, destinationLocation: destinationPoint }: { cars: Car[]; exact?: boolean; colorsOnly?: boolean; interactionLocked?: boolean; customerLocation?: Point; destinationLocation?: Point }) {
  const customerLocation = colorsOnly ? undefined : pickupPoint;
  const destinationLocation = colorsOnly ? undefined : destinationPoint;
  const [demand,setDemand]=useState<{lat:number;lng:number;color:string}[]>([]);
  const [demandAvailable,setDemandAvailable]=useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const fittedRef = useRef("");
  const [viewportReset,setViewportReset]=useState(0);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const visibleCars = useMemo(() => (colorsOnly ? [] : cars).filter((car) => Number.isFinite(car.lat) && Number.isFinite(car.lng)).map((car) => ({ ...car, lat: exact ? car.lat : Math.round(car.lat * 200) / 200, lng: exact ? car.lng : Math.round(car.lng * 200) / 200 })), [cars, exact, colorsOnly]);
  const fallbackFrame = useMemo(() => {
    const points: Point[] = [...visibleCars, ...(customerLocation ? [customerLocation] : []), ...(destinationLocation ? [destinationLocation] : [])];
    const bounds = fallbackBounds(points);
    const bbox = [bounds.west, bounds.south, bounds.east, bounds.north].map((value) => value.toFixed(6)).join("%2C");
    return { bounds, url: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik` };
  }, [visibleCars, customerLocation, destinationLocation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let cancelled = false;
    let observer: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    const initialise = async () => {
      if (cancelled || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        center: GOTHENBURG,
        zoom: 11.2,
        minZoom: 6,
        maxZoom: 18,
        attributionControl: false,
        style: {
          version: 8,
          sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap-bidragsgivare" } },
          layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.12, "raster-contrast": 0.06 } }],
        },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => {
        map.addSource("service-area", {
          type: "geojson",
          data: coveragePolygon(GOTHENBURG),
        });
        map.addLayer({
          id: "service-area-fill",
          type: "fill",
          source: "service-area",
          paint: { "fill-color": "#087fc7", "fill-opacity": 0.07 },
        });
        map.addLayer({
          id: "service-area-line",
          type: "line",
          source: "service-area",
          paint: {
            "line-color": "#087fc7",
            "line-opacity": 0.55,
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });
        setReady(true);
      });
      map.on("idle", () => { if (map.areTilesLoaded()) setTilesReady(true); });
      map.on("error", () => setReady(true));
      mapRef.current = map;
      resizeObserver = new ResizeObserver(()=>map.resize());
      resizeObserver.observe(container);
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { observer?.disconnect(); void initialise().catch(()=>{if(!cancelled)setReady(true);}); }
      }, { rootMargin: "250px" });
      observer.observe(container);
    } else void initialise().catch(()=>{if(!cancelled)setReady(true);});
    return () => {
      cancelled = true;
      observer?.disconnect();
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map=mapRef.current;if(!map||!ready)return;
    if(interactionLocked)map.stop();
    for(const handler of [map.dragPan,map.scrollZoom,map.boxZoom,map.doubleClickZoom,map.keyboard,map.dragRotate,map.touchZoomRotate]){
      if(interactionLocked)handler.disable();else handler.enable();
    }
  },[interactionLocked,ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    const renderMarkers = async () => {
      const { Marker, LngLatBounds } = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      const markers: MapLibreMarker[] = [];
      const bounds = new LngLatBounds();
      visibleCars.forEach((car, index) => {
        const label = exact && car.name ? car.name : `Bil ${index + 1}`;
        markers.push(new Marker({ element: createMarkerElement("taxi", exact ? `${label} · senaste GPS-position` : `${label} · ungefärlig position`, index + 1), anchor: "bottom" }).setLngLat([car.lng, car.lat]).addTo(map));
        bounds.extend([car.lng, car.lat]);
      });
      if (customerLocation) {
        markers.push(new Marker({ element: createMarkerElement("pickup", "Hämtning"), anchor: "bottom" }).setLngLat([customerLocation.lng, customerLocation.lat]).addTo(map));
        bounds.extend([customerLocation.lng, customerLocation.lat]);
      }
      if (destinationLocation) {
        markers.push(new Marker({ element: createMarkerElement("destination", "Destination"), anchor: "bottom" }).setLngLat([destinationLocation.lng, destinationLocation.lat]).addTo(map));
        bounds.extend([destinationLocation.lng, destinationLocation.lat]);
      }
      markersRef.current = markers;
      const signature = JSON.stringify([visibleCars.map(c=>c.id||c.name||"taxi").sort(),customerLocation,destinationLocation,viewportReset]);
      if(fittedRef.current===signature) return;
      fittedRef.current=signature;
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: { top: 78, right: 64, bottom: 88, left: 64 }, maxZoom: 15.2, duration: 700 });
      else map.easeTo({ center: GOTHENBURG, zoom: 11.2, duration: 600 });
    };
    void renderMarkers();
    return () => { cancelled = true; };
  }, [visibleCars, customerLocation, destinationLocation, exact, ready, viewportReset]);

  useEffect(()=>{
    if(exact)return;
    const controller=new AbortController();
    const load=async()=>{if(document.hidden)return;try{const r=await fetch('/api/demand',{signal:controller.signal});if(!r.ok)throw Error();const data:any=await r.json();setDemand(data.zones||[]);setDemandAvailable(true);}catch{if(!controller.signal.aborted){setDemand([]);setDemandAvailable(false);}}};
    void load();const timer=setInterval(load,15000);document.addEventListener('visibilitychange',load);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',load);};
  },[exact]);
  useEffect(()=>{
    const map=mapRef.current;if(exact||!ready||!map)return;
    const update=()=>{
      if(!map.isStyleLoaded())return;
      const data={type:'FeatureCollection' as const,features:demand.map(z=>({...coveragePolygon([z.lng,z.lat],1.8,40),properties:{color:z.color}}))};
      const source=map.getSource('public-demand') as any;
      if(source)source.setData(data);
      else{map.addSource('public-demand',{type:'geojson',data});map.addLayer({id:'public-demand-fill',type:'fill',source:'public-demand',paint:{'fill-color':['get','color'],'fill-opacity':.3}});map.addLayer({id:'public-demand-outline',type:'line',source:'public-demand',paint:{'line-color':['get','color'],'line-width':2}});}
    };
    update();map.on('load',update);return()=>{map.off('load',update);};
  },[demand,ready,exact]);

  return <div className={`liveMap advancedMap${exact ? " exactTripMap" : ""}`}>
    <iframe className="advancedMapFallback" title="Karta över Göteborg och resan" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={fallbackFrame.url} />
    <div ref={containerRef} className={`advancedMapCanvas${tilesReady ? " mapTilesReady" : ""}`} role="region" aria-label="Interaktiv karta över Göteborg och resan" />
    {!tilesReady && visibleCars.map((car, index) => (
      <div
        className={`advancedMapFallbackTaxi tone-${(index + 1) % TAXI_TONES}`}
        style={fallbackMarkerPosition(car, fallbackFrame.bounds)}
        key={car.id ?? `${car.lat}:${car.lng}:${index}`}
        aria-label={`Bil ${index + 1}, ungefärlig position`}
      >
        <span>🚕</span>
        <b>{exact && car.name ? car.name : `Bil ${index + 1}`}</b>
      </div>
    ))}
    {!ready && <div className="advancedMapLoading"><span />Laddar interaktiv karta…</div>}
    <button type="button" className="mapResetView" onClick={()=>setViewportReset(v=>v+1)}>{colorsOnly ? "Visa Göteborg" : "Visa hela resan"}</button>
    <div className="advancedMapBadge"><i /><span><small>AVENYN TAXI</small><b>Livekarta Göteborg</b></span></div>
    {!exact && <div className="publicDemandLegend">{demandAvailable ? (demand.length ? "🟡 Efterfrågan · 🟠 Fler bokningar · 🔴 Högt tryck · Nästa timme" : "Ingen väntande efterfrågan att visa just nu") : "Efterfrågan är tillfälligt otillgänglig"}</div>}
    {!exact && !colorsOnly && <div className="advancedCoverageBadge"><span />Täckningsområde · Göteborg med omnejd</div>}
    {!colorsOnly && <div className="mapLegend"><b>{visibleCars.length}</b><span>{exact ? "tilldelad bil" : visibleCars.length === 1 ? "bil online" : "bilar online"}</span></div>}
    {(customerLocation||destinationLocation) && <div className="advancedMapKey"><span><i className="pickup" />Hämtning</span><span><i className="destination" />Destination</span></div>}
  </div>;
}
