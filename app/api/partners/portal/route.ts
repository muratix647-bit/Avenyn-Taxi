import {stockholmDay,monthPeriod,validPeriod} from '@/lib/report-period';
import {partnerAccount} from '@/lib/partner-server';
export async function GET(request:Request){
 try{
  const {db,partner}=await partnerAccount(request);
  const params=new URL(request.url).searchParams;
  const fallback=monthPeriod();const period={from:params.get('from')||fallback.from,to:params.get('to')||fallback.to};
  if(!validPeriod(period))return Response.json({error:'Välj ett giltigt datumintervall.'},{status:400});
  const start=period.from;const next=new Date(Date.parse(period.to)+86400000).toISOString().slice(0,10);
  const [driverLinks,vehicleLinks]=await Promise.all([db.from('partner_drivers').select('driver_id,created_at').eq('partner_id',partner.id),db.from('partner_vehicles').select('vehicle_id').eq('partner_id',partner.id)]);
  if(driverLinks.error||vehicleLinks.error)throw new Error('Kunde inte hämta åkeriets uppgifter.');
  const driverIds=(driverLinks.data||[]).map(r=>r.driver_id),vehicleIds=(vehicleLinks.data||[]).map(r=>r.vehicle_id);
  const ownerFilter=driverIds.length?`assigned_partner_id.eq.${partner.id},and(assigned_partner_id.is.null,driver_id.in.(${driverIds.join(",")}))`:`assigned_partner_id.eq.${partner.id}`;
  const dateFilter=`and(completed_at.gte.${new Date(Date.parse(start)-86400000).toISOString()},completed_at.lt.${new Date(Date.parse(next)+86400000).toISOString()}),and(completed_at.is.null,booking_date.gte.${start},booking_date.lt.${next})`;
  const [drivers,vehicles,bookings]=await Promise.all([
   driverIds.length?db.from('drivers').select('id,full_name,phone,status,registration_number').in('id',driverIds).is('archived_at',null):Promise.resolve({data:[],error:null}),
   vehicleIds.length?db.from('vehicles').select('id,name,registration_number,model,status').in('id',vehicleIds).eq('active',true):Promise.resolve({data:[],error:null}),
   db.from('bookings').select('id,booking_number,driver_id,booking_date,pickup_time,pickup_address,dropoff_address,status,driver_reported_amount,actual_price,fixed_price,estimated_price,payment_status,driver_reported_payment_method,completed_at,assigned_partner_id').or(`and(or(${ownerFilter}),or(${dateFilter}))`).is('archived_at',null).order('booking_date',{ascending:false}).order('pickup_time',{ascending:false}).limit(2001),
  ]);
  if(drivers.error||vehicles.error||bookings.error)throw new Error('Kunde inte hämta körningarna.');
  const truncated=(bookings.data||[]).length>2000;
  // Only trips dated from the driver's attachment onwards belong in this portal.
  const linkedSince=new Map((driverLinks.data||[]).map(r=>[r.driver_id,new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created_at))]));
  const trips=(bookings.data||[]).slice(0,2000).filter(row=>{const day=row.completed_at?stockholmDay(row.completed_at):row.booking_date;return day>=start&&day<next;}).filter(row=>row.assigned_partner_id===partner.id||(!row.assigned_partner_id&&row.booking_date>=String(linkedSince.get(row.driver_id)))).map(row=>({...row,amount:Number(row.driver_reported_amount??row.actual_price??row.fixed_price??row.estimated_price??0)}));
  const completed=trips.filter(row=>row.status==='completed');
  return Response.json({partner,period,drivers:drivers.data,vehicles:vehicles.data,trips,truncated,summary:{completed:completed.length,amount:completed.reduce((sum,row)=>sum+row.amount,0)}},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Kunde inte hämta åkeriet.'},{status:403});}
}
