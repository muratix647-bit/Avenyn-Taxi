import {customerInvoicePdf} from './customer-invoice-pdf';
import {paidTripDetails} from './paid-trip-details';
import {invoiceBooking} from './invoice-booking';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { receiptAmounts, receiptPaid } from './receipt';
import { receiptLogo } from './receipt-logo';
export function pdfBase64(bytes:Uint8Array){let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);}
export async function receiptPdf(b:any):Promise<Uint8Array>{
 if(receiptPaid(b)){
  const {gross,vat}=receiptAmounts(b);
  const booking=invoiceBooking({...b,invoice_stop:b.price_breakdown?.stop_address});
  return customerInvoicePdf({issued_on:b.booking_date,gross_ore:gross,vat_ore:vat,document:{
    booking,tripDetails:paidTripDetails(b),kind:'private',name:booking.name,description:'Persontransport med taxi',serviceDate:b.booking_date,
    days:0,rate:6,sellerVat:'SE556597479601',sellerAddress:'Kungsportsavenyn 1, Göteborg'
  }},false,true);
 }
 const doc=await PDFDocument.create();
 doc.setTitle(`Avenyn Taxi ${receiptPaid(b)?'Kvitto':'Resesammanställning'} #${b.booking_number}`);
 doc.setAuthor('Avenyn Taxi · Citra Trans och Bilservice AB');
 const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const logo=await doc.embedJpg(receiptLogo),navy=rgb(.035,.15,.215),muted=rgb(.32,.42,.47),yellow=rgb(1,.85,.2);
 let page=doc.addPage([595.28,841.89]), y=680;
 // Standard font supports Swedish and Western European text; unsupported glyphs must never block delivery.
 const clean=(v:unknown)=>Array.from(String(v??'').normalize('NFC')).map(c=>{try{regular.encodeText(c);return c}catch{return '?'}}).join('');
 const text=(v:unknown,x:number,top:number,size=11,strong=false,color=navy)=>page.drawText(clean(v),{x,y:top,size,font:strong?bold:regular,color});
 const lines=(value:unknown,width:number,size=11)=>{const result:string[]=[];let line='';for(const word of clean(value).split(/\s+/)){for(const ch of (line?' ':'')+word){if(regular.widthOfTextAtSize(line+ch,size)>width){result.push(line);line='';}line+=ch;}}if(line)result.push(line);return result.length?result:['—'];};
 const room=(height:number)=>{if(y-height<95){page=doc.addPage([595.28,841.89]);text('AVENYN TAXI · fortsättning',42,795,11,true);y=755;}};
 const row=(label:string,value:unknown)=>{const wrapped=lines(value,325);const height=Math.max(31,wrapped.length*16+15);room(height);text(label,42,y,10,false,muted);wrapped.forEach((line,i)=>text(line,202,y-i*16));page.drawLine({start:{x:42,y:y-height+10},end:{x:553,y:y-height+10},thickness:.5,color:rgb(.84,.89,.92)});y-=height;};
 page.drawImage(logo,{x:42,y:723,width:118,height:118*logo.height/logo.width});
 text(receiptPaid(b)?'Kvitto':'Resesammanställning',260,777,20,true);
 text(`#${b.booking_number}`,260,752,12,false,muted);
 text('Citra Trans och Bilservice AB',42,y,12,true);y-=19;
 text('Avenyn Taxi · Org.nr 556597-4796',42,y,10);y-=17;
 text('Kungsportsavenyn 1, Göteborg',42,y,10,false,muted);y-=34;
 row('Resa avslutad',b.completed_at?new Date(b.completed_at).toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'}):b.booking_date);
 row('Kund',b.customer_name);row('Hämtning',b.pickup_address);row('Destination',b.dropoff_address);
 const methods:Record<string,string>={card:'Kort',swish:'Swish',paypal:'PayPal',cash:'Kontant',invoice:'Faktura',app:'Appbetalning',payment_link:'Betallänk',other:'Annat'};
 const method=b.driver_reported_payment_method||b.payment_method;row('Betalsätt',methods[method]||method||'Ej angivet');row('Betalningsstatus',receiptPaid(b)?'Betald':'Ej betald');
 const {gross,net,vat}=receiptAmounts(b),money=(n:number)=>(n/100).toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2})+' kr';
 row('Belopp exkl. moms',money(net));row('Moms 6 %',money(vat));room(105);
 page.drawRectangle({x:42,y:y-49,width:511,height:49,color:navy});text('Totalt inkl. moms',57,y-30,13,true,rgb(1,1,1));text(money(gross),355,y-31,20,true,yellow);y-=76;
 if(!receiptPaid(b)){text('Ej betalningskvitto. Betalningen är inte registrerad.',42,y,10,false,muted);}
 for(const p of doc.getPages()){p.drawText('Tack för att du reste med Avenyn Taxi.',{x:42,y:57,size:10,font:regular,color:muted});p.drawText('info@avenyntaxi.se · 0700-315 315',{x:42,y:41,size:10,font:regular,color:muted});}
 return doc.save();
}
