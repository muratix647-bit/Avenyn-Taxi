export type SavedPlace = { label: string; lat?: number; lng?: number; id?: string; area?: string };

export function cleanSavedPlace(value: any): SavedPlace | null {
  if (!value || typeof value.label !== "string" || !value.label.trim()) return null;
  const result: SavedPlace = { label: value.label.trim().slice(0, 300) };
  if (typeof value.lat === "number" && typeof value.lng === "number" &&
      Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
      Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180) {
    result.lat = value.lat;
    result.lng = value.lng;
  }
  if (typeof value.id === "string") result.id = value.id.slice(0, 180);
  if (typeof value.area === "string") result.area = value.area.slice(0, 120);
  return result;
}

// Only route and passenger options are reused. Dates, quotes, payments and flight
// details belong to the old booking and must be selected/calculated afresh.
export function rebookDetails(booking: any, reverse = false) {
  const pickup = cleanSavedPlace({ label: booking.pickup, lat: booking.pickupLat, lng: booking.pickupLng, id: booking.pickupPlaceId });
  const destination = cleanSavedPlace({ label: booking.destination, lat: booking.destinationLat, lng: booking.destinationLng, id: booking.destinationPlaceId });
  if (!pickup || !destination) throw new Error("Resans adresser saknas.");
  const passengers = Math.max(1, Math.min(7, Math.trunc(Number(booking.passengers) || 1)));
  return {
    from: reverse ? destination : pickup,
    to: reverse ? pickup : destination,
    stop: cleanSavedPlace(booking.stop),
    passengers,
    vehicle: passengers > 4 || booking.vehicle === "large" ? "large" : "standard",
    seats: Math.max(0, Math.min(3, Math.trunc(Number(booking.childSeats) || 0))),
  };
}
