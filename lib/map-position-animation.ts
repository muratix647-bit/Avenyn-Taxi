type Point = {lat:number;lng:number};
// Interpolate only between measured positions; never predict where the taxi is.
export function interpolatePosition(from:Point,to:Point,progress:number):Point {
 const t=Math.max(0,Math.min(1,progress));
 // Large jumps are GPS corrections, not a route to animate through.
 if(Math.abs(to.lat-from.lat)>0.01||Math.abs(to.lng-from.lng)>0.02)return to;
 return {lat:from.lat+(to.lat-from.lat)*t,lng:from.lng+(to.lng-from.lng)*t};
}

export function animationDuration(interval:number):number { return Math.max(250,Math.min(1500,Number.isFinite(interval)?interval:850)); }

// Hold heading while stationary; accumulate movement before measuring direction.
export function travelBearing(from:Point,to:Point):number|null {
 const rad=Math.PI/180,a=from.lat*rad,b=to.lat*rad,d=(to.lng-from.lng)*rad;
 const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(d/2)**2;
 const meters=6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
 if(!Number.isFinite(meters)||meters<5||meters>1500)return null;
 return (Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))/rad+360)%360;
}
export function interpolateBearing(from:number,to:number,progress:number):number {
 const delta=((to-from+540)%360)-180;
 return (from+delta*Math.max(0,Math.min(1,progress))+360)%360;
}
