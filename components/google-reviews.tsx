"use client";
import {useEffect,useRef,useState} from "react";
import {googleApi} from "@/lib/live-map-engine";

const placeId="ChIJGYLFXz0ACU0RzrygDAzVbUA";
const profile=`https://www.google.com/maps/search/?api=1&query=Avenyn+Taxi&query_place_id=${placeId}`;
const writeReview=`https://search.google.com/local/writereview?placeid=${placeId}`;
type Review={rating?:number;text?:string;originalText?:string;relativePublishTimeDescription?:string;googleMapsURI?:string;authorAttribution?:{displayName?:string;uri?:string;photoURI?:string}};
type Details={rating?:number;userRatingCount?:number;reviews?:Review[];googleMapsURI?:string;attributions?:{provider:string;providerURI?:string}[]};
const safeLink=(uri?:string)=>uri?.startsWith("https://")?uri:undefined;

export default function GoogleReviews(){
  const section=useRef<HTMLElement>(null);
  const [details,setDetails]=useState<Details|null>(null);
  const [state,setState]=useState<"idle"|"loading"|"ready"|"unavailable">("idle");
  useEffect(()=>{
    let active=true,started=false;
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>|undefined;
    async function load(){
      if(started)return;started=true;setState("loading");
      timer=setTimeout(()=>{controller.abort();if(active)setState("unavailable");},10000);
      try{
        const response=await fetch("/api/maps/config",{signal:controller.signal});
        if(!response.ok)throw new Error("config");
        const {browserKey}=await response.json();
        if(!browserKey)throw new Error("key");
        const maps=await googleApi(browserKey);
        if(controller.signal.aborted)return;
        const {Place}=await maps.importLibrary("places");
        if(controller.signal.aborted)return;
        const place=new Place({id:placeId,requestedLanguage:"sv"});
        await place.fetchFields({fields:["rating","userRatingCount","reviews","googleMapsURI"]});
        if(active&&!controller.signal.aborted){setDetails(place);setState("ready");}
      }catch{if(active)setState("unavailable");}
      finally{clearTimeout(timer);}
    }
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void load();}},{rootMargin:"150px"});
    if(section.current)observer.observe(section.current);
    return()=>{active=false;observer.disconnect();controller.abort();clearTimeout(timer);};
  },[]);
  return <section ref={section} className="avenynReviews" aria-labelledby="avenyn-reviews-title" lang="sv">
    <header><div><small>KUNDRECENSIONER</small><h2 id="avenyn-reviews-title">Vad våra kunder säger</h2><p>Läs om kundernas resor med Avenyn Taxi.</p></div>
      <div className="avenynReviewRating" aria-live="polite"><img src="/google-maps-attribution.png" alt="Google Maps" height="18"/>
        {typeof details?.rating==="number"&&<><strong>{details.rating.toLocaleString("sv-SE",{maximumFractionDigits:1})} <span>/ 5</span></strong><span>{details.userRatingCount?.toLocaleString("sv-SE")} recensioner på Google</span></>}
      </div></header>
    {state==="loading"&&<p role="status">Hämtar recensioner från Google…</p>}
    {state==="unavailable"&&<p role="status">Recensionerna kan inte visas här just nu. Du kan läsa dem direkt på Google.</p>}
    {!!details?.reviews?.length&&<><p className="avenynReviewsSource">Ett urval från Google, i Googles relevansordning.</p><div className="avenynReviewGrid">
      {details.reviews.slice(0,5).map((review,index)=><article key={index}>
        <header>{safeLink(review.authorAttribution?.photoURI)&&<img src={safeLink(review.authorAttribution?.photoURI)} alt="" width="40" height="40" loading="lazy" referrerPolicy="no-referrer"/>}<div><a href={safeLink(review.authorAttribution?.uri)||profile} target="_blank" rel="noopener noreferrer">{review.authorAttribution?.displayName||"Google-användare"}</a><small>{review.relativePublishTimeDescription}</small></div></header>
        {typeof review.rating==="number"&&<p className="avenynReviewStars" aria-label={`${review.rating} av 5 stjärnor`}>{"★".repeat(Math.round(review.rating))}<span aria-hidden="true">{"☆".repeat(5-Math.round(review.rating))}</span></p>}
        {(review.originalText||review.text)&&<p className="avenynReviewText">{review.originalText||review.text}</p>}
        {safeLink(review.googleMapsURI)&&<a href={safeLink(review.googleMapsURI)} target="_blank" rel="noopener noreferrer">Visa på Google</a>}
      </article>)}
    </div></>}
    {details?.attributions?.map((item,index)=><p key={index}><a href={safeLink(item.providerURI)} target="_blank" rel="noopener noreferrer">{item.provider}</a></p>)}
    <nav className="avenynReviewActions" aria-label="Google-recensioner"><a href={safeLink(details?.googleMapsURI)||profile} target="_blank" rel="noopener noreferrer">Se alla recensioner på Google</a><a href={writeReview} target="_blank" rel="noopener noreferrer">Skriv en recension</a></nav>
  </section>;
}
