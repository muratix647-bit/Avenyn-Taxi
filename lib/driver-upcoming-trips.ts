import {pickupAt} from './prebooking-watch';
import {contactVisible} from './driver-trip-privacy';
/** Future reservations stay compact until 30 minutes before their Swedish pickup time. */
export function driverUpcomingTrips(trips:any[], now:number) {
 const myTrips=trips.filter(contactVisible).slice().sort((a,b)=>(pickupAt(a)||0)-(pickupAt(b)||0));
 const nextTrip=myTrips.find(t=>t.status==='accepted');
 const imminentTrip=myTrips.find(t=>t.status==='accepted'&&(!Number.isFinite(pickupAt(t))||pickupAt(t)-now<=30*60*1000));
 return {myTrips,nextTrip,imminentTrip};
}
