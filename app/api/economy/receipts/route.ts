import {economyAdmin,EconomyError,json,failure,bodyJson} from '@/lib/economy-server';
import {ore,textField,validDate,validPeriod,uuid,fileType} from '@/lib/economy-workspace';
const bucket='economy-receipts';
export async function GET(request:Request){try{
 const {db}=await economyAdmin(request);const p=new URL(request.url).searchParams.get('month');
 if(!validPeriod(p))throw new EconomyError('Välj en månad.');
 const end=new Date(Date.UTC(Number(p.slice(0,4)),Number(p.slice(5,7)),1)).toISOString().slice(0,10);
 const {data,error}=await db.from('economy_receipts').select('id,expense_date,supplier,category,amount_ore,vat_ore,deductible_vat_ore,note,file_name,archived_at').gte('expense_date',p+'-01').lt('expense_date',end).order('expense_date',{ascending:false}).limit(501);
 if(error)throw error;if((data?.length||0)>500)throw new EconomyError('Månaden innehåller fler än 500 kvitton. Rapporten visas inte för att undvika ofullständiga summor.');return json({rows:data});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {db,user}=await economyAdmin(request);
 if(Number(request.headers.get('content-length')||0)>11*1024*1024)throw new EconomyError('Kvittot får vara högst 10 MB.');
 const form=await request.formData();const id=form.get('id');const date=form.get('expense_date');const file=form.get('file');
 if(!uuid(id)||!validDate(date)||!(file instanceof File)||file.size===0||file.size>10*1024*1024)throw new EconomyError('Välj datum och en JPG-, PNG- eller PDF-fil på högst 10 MB.');
 let amount:number,vat:number,deductible:number,supplier:string,category:string,note:string;
 try{amount=ore(form.get('amount'));vat=ore(form.get('vat'));deductible=ore(form.get('deductibleVat'));supplier=textField(form.get('supplier'));category=textField(form.get('category'),100);note=textField(form.get('note')??'',2000);}catch(e){throw new EconomyError((e as Error).message);}
 if(!supplier||!category||amount<=0||vat>amount||deductible>vat)throw new EconomyError('Kontrollera leverantör och belopp. Avdragsgill moms får inte överstiga kvittots moms.');
 const bytes=new Uint8Array(await file.arrayBuffer());const type=fileType(bytes);
 if(!type)throw new EconomyError('Filinnehållet måste vara JPG, PNG eller PDF.');
 const {data:existing,error:existingError}=await db.from('economy_receipts').select('id').eq('id',id).maybeSingle();if(existingError)throw existingError;if(existing)return json({ok:true});
 const path=`${id}.${type==='application/pdf'?'pdf':type==='image/png'?'png':'jpg'}`;
 const {error:uploadError}=await db.storage.from(bucket).upload(path,bytes,{contentType:type,upsert:false});
 if(uploadError)throw new EconomyError('Filen kunde inte sparas. Försök igen eller välj filen på nytt.',502);
 const {error}=await db.from('economy_receipts').insert({id,expense_date:date,supplier,category,amount_ore:amount,vat_ore:vat,deductible_vat_ore:deductible,note,file_path:path,file_name:file.name.slice(0,200),mime_type:type,created_by:user.id});
 if(error){await db.storage.from(bucket).remove([path]);throw error;}
 return json({ok:true});
 }catch(e){return failure(e);}}
export async function PATCH(request:Request){try{
 const {db}=await economyAdmin(request);const b=await bodyJson(request);
 if(!uuid(b.id)||!['archive','restore'].includes(b.action))throw new EconomyError('Ogiltig åtgärd.');
 const {data,error}=await db.from('economy_receipts').update({archived_at:b.action==='archive'?new Date().toISOString():null}).eq('id',b.id).select('id').maybeSingle();
 if(error)throw error;if(!data)throw new EconomyError('Kvittot finns inte.',404);return json({ok:true});
 }catch(e){return failure(e);}}
