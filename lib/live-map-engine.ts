"use client";
// A small common map interface preserves tracking behaviour across providers.
// Google is selected only when a dedicated web key has been configured.
export type MapPoint = [number, number];
export type TrackingMarker = {
  addTo(map: any): TrackingMarker; remove(): void;
  getLatLng(): {lat:number;lng:number}; setLatLng(p: MapPoint): void;
  on(name: string, fn: () => void): TrackingMarker;
};
export type TrackingMap = {
  provider?: string; setView(p:MapPoint,z:number,options?:any): TrackingMap;
  flyTo(p:MapPoint,z:number,options?:any): void; fitBounds(points:any,options?:any):void;
  on?(name:string,fn:()=>void):void; getZoom():number; invalidateSize(options?:any):void; remove():void;
  latLngToContainerPoint?(point:MapPoint):{x:number;y:number}; panBy?(offset:[number,number],options?:any):void; getBounds?():any;
  project?(point:MapPoint,zoom:number):{x:number;y:number}; unproject?(point:[number,number],zoom:number):{lat:number;lng:number};
  setTraffic?(enabled:boolean):void; setSatellite?(enabled:boolean):void;
};
let enginePromise: Promise<any> | undefined;
let leafletPromise:Promise<any>|undefined;
function leafletEngine(){return leafletPromise ||= import("leaflet").then(L=>({...L,provider:"openstreetmap"}));}
let googlePromise: Promise<any> | undefined;
export function googleApi(key: string) {
  if ((window as any).google?.maps?.Map) return Promise.resolve((window as any).google.maps);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve,reject) => {
    const script=document.createElement("script");
    const timer=setTimeout(()=>reject(new Error("Maps timeout")),12000);
    (window as any).__avenynMapsReady=()=>{clearTimeout(timer);resolve((window as any).google.maps);};
    (window as any).gm_authFailure=()=>{clearTimeout(timer);window.dispatchEvent(new Event("avenyn-map-auth-error"));reject(new Error("Maps authorization failed"));};
    script.onerror=()=>{clearTimeout(timer);reject(new Error("Maps unavailable"));};
    script.async=true;
    script.src=`https://maps.googleapis.com/maps/api/js?${new URLSearchParams({key,v:"quarterly",loading:"async",callback:"__avenynMapsReady",language:"sv",region:"SE"})}`;
    document.head.appendChild(script);
  });
  return googlePromise;
}
export function loadMapEngine(preferOpenStreetMap=false): Promise<any> {
  if(preferOpenStreetMap)return leafletEngine();
  if (!enginePromise) enginePromise=(async()=>{
    try {
      const response=await fetch("/api/maps/config",{signal:AbortSignal.timeout(5000)});
      if(response.ok){const config=await response.json() as {browserKey?:string};if(config.browserKey)return googleAdapter(await googleApi(config.browserKey));}
    } catch { /* Tracking stays usable if Maps cannot load. */ }
    return leafletEngine();
  })();
  return enginePromise;
}
function googleAdapter(g:any) {
  const coordinates=(p:MapPoint)=>({lat:p[0],lng:p[1]});
  class Bounds {
    points: MapPoint[];
    constructor(points:MapPoint[]){this.points=points;}
    isValid(){return this.points.length>0;}
  }
  class MapView implements TrackingMap {
    provider="google"; raw:any; traffic:any; resize:ResizeObserver; overlays=new Set<any>(); disposed=false;
    constructor(el:HTMLElement,options:any){
      this.raw=new g.Map(el,{center:{lat:57.7089,lng:11.9746},zoom:12,minZoom:options.minZoom,maxZoom:options.maxZoom,
        disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:g.ControlPosition.RIGHT_CENTER},
        fullscreenControl:false,draggable:options.dragging!==false,gestureHandling:"greedy",clickableIcons:false,
        styles:[{featureType:"poi",stylers:[{visibility:"off"}]}]});
      this.traffic=new g.TrafficLayer();
      this.resize=new ResizeObserver(()=>this.invalidateSize());this.resize.observe(el);
    }
    setView(p:MapPoint,z:number){this.raw.setCenter(coordinates(p));if(this.raw.getZoom()!==z)this.raw.setZoom(z);return this;}
    flyTo(p:MapPoint,z:number){this.raw.panTo(coordinates(p));this.raw.setZoom(z);}
    on(name:string,fn:()=>void){this.raw.addListener(name==="zoomend"?"zoom_changed":name,fn);}
    getZoom(){return this.raw.getZoom()??12;}
    fitBounds(input:Bounds|MapPoint[],options:any={}){
      const points=input instanceof Bounds?input.points:input;if(!points.length)return;
      const bounds=new g.LatLngBounds();points.forEach(p=>bounds.extend(coordinates(p)));
      this.raw.fitBounds(bounds,{top:90,bottom:90,left:45,right:45});
      if(options.maxZoom)g.event.addListenerOnce(this.raw,"idle",()=>{if(!this.disposed&&this.getZoom()>options.maxZoom)this.raw.setZoom(options.maxZoom);});
    }
    invalidateSize(){g.event.trigger(this.raw,"resize");}
    setTraffic(enabled:boolean){this.traffic.setMap(enabled?this.raw:null);}
    setSatellite(enabled:boolean){this.raw.setMapTypeId(enabled?"hybrid":"roadmap");}
    remove(){this.disposed=true;this.resize.disconnect();this.traffic.setMap(null);this.overlays.forEach(o=>o.remove());this.overlays.clear();g.event.clearInstanceListeners(this.raw);}
  }
  class Marker implements TrackingMarker {
    position:MapPoint; element:HTMLElement; overlay:any; map?:MapView; listener?:()=>void;
    constructor(p:MapPoint,options:any){
      this.position=p;this.element=document.createElement("div");
      const size=options.icon?.iconSize??[140,62],anchor=options.icon?.iconAnchor??[70,44];
      Object.assign(this.element.style,{position:"absolute",width:`${size[0]}px`,height:`${size[1]}px`,transform:`translate(${-anchor[0]}px,${-anchor[1]}px)`,cursor:"pointer"});
      if(options.icon?.html instanceof HTMLElement)this.element.append(options.icon.html);
      this.element.title=options.title||"";
      if(options.interactive===false)this.element.style.pointerEvents="none";
      this.overlay=new g.OverlayView();
      this.overlay.onAdd=()=>{this.overlay.getPanes().overlayMouseTarget.appendChild(this.element);if(options.interactive!==false)g.OverlayView.preventMapHitsAndGesturesFrom(this.element);};
      this.overlay.draw=()=>{const px=this.overlay.getProjection()?.fromLatLngToDivPixel(new g.LatLng(coordinates(this.position)));if(px){this.element.style.left=`${px.x}px`;this.element.style.top=`${px.y}px`;}};
      this.overlay.onRemove=()=>this.element.remove();
    }
    addTo(map:MapView){this.map=map;map.overlays.add(this);this.overlay.setMap(map.raw);return this;}
    getLatLng(){return coordinates(this.position);}
    setLatLng(p:MapPoint){this.position=p;this.overlay.draw();}
    on(name:string,fn:()=>void){this.element.addEventListener(name,fn);return this;}
    remove(){this.overlay.setMap(null);this.map?.overlays.delete(this);}
  }
  class Group {
    map?:MapView; children:any[]=[];
    addTo(map:MapView){this.map=map;map.overlays.add(this);return this;}
    remove(){this.children.forEach(o=>o.remove());this.children=[];this.map?.overlays.delete(this);}
  }
  return {provider:"google",map:(el:HTMLElement,options:any)=>new MapView(el,options),
    control:{zoom:()=>({addTo:()=>{}})},tileLayer:()=>({addTo:()=>{}}),
    latLngBounds:(points:MapPoint[])=>new Bounds(points),divIcon:(options:any)=>options,
    marker:(p:MapPoint,options:any)=>new Marker(p,options),layerGroup:()=>new Group(),
    polyline:(points:MapPoint[],options:any)=>{
      const line=new g.Polyline({path:points.map(coordinates),strokeColor:options.color,strokeWeight:options.weight,strokeOpacity:options.opacity});
      let parent:MapView|undefined;
      const api={addTo:(map:MapView)=>{parent=map;map.overlays.add(api);line.setMap(map.raw);return api;},remove:()=>{line.setMap(null);parent?.overlays.delete(api);}};return api;
    },
    circle:(p:MapPoint,options:any)=>{
      const circle=new g.Circle({center:coordinates(p),radius:options.radius,strokeColor:options.color,fillColor:options.fillColor,fillOpacity:options.fillOpacity,strokeWeight:options.weight});
      let detail:HTMLElement|undefined;let popup:any;
      const api={bindPopup:(value:HTMLElement)=>{detail=value;return api;},addTo:(group:Group)=>{circle.setMap(group.map?.raw);group.children.push(api);circle.addListener("click",()=>{if(detail){popup?.close();popup=new g.InfoWindow({content:detail,position:coordinates(p)});popup.open({map:group.map?.raw});}});return api;},remove:()=>{popup?.close();g.event.clearInstanceListeners(circle);circle.setMap(null);}};
      return api;
    }
  };
}
