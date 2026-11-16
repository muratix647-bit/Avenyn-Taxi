import { storedStop } from "./booking-options";

export type NavigationPoint = { lat: number; lng: number; title: string };

export function navigationPoint(lat: unknown, lng: unknown, title: string): NavigationPoint | null {
  if (lat == null || lng == null || String(lat).trim() === "" || String(lng).trim() === "") return null;
  const latitude = Number(lat), longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { lat: latitude, lng: longitude, title } : null;
}

export function navigationRoute(trip: any, toDestination: boolean) {
  const address = String(toDestination ? trip.destination : trip.pickup);
  const target = navigationPoint(toDestination ? (trip.destination_lat ?? trip.dropoff_lat) : trip.pickup_lat,
    toDestination ? (trip.destination_lng ?? trip.dropoff_lng) : trip.pickup_lng, address);
  const stop = toDestination ? storedStop(trip) : null;
  const via = stop?.label ? navigationPoint(stop.lat, stop.lng, stop.label) : null;
  // Never silently skip a booked stop if its coordinates are absent.
  const nativePoints = target && (!stop?.label || via) ? [...(via ? [via] : []), target] : null;
  const params = new URLSearchParams({ api: "1", dir_action: "navigate", destination: target ? `${target.lat},${target.lng}` : address, travelmode: "driving" });
  if (stop?.label) params.set("waypoints", via ? `${via.lat},${via.lng}` : stop.label);
  return { nativePoints, externalUrl: `https://www.google.com/maps/dir/?${params}` };
}
