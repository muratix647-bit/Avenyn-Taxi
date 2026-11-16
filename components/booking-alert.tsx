'use client';
import {alarmVolume,DRIVER_ALARM_VOLUME_KEY} from '@/lib/driver-alarm-volume';
import {useBookingAlarm} from '@/lib/use-booking-alarm';
import DriverAudioSettings from './driver-audio-settings';
import {useEffect,useRef,useState} from 'react';

export default function BookingAlert({bookings,offers=[],owner,driver=false,totalCount,onOpen}:{bookings:any[];offers?:any[];owner:string;driver?:boolean;totalCount?:number;onOpen:()=>void}){
 const key=`avenyn-booking-seen:${driver?'driver':'dispatch'}:${owner}`;
 const [seen,setSeen]=useState<string[]|null>(null),[error,setError]=useState('');
 const [volume,setVolume]=useState(70),[menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{if(driver)try{setVolume(alarmVolume(localStorage.getItem(DRIVER_ALARM_VOLUME_KEY)))}catch{}},[driver]);
 const changeVolume=(n:number)=>{setVolume(n);try{localStorage.setItem(DRIVER_ALARM_VOLUME_KEY,String(n))}catch{}};
 const {wanted,ready:enabled,audio,activate:enableAudio,disable}=useBookingAlarm(owner,driver);
 const lastAlarm=useRef('');
 useEffect(()=>{try{setSeen(JSON.parse(localStorage.getItem(key)||'[]'));}catch{setSeen([]);}lastAlarm.current='';},[key]);
 const rows=bookings.filter(b=>!b.archived_at&&(driver||!['completed','cancelled'].includes(b.status)));
 const unseen=rows.filter(b=>seen!==null&&!seen.includes(String(b.id)));
 const signature=(driver?[...rows,...offers]:unseen).map(b=>String(b.id)).sort().join(',');
 const beep=()=>{let volume=1;if(driver){try{volume=alarmVolume(localStorage.getItem(DRIVER_ALARM_VOLUME_KEY))/100}catch{}}if(volume===0)return;const c=audio.current;if(!c||c.state!=='running')return;const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.setValueAtTime(.15*volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.5);o.start();o.stop(c.currentTime+.5);};
 useEffect(()=>{if(!signature||!enabled||!wanted)return;lastAlarm.current=signature;beep();const timer=setInterval(beep,3000),stop=driver?null:setTimeout(()=>clearInterval(timer),60000);return()=>{clearInterval(timer);if(stop)clearTimeout(stop);};},[signature,enabled,driver,wanted]);
 const activate=()=>{if(driver&&volume===0)changeVolume(70);enableAudio();lastAlarm.current='';setError('');window.setTimeout(beep,100);};
 useEffect(()=>{if(!driver)return;const sync=()=>{let n=70;try{n=alarmVolume(localStorage.getItem(DRIVER_ALARM_VOLUME_KEY))}catch{}setVolume(n);};const notify=()=>{if(audio.current?.state==='running')beep()};window.addEventListener('avenyn-booking-arrived',notify);document.addEventListener('visibilitychange',sync);window.addEventListener('focus',sync);const timer=setInterval(sync,2000);return()=>{window.removeEventListener('avenyn-booking-arrived',notify);document.removeEventListener('visibilitychange',sync);window.removeEventListener('focus',sync);clearInterval(timer)};},[driver]);
 const acknowledge=()=>{const next=[...new Set([...(seen||[]),...rows.map(b=>String(b.id))])].slice(-1500);setSeen(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}onOpen();};
 if(driver)return <section className={`driverCompactBookings ${rows.length?'hasUnseenBookings':''}`} aria-label="Alla bokningar och inställningar">
 <div className="driverCompactBookingRow"><button type="button" className="bookingAlertOpen" onClick={acknowledge}>Bokningar <b>{totalCount??rows.length}</b><span> · {rows.length} lediga för dig</span></button><button type="button" className="driverCompactMenuButton" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>☰ Meny</button></div>
 {(!enabled||volume===0)&&<div className="driverAlarmReminder" role="status"><div><strong>{wanted?'Bokningslarm · På (sparat)':'Slå på bokningslarm'}</strong><small>{wanted?'Tryck för att tillåta ljud i denna öppning':'För bokningar och förbokningar'}</small></div><button type="button" onClick={()=>void activate()}>Aktivera larm</button></div>}
 {error&&!menuOpen&&<small role="alert">{error}</small>}
 {menuOpen&&<div className="driverCompactMenu"><header><b>Ljud och karta</b><button onClick={()=>setMenuOpen(false)} aria-label="Stäng menyn">Stäng ×</button></header><details open><summary>Bokningslarm</summary><label>Volym · {volume}%<input aria-label="Volym för bokningslarm" type="range" min="0" max="100" step="5" value={volume} onChange={e=>changeVolume(Number(e.target.value))}/></label><div className="driverCompactMenuActions"><button onClick={()=>void activate()}>{enabled?'Testa larm':wanted?'Tillåt ljud':'Aktivera larm'}</button><button onClick={()=>{if(volume){changeVolume(0);disable()}else{changeVolume(70);void activate()}}}>{volume?'Ljud av':'Ljud på'}</button></div><small>{enabled&&volume>0?'Larmar var tredje sekund tills du svarat eller bokningarna har tagits. Sidan måste vara öppen och ljudet på.':'Bokningslarmet är avstängt eller inte aktiverat.'}</small></details><details><summary>Navigationsröst och kartläge</summary><DriverAudioSettings/><p>MapLibre: välj Mörkt, Ljust eller Automatiskt i kartmenyn mellan inkört och Online när du inte har en aktiv resa.</p></details><details><summary>Kameror, polis och vägarbeten</summary><p>Under Google-navigation: stäng denna meny och tryck på varningstriangeln på kartan för Googles rapporteringsval. Tillgängliga kategorier bestäms av Google. Dessa trafikrapporter är ännu inte anslutna till MapLibre.</p></details>{error&&<p role="status">{error}</p>}</div>}
 </section>;
 return <section className={`bookingAlert ${driver?'driverBookingAlert':''} ${unseen.length?'hasUnseenBookings':''}`} aria-label="Bokningslarm">
 <button type="button" className="bookingAlertOpen" onClick={acknowledge}><strong>{unseen.length?`${unseen.length} ${driver?'nya förbokningar':'nya bokningar'}`:driver?`Förbokningar · ${rows.length} lediga`:'Inga olästa bokningar'}</strong><span>{unseen.length?'Öppna och kvittera':'Visa bokningar'}</span></button>
 <button type="button" onClick={()=>void activate()}>{enabled?'Testa larm':wanted?'Tillåt ljud':'Aktivera bokningslarm'}</button>
 {wanted&&<button type="button" onClick={disable}>Stäng av larm</button>}
 {!driver&&<small>{wanted?(enabled?'Bokningslarm: På · ljud klart.':'Bokningslarm: På (sparat). Tryck på Tillåt ljud om webbläsaren blockerar ljud efter omstart.'):'Bokningslarm: Av.'} Valet sparas på denna enhet. Ljudet fungerar när sidan är öppen. SMS till admin används även när sidan är stängd.</small>}
 {error&&<small role="status">{error}</small>}
 </section>;
}
