import {economyAdmin,EconomyError,failure} from '@/lib/economy-server';
import {uuid,netPay,hasPayrollCalculation,missingTaxMessage,sek,PayrollRow} from '@/lib/economy-workspace';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
export async function GET(request:Request){try{
 const {db}=await economyAdmin(request);const params=new URL(request.url).searchParams;const id=params.get('id');const kind=params.get('kind');
 if(!uuid(id)||!['payroll','receipt'].includes(kind||''))throw new EconomyError('Ogiltigt dokument.');
 if(kind==='receipt'){
  const {data:r,error}=await db.from('economy_receipts').select('file_path,mime_type').eq('id',id).single();if(error||!r)throw new EconomyError('Kvittot finns inte.',404);
  const {data,error:downloadError}=await db.storage.from('economy-receipts').download(r.file_path);if(downloadError||!data)throw new EconomyError('Filen kunde inte hämtas.',502);
  return new Response(await data.arrayBuffer(),{headers:{'Content-Type':r.mime_type,'Content-Disposition':`attachment; filename="kvitto-${id}.${r.mime_type==='application/pdf'?'pdf':r.mime_type==='image/png'?'png':'jpg'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 const {data:r,error}=await db.from('economy_payroll').select('*').eq('id',id).single();if(error||!r)throw new EconomyError('Lönen finns inte.',404);
 const row=r as PayrollRow,d=row.details,doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);let page=doc.addPage([595,842]),y=790;
 const safe=(s:string)=>Array.from(s).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');
 function line(text:string,strong=false,size=11){
  const words=safe(text).split(/\s+/);let part='';const f=strong?bold:font;
  const draw=(s:string)=>{if(y<55){page=doc.addPage([595,842]);y=790;}page.drawText(s,{x:42,y,size,font:f,color:rgb(.04,.15,.24)});y-=size+9;};
  for(const word of words){if(f.widthOfTextAtSize(part+' '+word,size)>505&&part){draw(part);part='';}for(const char of (part?' ':'')+word){if(f.widthOfTextAtSize(part+char,size)>505){draw(part);part='';}part+=char;}}if(part)draw(part);
 }
 line('AVENYN TAXI',true,20);line(row.status==='draft'?'Löneunderlag – UTKAST':'Lönebesked',true,18);
 line(`Löneperiod: ${row.period} | Utbetalningsdatum: ${row.payment_date}`);line(`Status: ${row.status==='paid'?'Utbetald enligt administratörens registrering':row.status==='approved'?'Godkänd – ännu inte markerad som utbetald':'Ej godkänd'}`);
 y-=10;line(d.employerName||'Arbetsgivare saknas',true);line(`Organisationsnummer: ${d.employerOrg||'saknas'}`);line(d.employerAddress||'Adress saknas');y-=10;
 line(row.employee_name,true);line(`Person-/samordningsnummer: ${d.employeeIdentity||'saknas'}`);line(d.employeeAddress||'Adress saknas');y-=10;
 for(const [label,value] of [['Bruttolön',d.gross],['Skattepliktiga förmåner (ingår inte i kontant lön)',d.benefits],['Avdragen preliminär skatt',d.tax],['Skattefria kostnadsersättningar',d.reimbursement],['Tidigare utbetalt förskott / nettoreglering',d.advance],['Att betala ut',netPay(d)],['Arbetsgivaravgifter enligt underlag',d.employerFee]] as const)line(`${label}: ${['Avdragen preliminär skatt','Att betala ut','Arbetsgivaravgifter enligt underlag'].includes(label)&&!hasPayrollCalculation(d)?missingTaxMessage:Number.isFinite(value)?sek(value):'Ej angivet'}`,label==='Att betala ut');
 line(`Skatteunderlag: ${d.taxBasis||'Ej angivet'}`);if(d.notes){y-=10;line('Övertid, frånvaro, semester och övriga upplysningar',true);line(d.notes);}
 y-=10;line('Ingen bankbetalning eller deklaration skickas av detta dokument.',false,9);line(`Referens: ${row.id} | Version: ${row.revision}`,false,9);
 const bytes=await doc.save();return new Response(bytes as unknown as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="lonebesked-${row.period}-${row.id.slice(0,8)}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return failure(e);}}
