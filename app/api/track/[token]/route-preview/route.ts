import {GET as tracking} from '../route';
import {roadRoute} from '@/lib/trip-road-route';
export async function GET(request:Request,context:{params:Promise<{token:string}>}){
 const response=await tracking(request,context);if(!response.ok)return response;
 const trip:any=await response.json();
 const points=[[trip.pickup_lng,trip.pickup_lat],...(trip.route_stop?.lat!=null&&trip.route_stop?.lng!=null?[[trip.route_stop.lng,trip.route_stop.lat]]:[]),[trip.destination_lng,trip.destination_lat]];
 try{return Response.json(await roadRoute(points),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({state:'unavailable',path:[]},{headers:{'Cache-Control':'no-store'}});}
}
