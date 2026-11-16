import {pickupAt} from './prebooking-watch';
export function driverReminderStage(booking:any,now=Date.now()):30|15|null {
 if(booking.archived_at||booking.status!=='accepted'||!booking.driver_id)return null;
 const minutes=(pickupAt(booking)-now)/60000;
 if(!Number.isFinite(minutes)||minutes<0||minutes>30)return null;
 // A late run sends only the most relevant reminder, never both at once.
 return minutes<=15?15:30;
}
export function driverReminderPayload(booking:any,stage:30|15,now=Date.now()) {
 const time=new Date(pickupAt(booking)).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'});
 return {title:stage===15?'Påminnelse · du har inte markerat På väg':`Kommande körning kl. ${time}`,
 body:`Bokning #${booking.booking_number} · Hämtning kl. ${time} · ${booking.pickup_address}. Öppna körningen och tryck Kör till kunden när du åker.`,
 tag:`driver-reminder-${stage}-${booking.id}`,
 url:`/driver?booking=${encodeURIComponent(booking.id)}&reminder=${stage}`,
 ttl:Math.max(1,Math.min(stage*60,Math.floor((pickupAt(booking)-now)/1000)))};
}
