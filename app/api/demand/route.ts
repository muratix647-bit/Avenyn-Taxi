import {adminSupabase} from '@/lib/supabase-server';
import {demandZones} from '@/lib/dispatch-demand';
export async function GET(){
 try{
  const db=adminSupabase(),now=Date.now();
  const day=(n:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(n));
  const [jobs,drivers,locations]=await Promise.all([
   db.from('bookings').select('status,booking_date,pickup_time,pickup_lat,pickup_lng').in('status',['new','scheduled','offered']).is('archived_at',null).is('driver_id',null).is('assigned_partner_id',null).gte('booking_date',day(now)).lte('booking_date',day(now+3600000)).limit(1000),
   db.from('drivers').select('id').eq('active',true).eq('approved',true).eq('is_online',true).eq('availability_status','available').is('archived_at',null).limit(1000),
   db.from('driver_locations').select('driver_id,latitude,longitude,updated_at').gte('updated_at',new Date(now-180000).toISOString()).limit(1000)
  ]);
  if(jobs.error||drivers.error||locations.error)throw Error('Demand unavailable');
  const allowed=new Set((drivers.data||[]).map(d=>d.id));
  const cars=[...new Map((locations.data||[]).filter(l=>allowed.has(l.driver_id)).map(l=>[l.driver_id,{lat:l.latitude,lng:l.longitude,updated_at:l.updated_at,online:true,availability_status:'available'}])).values()];
  const zones=demandZones((jobs.data||[]).map(b=>({...b,pickup_time:b.booking_date+'T'+b.pickup_time})),cars,Math.floor(now/60000)*60000);
  // Only coarse cell centers and demand bands are public. No addresses, IDs or exact counts.
  return Response.json({zones:zones.map(z=>({lat:z.lat,lng:z.lng,color:z.color})),updatedAt:new Date(now).toISOString()},{headers:{'Cache-Control':'public, max-age=15, s-maxage=15'}});
 }catch{return Response.json({error:'Efterfrågan kunde inte hämtas',zones:[]},{status:503,headers:{'Cache-Control':'no-store'}});}
}
