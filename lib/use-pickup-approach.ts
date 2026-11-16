"use client";
import {useEffect,useRef,useState} from 'react';
import {useCustomerRoute} from './use-customer-route';
type Point={lat?:number;lng?:number};
export function usePickupApproach(enabled:boolean,position:Point|undefined,pickup:Point){
 const latest=useRef(position);latest.current=position;
 const [sample,setSample]=useState<Point>({});
 // Route requests follow GPS at a bounded cadence, rather than restarting on each fix.
 useEffect(()=>{if(!enabled){setSample({});return;}setSample(latest.current||{});const timer=setInterval(()=>setSample(latest.current||{}),15000);return()=>clearInterval(timer);},[enabled,!!position]);
 const valid=[sample.lat,sample.lng,pickup.lat,pickup.lng].every(Number.isFinite);
 const meters=valid?Math.hypot((Number(sample.lat)-Number(pickup.lat))*111320,(Number(sample.lng)-Number(pickup.lng))*111320*Math.cos(Number(sample.lat)*Math.PI/180)):Infinity;
 const nearby=valid&&meters<30;
 const result=useCustomerRoute(enabled&&valid&&!nearby,sample,pickup,undefined,'now');
 return {...result,available:valid,nearby};
}
