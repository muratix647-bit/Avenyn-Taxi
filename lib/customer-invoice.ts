import {ore,validDate,uuid} from './economy-workspace';

export const paidNoticeSv = 'Resan är betald. OBS! Betala inte.';
export const paidNoticeEn = 'This trip has been paid for. Do not pay.';
export const invoiceBankgiro = 'Bankgiro 5370-4524';
export const services = {
  passenger: {label:'Persontransport',rate:6},
  courier: {label:'Bud och godstransport',rate:25},
} as const;
export type Service = keyof typeof services;
export type InvoiceLineInput = {service:Service|'other';description:string;quantity:string;amount:string;rate:string;vatReason:string};
export function newInvoiceLine():InvoiceLineInput {
  return {service:'passenger',description:'Persontransport med taxi',quantity:'1',amount:'',rate:'6',vatReason:''};
}
export function priceLines(lines:InvoiceLineInput[]) {
  if(!Array.isArray(lines)||lines.length<1||lines.length>25)throw Error('Ange mellan 1 och 25 fakturarader.');
  const items=lines.map(line=>{
    if(!line||!['passenger','courier','other'].includes(line.service))throw Error('Välj typ av tjänst.');
    const rate=line.service==='other'?Number(line.rate):services[line.service].rate;
    const description=String(line.description??'').trim(),quantity=Number(line.quantity),unitOre=ore(line.amount);
    if(!description||description.length>300||/[\u0000-\u001f]/u.test(description))throw Error('Ange en beskrivning på varje rad.');
    if(!Number.isInteger(quantity)||quantity<1||quantity>999||unitOre<=0)throw Error('Kontrollera antal och pris på varje rad.');
    if(![0,6,12,25].includes(rate)||line.service==='other'&&!['0','6','12','25'].includes(String(line.rate)))throw Error('Välj momssats.');
    const reason=rate===0?String(line.vatReason??'').trim():'';
    if(rate===0&&(!reason||reason.length>160))throw Error('Ange grund för momsfrihet.');
    const gross=unitOre*quantity,net=Math.round(gross*100/(100+rate));
    return {service:line.service,description,quantity,unitOre,rate,gross,net,vat:gross-net,reason};
  });
  const gross=items.reduce((n,i)=>n+i.gross,0),vat=items.reduce((n,i)=>n+i.vat,0);
  if(gross>100000000)throw Error('Fakturabeloppet får vara högst 1 000 000 kr.');
  return {items,gross,vat};
}
export const simplifiedInvoice=(kind:unknown,gross:number)=>kind==='private'&&gross>0&&gross<=400000;
export const postalAddress=(v:string)=>!!v&&v.trim().length>=6&&/[0-9]/.test(v)&&/[a-zåäö]/i.test(v);
export const customerNumber=(n:number)=>'K'+String(n).padStart(6,'0');
export const paymentReference=(row:{serial_no:number;customer_no?:number;document?:{refFormat?:string}})=>row.document?.refFormat==='short'?'F'+row.serial_no:[row.customer_no&&customerNumber(row.customer_no),invoiceNo(row.serial_no)].filter(Boolean).join(' ');
export function invoiceInput(b:Record<string,unknown>) {
  function field(k:string,limit:number,required=true){
    const v=typeof b[k]==='string'?(b[k] as string).trim():'';
    if((required&&!v)||v.length>limit||/[\u0000-\u001f]/u.test(v))throw Error('Kontrollera fältet '+k+'.');
    return v;
  }
  if(!uuid(b.id)||!['private','company'].includes(String(b.kind))||!validDate(b.serviceDate))throw Error('Kontrollera kundtyp och resedatum.');
  const priced=b.items===undefined?null:priceLines(b.items as InvoiceLineInput[]);
  const gross=priced?.gross??ore(b.amount);
  if(!gross||!priced&&!['6','12','25','0'].includes(String(b.rate)))throw Error('Kontrollera pris och momssats.');
  const rate=Number(b.rate),days=Number(b.days);
  if(!Number.isInteger(days)||days<1||days>90)throw Error('Betalningsvillkor ska vara 1–90 dagar.');
  const sellerVat=field('sellerVat',20);
  if(!/^SE556597479601$/.test(sellerVat))throw Error('Kontrollera säljarens momsregistreringsnummer.');
  const simple=simplifiedInvoice(b.kind,gross);
  const address=field('address',250,!simple),sellerAddress=field('sellerAddress',250,!simple);
  if((address&&!postalAddress(address))||(sellerAddress&&!postalAddress(sellerAddress)))throw Error('Kontrollera postadressen eller lämna det valfria fältet tomt.');
  if(b.payment!==undefined&&b.payment!==invoiceBankgiro)throw Error('Betalning görs till '+invoiceBankgiro+'. Ladda om sidan.');
  const recipientEmail=String(b.recipientEmail??'').trim();
  if(recipientEmail&&!validInvoiceEmail(recipientEmail))throw Error('Ange en giltig e-postadress för fakturan.');
  const document={refFormat:'short',recipientEmail,kind:b.kind,name:field('name',160),address,simplified:simple&&(!address||!sellerAddress),org:field('org',40,b.kind==='company'),reference:field('reference',100,false),description:priced?.items[0].description??field('description',300),serviceDate:b.serviceDate,rate:priced?.items[0].rate??rate,...(priced?{items:priced.items}:{}),days,sellerVat,sellerAddress,payment:invoiceBankgiro,vatReason:field('vatReason',160,!priced&&rate===0)};
  const bookingId=b.bookingId||null;if(bookingId&&!uuid(bookingId))throw Error('Ogiltigt bokningsnummer.');
  return {id:b.id,booking_id:bookingId as string|null,document,gross_ore:gross,vat_ore:priced?.vat??(gross-Math.round(gross*100/(100+rate)))};
}
export function invoiceNo(n:number){return 'AT-'+String(n).padStart(7,'0');}

export const validInvoiceEmail=(v:string)=>v.length<=254&&/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(v);
