'use client';
import {useEffect,useState} from 'react';
import {AppText} from './app-language';
import type {PetSelection} from '@/lib/pets';
export default function PetField({value,onChange}:{value:PetSelection;onChange:(value:PetSelection)=>void}){
 const [options,setOptions]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;fetch('/api/pets',{cache:'no-store'}).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);if(alive)setOptions(j.options||[])}).catch(()=>{if(alive)setError('Djurval kunde inte hämtas. Försök öppna sidan igen.')});return()=>{alive=false}},[]);
 const choices=value&&!options.some(x=>x.id===value.id)?[...options,value]:options;
 return <div className="petField"><label><span><AppText text="Djur (valfritt)" /></span><select value={value?.id||''} onChange={e=>{const p=choices.find(x=>x.id===e.target.value);onChange(p?{id:p.id,label:p.label,count:value?.count||1}:null)}}><option value=""><AppText text="Inget djur" /></option>{choices.map(x=><option key={x.id} value={x.id}><AppText text={x.label}/></option>)}</select></label>{value&&<label><span><AppText text="Antal djur"/></span><select value={value.count} onChange={e=>onChange({...value,count:Number(e.target.value)})}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>}<small><AppText text="Djurvalet ändrar inte priset." /></small>{error&&<small role="alert"><AppText text={error}/></small>}</div>
}
