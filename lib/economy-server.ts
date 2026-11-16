import {adminSupabase,requireSupabaseUser} from '@/lib/supabase-server';
export class EconomyError extends Error {constructor(message:string,public status=400){super(message);}}
export async function economyAdmin(request:Request){
 let auth;
 try {auth=await requireSupabaseUser(request);}catch{throw new EconomyError('Logga in som administratör.',401);}
 const results=await Promise.all([auth.supabase.rpc('is_admin'),auth.supabase.rpc('is_dispatch_admin')]);
 if(!results.some(r=>!r.error&&r.data===true))throw new EconomyError('Administratörsbehörighet krävs.',403);
 return {db:adminSupabase(),user:auth.user};
}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const failure=(e:unknown)=>json({error:e instanceof EconomyError?e.message:'Uppgifterna kunde inte behandlas. Försök igen.'},e instanceof EconomyError?e.status:500);
export async function bodyJson(request:Request){
 if(Number(request.headers.get('content-length')||0)>16384)throw new EconomyError('För mycket text.');
 try {const s=await request.text();if(s.length>16384)throw 0;const b=JSON.parse(s);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;return b;}catch{throw new EconomyError('Ogiltiga uppgifter.');}
}
