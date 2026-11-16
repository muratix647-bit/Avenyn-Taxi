// Database date/time pairs are Swedish wall time; never reinterpret them in the device timezone.
export function driverPickupLabel(trip:{booking_date?:string;pickup_time?:string}):string{
 const raw=String(trip.pickup_time||'');
 if(/(?:Z|[+-]\d{2}:\d{2})$/.test(raw)&&raw.includes('T')){
  const instant=new Date(raw);
  if(!Number.isNaN(instant.getTime()))return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(instant).replace(' ', ' kl. ');
 }
 const date=raw.match(/^(\d{4}-\d{2}-\d{2})[T ]/)?.[1]||String(trip.booking_date||'').slice(0,10);
 const time=raw.match(/(?:^|[T ])(\d{2}:\d{2})(?::|$)/)?.[1];
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&time?`${date} kl. ${time}`:'Datum eller tid saknas – kontakta trafikledningen';
}
