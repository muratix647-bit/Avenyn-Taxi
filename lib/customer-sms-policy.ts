import {pickupAt} from './prebooking-watch';
export function reminderDue(booking:any,now=Date.now()) {
 const at=pickupAt(booking);
 return !booking.archived_at && !['completed','cancelled','passenger_onboard'].includes(booking.status) && Number.isFinite(at) && at>now && at-now<=3600000;
}
export function flightSmsEvent(flight:any,direction:string) {
 const cancelled=/cnl|can|instäl|borttagen|cancel/i.test(`${flight.statusCode||''} ${flight.status||''}`);
 if(cancelled)return {key:'cancelled',message:'Ditt flyg är inställt.'};
 if(flight.actualUtc)return null;
 const delay=Date.parse(flight.estimatedUtc)-Date.parse(flight.scheduledUtc);
 if(!Number.isFinite(delay)||delay<60000)return null;
 const time=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(flight.estimatedUtc));
 return {key:`delay:${flight.estimatedUtc}`,message:`Ditt flyg är försenat. Beräknad ${direction==='departures'?'avgång':'ankomst'} ${time}.`};
}
