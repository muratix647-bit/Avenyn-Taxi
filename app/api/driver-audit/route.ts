import {adminSupabase,requireSupabaseUser} from '@/lib/supabase-server';
export async function GET(request:Request){
 try{const {supabase,user}=await requireSupabaseUser(request);const role=await supabase.rpc('is_dispatch_admin');if(role.error)throw role.error; const isAdmin=!!role.data; const person=!isAdmin?await adminSupabase().from('drivers').select('id').eq('auth_user_id',user.id).eq('active',true).eq('approved',true).is('archived_at',null).single():null;if(!isAdmin&&!person?.data)return Response.json({error:'Ingen åtkomst'},{status:403});
 const id=new URL(request.url).searchParams.get('bookingId');
 const db=adminSupabase();let q=db.from('driver_action_log').select('*');if(id)q=q.eq('booking_id',id);if(!isAdmin)q=q.eq('driver_id',person!.data!.id);if(new URL(request.url).searchParams.get('clicks')!=='1')q=q.neq('action','button_click');const [events,history]=await Promise.all([q.order('created_at',{ascending:false}).limit(500),id&&isAdmin?db.from('booking_status_history').select('*').eq('booking_id',id).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null})]);if(events.error||history.error)throw events.error||history.error;
 const ids=[...new Set((events.data||[]).map(x=>x.driver_id).filter(Boolean))];const names=ids.length?await db.from('drivers').select('id,full_name').in('id',ids):{data:[]};
 const bookingIds=[...new Set([...(events.data||[]),...(history.data||[])].map(x=>x.booking_id).filter(Boolean))];
 const bookings=bookingIds.length?await db.from('bookings').select('id,booking_number,pickup_address,dropoff_address,booking_date,pickup_time').in('id',bookingIds):{data:[],error:null};
 if(bookings.error)throw bookings.error;
 const identities=new Map((bookings.data||[]).map(b=>[b.id,b]));
 const identity=(x:any)=>({...x,booking:identities.get(x.booking_id)||null});
 return Response.json({events:(events.data||[]).map(x=>({...identity(x),driver_name:names.data?.find(d=>d.id===x.driver_id)?.full_name})),history:(history.data||[]).map(identity)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Historiken kunde inte hämtas'},{status:400});}
}
export async function POST(request:Request){
 try{const {user}=await requireSupabaseUser(request);const body:any=await request.json();const db=adminSupabase();const d=await db.from('drivers').select('id').eq('auth_user_id',user.id).eq('approved',true).eq('active',true).is('archived_at',null).single();if(d.error||!d.data)return Response.json({error:'Endast förare'},{status:403});
 const id=typeof body.bookingId==='string'?body.bookingId:null;
 if(id){const b=await db.from('bookings').select('driver_id,assigned_partner_id,status,archived_at').eq('id',id).single();if(b.error||!b.data||!(b.data.driver_id===d.data.id||(!b.data.driver_id&&!b.data.assigned_partner_id&&!b.data.archived_at&&['new','scheduled','confirmed'].includes(b.data.status))))return Response.json({error:'Ingen åtkomst'},{status:403});}
 if(body.action==='note_saved'||body.action==='note_removed'){
 if(!id)return Response.json({error:'Välj körning'},{status:400});
 const own=await db.from('bookings').select('id').eq('id',id).eq('driver_id',d.data.id).in('status',['accepted','en_route','arrived','passenger_onboard','completed']).maybeSingle();
 if(own.error||!own.data)return Response.json({error:'Körningen måste vara accepterad av dig'},{status:403});
 const note=String(body.note||'').trim().slice(0,2000);if(body.action==='note_saved'&&!note)return Response.json({error:'Skriv en anteckning'},{status:400});
 const saved=await db.from('driver_action_log').insert({booking_id:id,actor_id:user.id,driver_id:d.data.id,action:body.action,details:{note:body.action==='note_removed'?'':note}});if(saved.error)throw saved.error;return Response.json({ok:true});
 }
 const label=String(body.label||'').trim().slice(0,120);if(!label)return Response.json({error:'Knapp saknas'},{status:400});
 const result=await db.from('driver_action_log').insert({booking_id:id,actor_id:user.id,driver_id:d.data.id,action:'button_click',details:{label}});if(result.error)throw result.error;return Response.json({ok:true});
 }catch{return Response.json({error:'Klicket kunde inte loggas'},{status:400});}
}
