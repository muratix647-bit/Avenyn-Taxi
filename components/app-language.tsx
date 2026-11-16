"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import {languages,messages} from '@/lib/customer-i18n';
import {translateAppText} from '@/lib/app-language-text';
const driverLanguages=[languages[0],{code:'en-US',flag:'🇬🇧',label:'English',dir:'ltr'},{code:'hi',flag:'🇮🇳',label:'हिन्दी',dir:'ltr'},{code:'ml',flag:'🇮🇳',label:'മലയാളം',dir:'ltr'}];
const Context=createContext({lang:'sv',setLang:(_lang:string)=>{},translate:(text:string)=>text});
export function useAppLanguage(){return useContext(Context)}
export function AppText({text}:{text:any}){const {translate}=useAppLanguage();return typeof text==='string'?translate(text):text}
export function LanguagePicker(){const {lang,setLang}=useAppLanguage();const choices=lang==='hi'||lang==='ml'?driverLanguages:languages;return <label className="appLanguageChoice"><span>🌐</span><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value)}>{choices.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}</select></label>}
export default function AppLanguage({kind,children,picker=true}:{kind:'driver'|'customer';children:React.ReactNode;picker?:boolean}){
 const [lang,setLangState]=useState('sv');const [ready,setReady]=useState(false);const choices=kind==='driver'?driverLanguages:languages;
 const key=kind==='driver'?'avenyn-driver-language':'avenyn-language';
 const valid=(value:string)=>choices.some(l=>l.code===value);
 const setLang=(value:string)=>{if(valid(value)){setLangState(value);try{localStorage.setItem(key,value)}catch{}}};
 useEffect(()=>{try{const requested=new URLSearchParams(location.search).get('lang');const saved=localStorage.getItem(key);if(requested&&valid(requested))setLangState(requested);else if(saved&&valid(saved))setLangState(saved)}catch{}setReady(true)},[key]);
 useEffect(()=>{if(!ready)return;document.documentElement.lang=lang;document.documentElement.dir=lang==='he'?'rtl':'ltr';},[lang,ready]);
 const translate=(text:string)=>translateAppText(text,lang);
 return <Context.Provider value={{lang,setLang,translate}}><div className={kind==='driver'?'driverLanguageShell':'customerLanguageShell'} lang={lang} dir={lang==='he'?'rtl':'ltr'}>{picker&&<div className="appLanguageBar" style={{display:'flex',justifyContent:'flex-end',padding:'10px 16px',background:'#f0f8fc'}}><label className="appLanguageChoice"><span>🌐</span><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value)}>{choices.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}</select></label></div>}{children}</div></Context.Provider>
}
