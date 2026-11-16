/** Acceptance reserves a booking; only departure starts navigation. */
export const journeyStarted = (trip: any) => ['en_route','arrived','passenger_onboard'].includes(trip?.status);
export function driverMapTrip(trips:any[],selectedId:string|null) {
 return trips.find(t=>['offered','assigned'].includes(t.status))
  || trips.find(t=>t.id===selectedId&&journeyStarted(t))
  || trips.find(journeyStarted)
  || trips.find(t=>t.id===selectedId&&t.status==='accepted');
}
