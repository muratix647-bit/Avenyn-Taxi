import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node executes this test directly with type stripping.
import { cleanSavedPlace, rebookDetails } from "./rebook.ts";

const booking = {
  pickup: "Avenyn 10", pickupLat: 57.7, pickupLng: 11.9, pickupPlaceId: "pickup-id",
  destination: "Landvetter Airport", destinationLat: 57.6688, destinationLng: 12.2923,
  destinationPlaceId: "airport-id", passengers: 5, vehicle: "standard", childSeats: 1,
  stop: { label: "Stopp 2", lat: 57.71, lng: 11.92 },
  pickupTime: "2020-01-01T12:00", price: 1, paymentStatus: "paid", flightNumber: "OLD123",
  trackingToken: "private-token", customerPhone: "private-phone",
};

test("return booking reverses full places, retains a stop and selects a large car for five", () => {
  const result = rebookDetails(booking, true);
  assert.equal(result.from.id, "airport-id");
  assert.equal(result.from.lat, 57.6688);
  assert.equal(result.to.id, "pickup-id");
  assert.equal(result.stop?.label, "Stopp 2");
  assert.equal(result.vehicle, "large");
});

test("repeat booking never carries old price, payment, time, flight or private link", () => {
  const result = rebookDetails(booking);
  assert.equal(result.from.label, booking.pickup);
  assert.deepEqual(Object.keys(result).sort(), ["from", "passengers", "seats", "stop", "to", "vehicle"]);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("stored addresses reject missing labels, invalid coordinates and unwanted properties", () => {
  assert.equal(cleanSavedPlace(null), null);
  assert.equal(cleanSavedPlace({ label: " " }), null);
  assert.deepEqual(cleanSavedPlace({ label: " Hem 1 ", lat: 95, lng: 12, customerPhone: "secret" }), { label: "Hem 1" });
  assert.deepEqual(cleanSavedPlace({ label: "Hem 1", lat: null, lng: null }), { label: "Hem 1" });
  assert.throws(() => rebookDetails({ pickup: "A" }));
});
