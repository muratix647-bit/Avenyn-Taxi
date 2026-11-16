import {pickupAt} from "./prebooking-watch";
export const POLICY_VERSION="2026-10-02-booking-confirmation";
export function timeChangesClosed(_booking:any,_now=Date.now()){return false;}
export function lateCancellation(booking:any,now=Date.now()){const at=pickupAt(booking);return !Number.isFinite(at)||at-now<=86400000;}
export const POLICY_SHORT="Datum och tid kan ändras i kundappen innan hämtningen har påbörjats, även sista dygnet. Vid avbokning inom 24 timmar eller utebliven resa debiteras hela det bekräftade priset.";
