export function pickupAt(b: any): number {
  const raw = String(b.pickup_time || '');
  const local = raw.includes('T') ? raw.slice(0,19) : `${b.booking_date || ''}T${raw.slice(0,8)}`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return NaN;
  const target = Date.parse(local.length === 16 ? `${local}:00Z` : `${local}Z`);
  if (!Number.isFinite(target)) return NaN;
  let value = target;
  for (let i=0;i<3;i++) {
    const parts = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    value += target-represented;
  }
  return value;
}
export function prebookingRisk(b:any,now=Date.now()): {stage:15|30|60; message:string}|null {
  if (b.archived_at || ['completed','cancelled','en_route','arrived','passenger_onboard'].includes(b.status)) return null;
  const minutes = (pickupAt(b)-now)/60000;
  if (!Number.isFinite(minutes) || minutes < -120 || minutes > 60) return null;
  if (minutes<=15) return {stage:15,message:'Föraren har inte markerat På väg'};
  if (minutes<=30 && b.status!=='accepted') return {stage:30,message:'Ingen förare har accepterat'};
  if (!b.driver_id && !b.assigned_driver_id) return {stage:60,message:'Förare saknas'};
  return null;
}
