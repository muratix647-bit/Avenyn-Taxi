import {economyAdmin,EconomyError,json,failure,bodyJson} from '@/lib/economy-server';
import {uuid} from '@/lib/economy-workspace';
const table='dispatch_invoice_drafts';
export async function GET(req:Request){try{
 const {db}=await economyAdmin(req);const {data,error}=await db.from(table).select('id,revision,payload,updated_at').order('updated_at',{ascending:false}).limit(200);
 if(error)throw error;return json(data);
}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const {db,user}=await economyAdmin(req),b=await bodyJson(req);if(!uuid(b.id))throw new EconomyError('Ogiltigt underlag.');
 if(b.action==='credit'&&b.confirmed===true){
  const {error}=await db.rpc('dispatch_credit_invoice',{p_id:b.id,p_actor:user.id});if(error)throw new EconomyError('Krediteringen kunde inte bekräftas. Uppdatera och kontrollera fakturans utskicksstatus.',409);return json({ok:true});
 }
 if(!Number.isSafeInteger(b.revision)||b.revision<0)throw new EconomyError('Ogiltig version.');
 if(b.action==='delete'&&b.confirmed===true){
  const {data,error}=await db.from(table).delete().eq('id',b.id).eq('revision',b.revision).select('id').maybeSingle();if(error)throw error;if(!data)throw new EconomyError('Utkastet ändrades eller togs bort. Uppdatera listan.',409);return json({ok:true});
 }
 if(b.action!=='save'||!b.payload?.form||!Array.isArray(b.payload.items)||b.payload.items.length>25)throw new EconomyError('Ogiltigt fakturautkast.');
 const values={payload:b.payload,updated_by:user.id,updated_at:new Date().toISOString(),revision:b.revision+1};
 const result=b.revision===0?await db.from(table).insert({...values,id:b.id}).select('id,revision').single():await db.from(table).update(values).eq('id',b.id).eq('revision',b.revision).select('id,revision').maybeSingle();
 if(result.error||!result.data)throw new EconomyError('Utkastet kunde inte sparas. Uppdatera listan och kontrollera versionen.',409);
 return json(result.data);
}catch(e){return failure(e);}}
