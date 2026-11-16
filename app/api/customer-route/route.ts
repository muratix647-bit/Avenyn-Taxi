import {roadRoute} from '@/lib/trip-road-route';
export async function POST(request:Request){
 try{
  const body:any=await request.json();const points=body.points;
  if(!Array.isArray(points)||points.length<2||points.length>3||points.some((p:any)=>!Array.isArray(p)||p.length!==2||p.some((n:any)=>typeof n!=='number'||!Number.isFinite(n))||Math.abs(p[0])>180||Math.abs(p[1])>85))return Response.json({error:'Ogiltiga koordinater'},{status:400});
  return Response.json({...await roadRoute(points),trafficAvailable:false},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Rutten kunde inte hämtas'},{status:503});}
}
