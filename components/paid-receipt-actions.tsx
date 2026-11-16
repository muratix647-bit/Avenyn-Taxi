'use client';
import {useRef,useState} from 'react';

export default function PaidReceiptActions({booking,accessToken}:{booking:any;accessToken:string}){
 const [email,setEmail]=useState(booking.customer_email||''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const lock=useRef(false),attempt=useRef({key:'',id:''});
 async function run(channel:'sms'|'email'|'pdf'){
  if(lock.current)return;
  const recipient=channel==='sms'?booking.customer_phone:String(email).trim();
  if(channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)){setNotice('Ange kundens e-postadress.');return;}
  if(channel!=='pdf'&&!window.confirm('Skicka kvittot för bokning #'+booking.booking_number+' till '+recipient+'?'))return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const key=channel+':'+recipient;
   if(attempt.current.key!==key)attempt.current={key,id:crypto.randomUUID()};
   const response=await fetch('/api/dispatch/customer-invoices/paid-receipt',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({id:booking.id,channel,recipient,attempt:attempt.current.id})});
   if(!response.ok)throw Error((await response.json()).error||'Kvittot kunde inte hämtas.');
   if(channel==='pdf'){
    const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');
    a.href=url;a.download='Avenyn-Taxi-kvitto-'+booking.booking_number+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   }else{
    setNotice((channel==='sms'?'SMS-tjänsten tog emot kvittolänken till ':'Mejltjänsten tog emot PDF-kvittot till ')+recipient+'.');
   }
   attempt.current={key:'',id:''};
  }catch(e){setNotice((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 return <div>
  <button type="button" disabled={busy} onClick={()=>void run('pdf')}>Hämta kvitto som PDF</button>
  {booking.customer_phone&&<button type="button" disabled={busy} onClick={()=>void run('sms')}>Skicka kvitto via SMS · {booking.customer_phone}</button>}
  <label>E-post för kvitto<input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
  <button type="button" disabled={busy||!email.trim()} onClick={()=>void run('email')}>Mejla PDF-kvitto</button>
  {notice&&<p role="status">{notice}</p>}
 </div>;
}
