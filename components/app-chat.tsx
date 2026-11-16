'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageCircle,Send,X,ArrowLeft} from 'lucide-react';
import styles from './app-chat.module.css';

type Role='customer'|'driver'|'dispatch';
type Target={bookingId?:string;driverId?:string};
type Conversation={kind:'trip'|'dispatch';booking_id:string|null;driver_id:string;title:string;subtitle:string;last_message:string|null;last_at:string|null;unread:number};
type Message={id:string;sender_role:Role;body:string;created_at:string};
type Props={role:Role;accessToken?:string;trackingToken?:string;label?:string;compact?:boolean;navigationTab?:boolean;onOpenChange?:(open:boolean)=>void};
class ChatError extends Error{constructor(message:string,public status:number){super(message)}}
const time=(value:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const labels={customer:'Kund',driver:'Förare',dispatch:'Trafikledning'};

function ChatThread({target,request,role}:{target:Target;request:(value:Record<string,unknown>,signal?:AbortSignal)=>Promise<any>;role:Role}){
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[error,setError]=useState('');
 const [title,setTitle]=useState('Meddelanden'),[writable,setWritable]=useState(false),[loaded,setLoaded]=useState(false),[sending,setSending]=useState(false),[olderBusy,setOlderBusy]=useState(false),[hasOlder,setHasOlder]=useState(false),[peerRead,setPeerRead]=useState('0');
 const [bottom,setBottom]=useState(true),[refresh,setRefresh]=useState(0);
 const list=useRef<HTMLDivElement>(null),seen=useRef('0'),alive=useRef(true),pending=useRef<{text:string;id:string}|null>(null),initial=useRef(true),atBottom=useRef(true),generation=useRef(0),threadId=useRef<string|null>(null);
 const bookingId=target.bookingId,driverId=target.driverId;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const merge=useCallback((data:any)=>{
  if(threadId.current&&threadId.current!==data.threadId){setMessages([]);setDraft('');pending.current=null;seen.current='0';initial.current=true;}
  threadId.current=data.threadId;
  setTitle(data.title);setWritable(data.writable);setPeerRead(data.peerReadId||'0');
  setMessages(previous=>Array.from(new Map<string,Message>([...previous,...data.messages].map((m:Message)=>[m.id,m])).values()).sort((a,b)=>Number(a.id)-Number(b.id)));
  if(initial.current){setHasOlder(data.messages.length===100);initial.current=false;}
  setLoaded(true);
 },[]);
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let stopped=false;let busy=false;
  const load=async()=>{
   if(busy||stopped)return;
   if(document.hidden){timer=setTimeout(load,10000);return;}
   busy=true;
   try{const j=await request({action:'read',bookingId,driverId},controller.signal);if(!controller.signal.aborted){merge(j);setError('');}}
   catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Kunde inte hämta chatten.');if(e instanceof ChatError&&[401,403].includes(e.status)){setMessages([]);setWritable(false);stopped=true;}}}
   finally{busy=false;if(!controller.signal.aborted&&!stopped)timer=setTimeout(load,3000);}
  };
  const visible=()=>{if(!document.hidden){clearTimeout(timer);void load();}};
  void load();document.addEventListener('visibilitychange',visible);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[request,bookingId,driverId,merge,refresh]);
 useEffect(()=>{
  if(atBottom.current&&list.current)list.current.scrollTop=list.current.scrollHeight;
 },[messages]);
 useEffect(()=>{
  const last=messages.at(-1)?.id;
  if(!last||!bottom||document.hidden||Number(last)<=Number(seen.current))return;
  const previous=seen.current;seen.current=last;
  void request({action:'seen',bookingId,driverId,seen:last}).then(()=>window.dispatchEvent(new Event('avenyn-chat-read'))).catch(()=>{if(seen.current===last)seen.current=previous;});
 },[messages,bottom,request,bookingId,driverId]);
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();const text=draft.trim();if(!text||sending)return;
  if(!pending.current||pending.current.text!==text)pending.current={text,id:crypto.randomUUID()};
  const item=pending.current;setSending(true);setError('');
  try{const j=await request({action:'send',bookingId,driverId,text,requestId:item.id,threadId:threadId.current||undefined});if(alive.current){atBottom.current=true;setBottom(true);merge(j);setDraft('');pending.current=null;window.dispatchEvent(new Event('avenyn-chat-read'));}}
  catch(e){if(alive.current)setError((e instanceof Error?e.message:'Kunde inte skicka.')+' Texten finns kvar – försök igen.');}
  finally{if(alive.current)setSending(false);}
 };
 const older=async()=>{
  if(!messages[0]||olderBusy)return;setOlderBusy(true);const element=list.current,oldHeight=element?.scrollHeight||0;const version=++generation.current;
  try{const j=await request({action:'read',bookingId,driverId,before:messages[0].id});if(alive.current&&version===generation.current){atBottom.current=false;setBottom(false);merge(j);setHasOlder(j.messages.length===100);requestAnimationFrame(()=>{if(element)element.scrollTop+=element.scrollHeight-oldHeight;});}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Kunde inte ladda äldre meddelanden.');}
  finally{if(alive.current)setOlderBusy(false);}
 };
 return <div className={styles.thread}>
  <div className={styles.threadHeading}><strong>{title}</strong><small>{role==='driver'?'Skriv när bilen står stilla.':'Meddelanden via appen · svensk tid'}</small></div>
  <div className={styles.messages} ref={list} role="log" aria-label="Meddelanden" aria-live="polite" onScroll={()=>{const el=list.current;if(el){const near=el.scrollHeight-el.scrollTop-el.clientHeight<50;atBottom.current=near;setBottom(near);}}}>
   {hasOlder&&<button className={styles.older} disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Hämtar…':'Visa äldre meddelanden'}</button>}
   {!loaded&&!error&&<p className={styles.empty}>Laddar meddelanden…</p>}
   {loaded&&!messages.length&&<p className={styles.empty}>Inga meddelanden ännu. Skriv ditt första meddelande nedan.</p>}
   {messages.map(m=><article key={m.id} className={`${styles.bubble} ${m.sender_role===role?styles.mine:''}`}><small>{m.sender_role===role?'Du':labels[m.sender_role]}</small><p>{m.body}</p><footer><time dateTime={m.created_at}>{time(m.created_at)}</time>{m.sender_role===role&&<span>{Number(m.id)<=Number(peerRead)?'Läst':'Skickat'}</span>}</footer></article>)}
  </div>
  {!bottom&&<button className={styles.older} onClick={()=>{atBottom.current=true;setBottom(true);if(list.current)list.current.scrollTop=list.current.scrollHeight;}}>Senaste meddelandena ↓</button>}
  {error&&<div className={styles.error} role="alert">{error}<button onClick={()=>setRefresh(v=>v+1)}>Hämta igen</button></div>}
  {loaded&&!writable?<p className={styles.closed}>Resan är avslutad. Tidigare meddelanden finns kvar här.</p>:<form onSubmit={send} className={styles.composer}><label htmlFor="app-chat-text" className={styles.srOnly}>Skriv meddelande</label><textarea id="app-chat-text" rows={2} maxLength={2000} value={draft} disabled={sending||!writable} onChange={e=>setDraft(e.target.value)} placeholder="Skriv ett meddelande…"/><button type="submit" disabled={sending||!writable||!draft.trim()}><Send size={20}/><span>{sending?'Skickar…':'Skicka'}</span></button></form>}
 </div>;
}

export default function AppChat({role,accessToken,trackingToken,label='Meddelanden',compact=false,navigationTab=false,onOpenChange}:Props){
 const [open,setOpen]=useState(false),[target,setTarget]=useState<Target|null>(null),[conversations,setConversations]=useState<Conversation[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false),[revision,setRevision]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),launcher=useRef<HTMLButtonElement>(null);
 const request=useCallback(async(value:Record<string,unknown>,signal?:AbortSignal)=>{
  const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},cache:'no-store',body:JSON.stringify({role,trackingToken,...value}),signal});
  const j:any=await r.json();if(!r.ok)throw new ChatError(j.error||'Kunde inte ansluta till chatten.',r.status);return j;
 },[role,accessToken,trackingToken]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;const c=new AbortController();let busy=false;
  const load=async()=>{if(busy)return;if(document.hidden){timer=setTimeout(load,15000);return;}busy=true;
   try{const j=await request({action:'inbox'},c.signal);if(!c.signal.aborted){setConversations(j.conversations||[]);setReady(true);setError('');}}
   catch(e){if(!c.signal.aborted){setError(e instanceof Error?e.message:'Kunde inte hämta meddelanden.');if(e instanceof ChatError&&[401,403].includes(e.status))setConversations([]);}}
   finally{busy=false;if(!c.signal.aborted)timer=setTimeout(load,open?5000:12000);}
  };
  const reload=()=>{clearTimeout(timer);void load();};
  void load();document.addEventListener('visibilitychange',reload);window.addEventListener('avenyn-chat-read',reload);
  return()=>{c.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',reload);window.removeEventListener('avenyn-chat-read',reload);};
 },[request,open,revision]);
 useEffect(()=>{if(role!=='driver')return;const show=(event:Event)=>{const detail=(event as CustomEvent<Target>).detail;if(detail?.bookingId){setTarget({bookingId:detail.bookingId});setOpen(true);}};window.addEventListener('avenyn-open-chat',show);return()=>window.removeEventListener('avenyn-open-chat',show);},[role]);
 useEffect(()=>{onOpenChange?.(open);if(open){dialog.current?.showModal();}return()=>{if(open)onOpenChange?.(false)};},[open,onOpenChange]);
 const close=()=>{setOpen(false);setTarget(null);launcher.current?.focus();};
 const unread=conversations.reduce((n,c)=>n+Number(c.unread),0);
 const selected=role==='customer'?{}:target;
 return <>
  <button ref={launcher} type="button" className={navigationTab?`${styles.navTab} ${open?'active':''}`:`${styles.launcher} ${compact?styles.compact:''}`} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}${unread?`, ${unread} olästa`:''}`} onClick={()=>setOpen(true)}><MessageCircle size={22}/>{!compact&&<span>{label}</span>}{unread>0&&<b className={styles.badge}>{unread>99?'99+':unread}</b>}</button>
  {open&&createPortal(<dialog ref={dialog} className={styles.dialog} aria-label={role==='customer'?'Chatt med din förare':'Meddelanden'} onCancel={e=>{e.preventDefault();close();}}>
   <header className={styles.header}>{target&&role!=='customer'?<button type="button" aria-label="Alla konversationer" onClick={()=>setTarget(null)}><ArrowLeft/></button>:<MessageCircle/>}<strong>{role==='customer'?'Din förare':'Meddelanden'}</strong><button type="button" onClick={close} aria-label="Stäng chatten"><X/></button></header>
   {selected?<ChatThread key={`${role}:${selected.bookingId||selected.driverId||'customer'}`} role={role} target={selected} request={request}/>:<div className={styles.inbox}>
    <p>{role==='driver'?'Välj kund eller trafikledningen.':'Välj förare för att läsa eller skriva ett meddelande.'}</p>
    {error&&<div className={styles.error} role="alert">{error}<button onClick={()=>setRevision(v=>v+1)}>Försök igen</button></div>}
    {!ready&&!error&&<p>Laddar konversationer…</p>}
    {ready&&!conversations.length&&<p>Inga konversationer tillgängliga.</p>}
    {conversations.map(c=><button className={styles.conversation} type="button" key={`${c.kind}:${c.booking_id||c.driver_id}`} onClick={()=>setTarget(c.kind==='trip'?{bookingId:c.booking_id!}:{driverId:c.driver_id})}><span><strong>{c.title}</strong><small>{c.last_message||c.subtitle}</small>{c.last_at&&<time>{time(c.last_at)}</time>}</span>{Number(c.unread)>0&&<b className={styles.badge}>{c.unread}</b>}</button>)}
   </div>}
  </dialog>,document.body)}
 </>;
}

export function DriverCustomerChatButton({bookingId}:{bookingId:string}){
 return <button type="button" className={styles.launcher} onClick={()=>window.dispatchEvent(new CustomEvent('avenyn-open-chat',{detail:{bookingId}}))}><MessageCircle size={20}/>Skriv till kunden</button>;
}
