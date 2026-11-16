import {pickupAt} from './prebooking-watch';

/** Shared operational details only; customer contact details never enter the board. */
export function prebookingBoard(candidates:any[],pool:any[],driverId:string,acceptsPets:boolean,now=Date.now()) {
 const offered=new Map(pool.map(b=>[String(b.id),b]));
 return candidates.filter(b=>{
  const at=pickupAt(b);
  const available=!b.driver_id&&!b.assigned_partner_id&&['new','scheduled','confirmed'].includes(b.status);
  return available || (b.driver_id===driverId && at>now-30*60*1000);
 }).map(b=>{
  const available=!b.driver_id&&!b.assigned_partner_id&&['new','scheduled','confirmed'].includes(b.status);
  const canClaim=available&&offered.has(String(b.id))&&(!b.pet_details||acceptsPets);
  return {id:b.id,booking_number:b.booking_number,booking_date:b.booking_date,pickup_time:b.pickup_time,
   pickup_address:b.pickup_address,dropoff_address:b.dropoff_address,passengers:b.passengers,
   car_type:b.car_type,child_seats:b.child_seats,luggage_count:b.luggage_count,pet_details:b.pet_details,
   price:Number(b.fixed_price??b.estimated_price??0),stop_address:b.price_breakdown?.stop_address||null,
   can_claim:canClaim,available,overdue:available&&pickupAt(b)<now,assigned_to_me:b.driver_id===driverId,
   availability_label:b.driver_id===driverId?'Din körning':!available?'Tilldelad – ej ledig':canClaim?'Ledig – kan accepteras':b.pet_details&&!acceptsPets?'Ledig – aktivera djurresor':'Kontakta trafikledningen'};
 });
}
