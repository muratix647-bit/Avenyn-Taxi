import {adminSupabase} from '@/lib/supabase-server';
import {receiptPdf} from '@/lib/receipt-pdf';
export async function GET(_:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;let uuid=token;
 if(/^[A-Za-z0-9_-]{22}$/.test(token)){const bytes=atob(token.replace(/-/g,'+').replace(/_/g,'/')+'==');const hex=Array.from(bytes,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');uuid=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Type':'text/html; charset=utf-8'};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))return new Response('Kvittot hittades inte',{status:404,headers});
 const {data,error}=await adminSupabase().from('bookings').select('booking_number,customer_name,customer_phone,customer_email,pickup_time,price_breakdown,notes,extra_message,driver_reported_payment_note,passengers,luggage_count,child_seats,car_type,pickup_address,dropoff_address,booking_date,completed_at,driver_reported_amount,actual_price,fixed_price,estimated_price,driver_reported_payment_method,payment_method,payment_status,driver_reported_paid').eq('tracking_token',uuid).eq('status','completed').maybeSingle();
 if(error)return new Response('Kvittot kunde inte hämtas. Försök igen.',{status:503,headers});
 if(!data)return new Response('Kvittot finns när resan är avslutad.',{status:404,headers});
 const pdf=await receiptPdf(data);
 return new Response(pdf as unknown as BodyInit,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Avenyn-Taxi-${String(data.booking_number).replace(/[^0-9A-Za-z-]/g,'')}.pdf"`,'X-Content-Type-Options':'nosniff'}});
}
