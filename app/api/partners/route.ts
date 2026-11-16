import { adminSupabase } from '@/lib/supabase-server';
import { partnerApplicationSchema } from '@/lib/partner-applications';

export async function POST(request: Request) {
 try {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:'Otillåten begäran.'},{status:403});
  const raw = await request.text();
  if (raw.length > 12000) return Response.json({error:'Ansökan är för lång.'},{status:413});
  const body = JSON.parse(raw);
  if (body.website) return Response.json({ok:true});
  const parsed = partnerApplicationSchema.safeParse(body);
  if (!parsed.success) return Response.json({error:'Kontrollera uppgifterna. Organisationsnumret ska ha 10 siffror.'},{status:400});
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${new Date().toISOString().slice(0,10)}:${ip}`));
  const submission_hash = Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const db = adminSupabase();
  const {count,error:rateError} = await db.from('partner_applications').select('id',{count:'exact',head:true}).eq('submission_hash',submission_hash).gte('created_at',new Date(Date.now()-3600000).toISOString());
  if (rateError) throw rateError;
  if ((count || 0) >= 5) return Response.json({error:'För många ansökningar. Försök senare eller ring oss.'},{status:429});
  const {error} = await db.from('partner_applications').insert({...parsed.data,submission_hash});
  if (error && error.code !== '23505') throw error;
  return Response.json({ok:true});
 } catch {
  return Response.json({error:'Ansökan kunde inte sparas. Försök igen eller ring oss.'},{status:400});
 }
}
