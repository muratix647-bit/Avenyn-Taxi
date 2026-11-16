import {partnerAccount,uuid} from '@/lib/partner-server';
import {sendAssignedBookingPush} from '@/lib/push';
export async function GET(request:Request){
 try{const {db,partner}=await partnerAccount(request);
 const [jobs,dl,vl]=await Promise.all([
 db.from('bookings').select('id,booking_number,booking_date,pickup_time,pickup_address,dropoff_address,passengers,car_type,child_seats,extra_message,driver_id,vehicle_id,status,updated_at').eq('assigned_partner_id',partner.id).is('archived_at',null).in('status',['new','scheduled','offered','assigned','accepted','en_route','arrived','passenger_onboard']).order('booking_date').order('pickup_time').limit(501),
 db.from('partner_drivers').select('driver_id').eq('partner_id',partner.id),db.from('partner_vehicles').select('vehicle_id').eq('partner_id',partner.id)]);
 if(jobs.error||dl.error||vl.error)throw Error('Kunde inte hämta uppdragen.');
 const di=(dl.data||[]).map(x=>x.driver_id),vi=(vl.data||[]).map(x=>x.vehicle_id);
 const [drivers,vehicles]=await Promise.all([di.length?db.from('drivers').select('id,full_name,phone').in('id',di).eq('active',true).eq('approved',true).is('archived_at',null):Promise.resolve({data:[],error:null}),vi.length?db.from('vehicles').select('id,registration_number,name,passenger_capacity').in('id',vi).eq('active',true):Promise.resolve({data:[],error:null})]);
 if(drivers.error||vehicles.error)throw Error('Kunde inte hämta förare och bilar.');
 return Response.json({jobs:(jobs.data||[]).slice(0,500),truncated:(jobs.data||[]).length>500,drivers:drivers.data,vehicles:vehicles.data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Logga in.'},{status:403});}
}
export async function POST(request:Request){
 try{const {db,partner}=await partnerAccount(request);const b:any=await request.json();
 if(!uuid(b.bookingId)||!uuid(b.driverId)||!uuid(b.vehicleId)||typeof b.updatedAt!=='string')return Response.json({error:'Välj förare och bil.'},{status:400});
 const {error}=await db.rpc('partner_allocate_booking',{p_partner_id:partner.id,p_booking_id:b.bookingId,p_driver_id:b.driverId,p_vehicle_id:b.vehicleId,p_expected_updated_at:b.updatedAt});
 if(error)return Response.json({error:error.message},{status:409});
 let notified=false;try{const push=await sendAssignedBookingPush(b.bookingId);notified=push.sent>0;}catch{/* Saved allocation remains authoritative even if push fails. */}
 return Response.json({ok:true,notified});
 }catch{return Response.json({error:'Kunde inte tilldela. Logga in i åkeriportalen.'},{status:403});}
}
