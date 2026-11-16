import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {receiptLogo} from './receipt-logo';
// Read-only preview. No invoice number, payment instructions or ledger mutation.
export async function businessInvoicePreview(link:any,grossOre:number,now=new Date()):Promise<Uint8Array>{
 const doc=await PDFDocument.create();doc.setTitle(`Fakturautkast - bokning ${link.booking.booking_number}`);doc.setAuthor('Avenyn Taxi');
 const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),logo=await doc.embedJpg(receiptLogo);
 const navy=rgb(.05,.17,.29),muted=rgb(.35,.41,.48),gold=rgb(1,.87,.35);
 const clean=(v:unknown)=>Array.from(String(v??'').normalize('NFC')).map(c=>{if(c==='\n'||c==='\r')return c;try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
 let page:any,y=0;
 const text=(v:unknown,x:number,top:number,size=11,strong=false,color=navy)=>page.drawText(clean(v),{x,y:top,size,font:strong?bold:regular,color});
 const newPage=()=>{page=doc.addPage([595.28,841.89]);page.drawImage(logo,{x:42,y:751,width:96,height:96*logo.height/logo.width});text('FAKTURAUTKAST',270,787,21,true);text('Förhandsvisning - inte utfärdad',270,765,10,false,muted);page.drawRectangle({x:42,y:706,width:511,height:30,color:gold});text('UTKAST - SKA INTE BETALAS',55,716,11,true);y=680;};
 const room=(height:number)=>{if(y-height<90)newPage();};
 const wrap=(v:unknown,width:number,size=11)=>{const out:string[]=[];for(const paragraph of clean(v).split(/\r?\n/)){let line='';for(const word of paragraph.split(/\s+/)){if(line&&regular.widthOfTextAtSize(line+' '+word,size)>width){out.push(line);line='';}for(const ch of (line?' ':'')+word){if(regular.widthOfTextAtSize(line+ch,size)>width){out.push(line);line='';}line+=ch;}}out.push(line||'-');}return out;};
 const row=(label:string,v:unknown)=>{const lines=wrap(v,335);room(Math.min(lines.length*15+9,100));text(label,42,y,10,false,muted);for(const line of lines){room(15);text(line,208,y);y-=15;}y-=9;};
 newPage();row('Säljare','Citra Trans och Bilservice AB / Avenyn Taxi');row('Organisationsnummer','556597-4796');row('Kontakt','info@avenyntaxi.se');
 row('Förhandsvisning skapad',now.toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'}));row('Fakturanummer','Tilldelas först vid utfärdande');
 row('Företagskund',link.company.name);row('Kundens företags-ID',link.company.org_number);row('Fakturaadress',link.company.billing_address);row('Fakturamejl',link.company.invoice_email);row('Kundreferens',link.reference||'Ingen angiven');row('Betalningsvillkor',`${link.company.payment_days} dagar från framtida fakturadatum`);
 row('Bokning',`#${link.booking.booking_number} - ${link.booking.booking_date}`);row('Hämtning',link.booking.pickup_address);row('Destination',link.booking.dropoff_address);
 const money=(n:number)=>(n/100).toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2})+' kr',net=Math.round(grossOre/1.06);
 room(160);row('Preliminärt exkl. moms',money(net));row('Preliminär moms 6 %',money(grossOre-net));
 page.drawRectangle({x:42,y:y-45,width:511,height:45,color:navy});text('Totalt inkl. moms',55,y-28,13,true,rgb(1,1,1));text(money(grossOre),375,y-28,18,true,gold);y-=65;
 for(const line of wrap('Momsberäkningen antar svensk persontransport med 6 % moms. Kontrollera momssats och företagsuppgifter före utfärdande.',505,10)){text(line,42,y,10,false,muted);y-=14;}
 doc.getPages().forEach((p,i)=>{p.drawText('Ej faktura eller bokföringsunderlag. Ingen betalning ska göras.',{x:42,y:55,size:9,font:regular,color:muted});p.drawText(`Avenyn Taxi | Utkast | Sida ${i+1} av ${doc.getPageCount()}`,{x:42,y:39,size:9,font:regular,color:muted});});return doc.save();
}
