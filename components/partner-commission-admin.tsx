'use client';
import {useEffect,useState} from 'react';
import {isOwnCompany} from '@/lib/report-period';
import CommissionBreakdown from './commission-breakdown';
export default function PartnerCommissionAdmin({bookings,accessToken}:{bookings:any[];accessToken:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch('/api/partners/resources',{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'}).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);if(active)setData(j);}).catch(()=>{if(active)setError('Åkerisammanställningen kunde inte hämtas. Ladda om sidan.');});return()=>{active=false};},[accessToken]);
 if(error)return <p role="alert">{error}</p>;
 if(!data)return null;
 return <div>{data.partners.map((partner:any)=>{
  const links=data.driver_links.filter((l:any)=>l.partner_id===partner.id);
  const trips=bookings.filter(b=>{if(b.assigned_partner_id)return b.assigned_partner_id===partner.id;const link=links.find((l:any)=>l.driver_id===b.assigned_driver_id);if(!link)return false;const since=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(link.created_at));return String(b.booking_date||b.pickup_time).slice(0,10)>=since;});
  if(!trips.length)return null;
  return <details key={partner.id}><summary style={{padding:'12px',cursor:'pointer',fontWeight:700}}>{partner.company} · {trips.length} slutförda resor</summary><CommissionBreakdown commission={!isOwnCompany(partner.company)} title={partner.company} amounts={trips.map(b=>b.price)}/></details>;
 })}</div>;
}
