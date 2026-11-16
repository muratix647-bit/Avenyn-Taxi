import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {receiptLogo} from './receipt-logo';
import {invoiceNo,invoiceBankgiro,paidNoticeSv,paidNoticeEn,customerNumber,paymentReference,simplifiedInvoice,postalAddress} from './customer-invoice';
import {sek} from './economy-workspace';

export async function customerInvoicePdf(row:any,correctPayment=false,paidReceipt=false){
  const d=row.document,doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),logo=await doc.embedJpg(receiptLogo);
  const navy=rgb(.025,.17,.26),blue=rgb(.02,.47,.69),pale=rgb(.93,.97,.985),gold=rgb(1,.84,.15);
  const credit=!!row.creditDate;
  const number=paidReceipt?'B'+d.booking.number:(credit?'K-':'')+invoiceNo(row.serial_no),due=new Date(row.issued_on+'T12:00:00Z');due.setUTCDate(due.getUTCDate()+Number(d.days));
  const dueText=due.toISOString().slice(0,10);
  doc.setTitle('Avenyn Taxi · '+(paidReceipt?'Kvitto ':'Faktura ')+number);doc.setAuthor('Avenyn Taxi');
  let page=doc.addPage([595,842]),y=690;
  const clean=(value:unknown)=>Array.from(String(value??'')).map(c=>{try{regular.encodeText(c);return c;}catch{return ' ';}}).join('');
  function text(v:unknown,x:number,top:number,size=10,strong=false,color=navy){page.drawText(clean(v),{x,y:top,size,font:strong?bold:regular,color});}
  function right(v:string,x:number,top:number,size=10,strong=false){text(v,x-(strong?bold:regular).widthOfTextAtSize(clean(v),size),top,size,strong);}
  function room(height:number){if(y-height<86){page=doc.addPage([595,842]);text('AVENYN TAXI',42,790,13,true,blue);right(number,553,790);y=758;}}
  function wrap(v:unknown,width:number){
    const lines:string[]=[];let line='';
    for(const word of clean(v).split(/\s+/)){
      if(line&&regular.widthOfTextAtSize(line+' '+word,10)>width){lines.push(line);line='';}
      for(const c of (line?' ':'')+word){if(regular.widthOfTextAtSize(line+c,10)>width){lines.push(line);line='';}line+=c;}
    }
    if(line)lines.push(line);return lines;
  }
  function paragraph(v:string,width=511){for(const line of wrap(v,width)){room(15);text(line,42,y);y-=15;}}
  page.drawImage(logo,{x:42,y:736,width:106,height:106*logo.height/logo.width});
  right(paidReceipt?'KVITTO':credit?'KREDITFAKTURA':'FAKTURA',553,778,credit?22:28,true);right(number,553,754,14);
  if(!paidReceipt&&(d.simplified||(simplifiedInvoice(d.kind,row.gross_ore)&&!postalAddress(d.address))))right('Förenklad faktura',553,736,9);
  page.drawRectangle({x:42,y:719,width:511,height:3,color:gold});
  if(paidReceipt){
    text(paidNoticeSv+'  /  '+paidNoticeEn,42,y+5,9,false,rgb(.19,.36,.28));y-=17;
  }
  text(paidReceipt?'MOTTAGARE':'FAKTURAMOTTAGARE',42,y,9,true,blue);text(paidReceipt?'KVITTOUPPGIFTER':'FAKTURAUPPGIFTER',360,y,9,true,blue);y-=22;
  text(paidReceipt?'Resedatum':'Fakturadatum',360,y);right(row.creditDate||row.issued_on,553,y);text(paidReceipt?'Status':credit?'Avser faktura':'Förfallodatum',360,y-18);right(paidReceipt?'Betald':credit?invoiceNo(row.serial_no):dueText,553,y-18);
  if(row.customer_no){text('Kundnummer',360,y-36);right(customerNumber(row.customer_no),553,y-36);}
  const start=y;paragraph(d.name,290);if(d.address&&(!simplifiedInvoice(d.kind,row.gross_ore)||postalAddress(d.address)))paragraph(d.address,290);
  if(d.org)paragraph('Org.nr: '+d.org,290);if(d.reference)paragraph('Er referens: '+d.reference,290);
  y=Math.min(start-59,y)-12;paragraph('Tjänstedatum: '+d.serviceDate);y-=12;
  if(d.replaces)paragraph('Ersätter krediterad faktura '+d.replaces);
  if(d.booking){
    const b=d.booking;room(106);text('BOKNING #'+b.number,42,y,10,true,blue);y-=17;
    paragraph([b.name,b.phone,b.email].filter(Boolean).join(' · '));
    if(d.recipientEmail&&d.recipientEmail!==b.email)paragraph('Fakturamejl: '+d.recipientEmail);
    paragraph([b.date,b.time,b.from,b.stop&&'Via '+b.stop,b.to].filter(Boolean).join(' · '));
    if(paidReceipt && d.tripDetails){
      const t=d.tripDetails;
      paragraph([b.car,b.passengers!=null&&b.passengers+' passagerare',b.bags!=null&&'Bagage: '+b.bags,'Barnstol: '+t.seats].filter(Boolean).join(' · '));
      paragraph('Flygnummer: '+(t.flight||'Ej angivet')+' · Avslutad (svensk tid): '+(t.completed||'Ej angivet'));
      paragraph('Betalsätt: '+t.method+' · Betalning mottagen'+(t.verified?' · Verifierad onlinebetalning':''));
      if(t.paymentNote)paragraph('Betalningsanteckning: '+t.paymentNote);
      if(t.message)paragraph('Meddelande vid bokning: '+t.message);
      y-=12;
    }else{
    paragraph([b.car,b.passengers!=null&&b.passengers+' passagerare',b.bags!=null&&b.bags+' bagage',b.seats>0&&b.seats+' barnstol(ar)',b.flight&&'Flyg '+b.flight].filter(Boolean).join(' · '));y-=12;
    }
  }else if(d.recipientEmail){paragraph('Fakturamejl: '+d.recipientEmail);y-=12;}
  function header(){page.drawRectangle({x:42,y:y-7,width:511,height:24,color:pale});text('Tjänst',50,y,10,true);right('Antal',321,y);right('À-pris inkl.',406,y);right('Moms',463,y);right('Belopp inkl.',546,y);y-=25;}
  room(62);header();
  const items=d.items?.length?d.items:[{description:d.description,quantity:1,gross:row.gross_ore,unitOre:row.gross_ore,net:row.gross_ore-row.vat_ore,vat:row.vat_ore,rate:d.rate,reason:d.vatReason}];
  const groups=new Map<number,{net:number;vat:number}>();
  for(const i of items){
    const label=wrap(i.description,241),height=16*label.length+16;if(y-height<86){room(height);header();}
    right(String(i.quantity),321,y);right(sek(i.unitOre),406,y);right(i.rate+' %',463,y);right(sek(credit?-i.gross:i.gross),546,y,10,true);
    for(const line of label){text(line,50,y);y-=16;}if(i.reason)paragraph(i.reason);y-=8;
    page.drawLine({start:{x:42,y},end:{x:553,y},color:pale,thickness:1});y-=14;
    const g=groups.get(i.rate)||{net:0,vat:0};g.net+=i.net;g.vat+=i.vat;groups.set(i.rate,g);
  }
  room(70+groups.size*19);text('MOMSSPECIFIKATION',42,y,9,true,blue);y-=20;
  for(const [rate,g] of groups){text(rate+' %',42,y);text('Underlag '+sek(credit?-g.net:g.net),110,y);right('Moms '+sek(credit?-g.vat:g.vat),553,y);y-=19;}
  text('Totalt exkl. moms: '+sek((credit?-1:1)*(row.gross_ore-row.vat_ore)),42,y);right('Total moms: '+sek(credit?-row.vat_ore:row.vat_ore),553,y);y-=27;
  if(paidReceipt){
    room(100);page.drawRectangle({x:42,y:y-73,width:511,height:73,color:pale});page.drawRectangle({x:42,y:y-73,width:4,height:73,color:gold});
    text('BETALT BELOPP',57,y-22,11,true);right(sek(row.gross_ore),536,y-30,22,true);
    text('Kvar att betala',57,y-55,11,true);right(sek(0),536,y-55,12,true);y-=95;
  }else if(credit){room(60);text('KREDITERAT BELOPP',42,y,12,true);right(sek(-row.gross_ore),548,y,18,true);y-=25;paragraph('Helkreditering av '+invoiceNo(row.serial_no)+'. Ingen betalning ska göras för kreditfakturan.');}else{
  const info=wrap(correctPayment?invoiceBankgiro:d.payment,470),height=104+14*info.length;
  room(height+25);page.drawRectangle({x:42,y:y-height,width:511,height,color:pale});page.drawRectangle({x:42,y:y-height,width:4,height,color:gold});
  text('ATT BETALA',57,y-22,11,true);right(sek(row.gross_ore),536,y-30,22,true);text('Betala senast '+dueText,57,y-48,11,true);
  info.forEach((v,i)=>text(v,57,y-66-i*14,11,true));text('Ange som meddelande vid betalning',57,y-height+30,9);
  text(paymentReference(row),57,y-height+12,13,true,blue);y-=height+22;
  if(correctPayment)paragraph('Rättad betalningsuppgift för samma faktura. Belopp och förfallodatum är oförändrade.');
  }
  if(!paidReceipt&&postalAddress(d.sellerAddress))paragraph('Avsändaradress: '+d.sellerAddress);
  doc.getPages().forEach((p,i)=>{
    p.drawText('Avenyn Taxi   |   info@avenyntaxi.se   |   www.avenyntaxi.se',{x:42,y:54,size:9,font:bold,color:navy});
    p.drawText('Citra Trans och Bilservice AB   |   Org.nr 556597-4796   |   Momsreg.nr '+clean(d.sellerVat),{x:42,y:38,size:8,font:regular,color:navy});
    if(paidReceipt)p.drawText(invoiceBankgiro,{x:42,y:24,size:8,font:regular,color:navy});
    p.drawText(number+'   |   '+(i+1)+' / '+doc.getPageCount(),{x:426,y:54,size:8,font:regular,color:navy});
  });
  return doc.save();
}
