import { validDate, uuid } from './economy-workspace';
export type PayrollTransfer = { driverId:string; paymentDate:string; gross:string; tax:string; employerFee:string; taxBasis:string };
export type ReceiptTransfer = { file:File; expenseDate:string; supplier:string; amount:string; vat:string; category:string; note:string };
type SalaryResult = { bruttolon_kr?:number; beraknat_bruttobelopp_kr?:number; skatteavdrag_kr?:number|null; arbetsgivaravgift_kr?:number; nettolon_kr?:number|null; skattetabell?:number; kolumn?:number; skattear?:number };
export function payrollTransfer(result:SalaryResult,driverId:string,paymentDate:string):PayrollTransfer {
 if(!uuid(driverId)||!validDate(paymentDate))throw new Error('Välj förare och ett giltigt utbetalningsdatum.');
 const gross=result.beraknat_bruttobelopp_kr??result.bruttolon_kr,tax=result.skatteavdrag_kr,fee=result.arbetsgivaravgift_kr,net=result.nettolon_kr;
 if([gross,tax,fee,net].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)||Math.abs(Number(gross)-Number(tax)-Number(net))>0.011)throw new Error('Beräkna ett fullständigt löneförslag före överföringen.');
 return {driverId,paymentDate,gross:Number(gross).toFixed(2),tax:Number(tax).toFixed(2),employerFee:Number(fee).toFixed(2),taxBasis:`Preliminärt tabellförslag ${result.skattear??2026}, tabell ${result.skattetabell??'ej angiven'}, kolumn ${result.kolumn??'ej angiven'}. Kontrollera mot skattebeslut.`};
}
