"use client";
import {useLayoutEffect} from 'react';
import {customerMobileScale} from '@/lib/customer-mobile-fit';
export default function CustomerMobileFit(){
 useLayoutEffect(()=>{
  const root=document.querySelector<HTMLElement>('.customerFormApp, .restoredCustomerApp');
  if(!root)return;
  const metas=Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]'));
  const previous=metas.map(meta=>meta.content);
  const previousOverflow=document.documentElement.style.overflow;
  const previousBodyOverflow=document.body.style.overflow;
  document.documentElement.style.overflow="hidden";document.body.style.overflow="hidden";
  metas.forEach(meta=>meta.setAttribute('content','width=device-width, initial-scale=1, viewport-fit=cover'));
  const fit=()=>{
   const width=document.documentElement.clientWidth;
   const scale=customerMobileScale(/Android|iPhone|iPod/i.test(navigator.userAgent),window.screen.width,width);
   root.style.zoom=scale===1?'':String(scale);
   root.style.width=scale===1?'':`${width/scale}px`;
   root.style.setProperty('--customer-app-height',`${(window.visualViewport?.height||window.innerHeight)/scale}px`);
   root.style.setProperty('--customer-app-width',`${width/scale}px`);
  };
  fit();const frame=requestAnimationFrame(fit);const retry=setTimeout(fit,300);
  window.visualViewport?.addEventListener('resize',fit);
  window.addEventListener('resize',fit);window.addEventListener('pageshow',fit);
  return()=>{document.documentElement.style.overflow=previousOverflow;document.body.style.overflow=previousBodyOverflow;window.visualViewport?.removeEventListener('resize',fit);cancelAnimationFrame(frame);clearTimeout(retry);window.removeEventListener('resize',fit);window.removeEventListener('pageshow',fit);root.style.zoom='';root.style.width='';root.style.removeProperty('--customer-app-height');root.style.removeProperty('--customer-app-width');metas.forEach((meta,index)=>{meta.content=previous[index];});};
 },[]);
 return null;
}
