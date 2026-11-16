export const MONEY_KEYS = ['gross','tax','benefits','reimbursement','advance','employerFee'] as const;
export type PayrollDetails = Record<typeof MONEY_KEYS[number], number> & {
 employerName: string; employerOrg: string; employerAddress: string;
 employeeIdentity: string; employeeAddress: string; taxZeroReason?: string; employerFeeExemptionReason?: string; notes: string; taxBasis: string;
};
export type PayrollRow = { id:string; driver_id:string; employee_name:string; period:string; payment_date:string; details:PayrollDetails; status:'draft'|'approved'|'paid'; revision:number; archived_at:string|null; approved_at:string|null; paid_at:string|null };
export type ReceiptRow = { id:string; expense_date:string; supplier:string; category:string; amount_ore:number; vat_ore:number; deductible_vat_ore:number; note:string; file_name:string; archived_at:string|null };
export const sek = (ore:number) => new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(ore/100);
export function ore(value:unknown):number {
 const s=String(value ?? '').trim().replace(',','.');
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(s)) throw new Error('Ange ett positivt belopp med högst två decimaler.');
 const n=Math.round(Number(s)*100);
 if(n>100000000) throw new Error('Beloppet får vara högst 1 000 000 kr.');
 return n;
}
export function textField(value:unknown,max=300):string {
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new Error('Kontrollera textfälten.');
 return value.trim();
}
export function validDate(v:unknown):v is string {
 if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+'T12:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===v;
}
export function validPeriod(v:unknown):v is string {return typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(v);}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const netPay=(d:PayrollDetails)=>d.gross-d.tax+d.reimbursement-d.advance;
export const payrollEmployer = {employerName:'Citra Trans och Bilservice AB', employerOrg:'556597-4796'};
export const missingTaxMessage = 'Ej beräknat – ange skattetabell/skattebeslut';
export function hasPayrollCalculation(d:PayrollDetails):boolean {
 return Number.isSafeInteger(d.gross) && d.gross > 0 && !!d.taxBasis?.trim()
   && Number.isSafeInteger(d.tax) && d.tax >= 0 && d.tax <= d.gross
   && Number.isSafeInteger(d.employerFee) && d.employerFee >= 0
   && (d.tax > 0 || d.gross < 100000 || !!d.taxZeroReason?.trim())
   && (d.employerFee > 0 || d.gross < 100000 || !!d.employerFeeExemptionReason?.trim());
}
export function payrollDetails(body:Record<string,unknown>):PayrollDetails {
 const d={} as PayrollDetails;
 for(const k of MONEY_KEYS)d[k]=ore(body[k]);
 for(const k of ['employerName','employerOrg','employerAddress','employeeIdentity','employeeAddress','taxBasis'] as const)d[k]=textField(body[k]??'');
 Object.assign(d,payrollEmployer);
 d.taxZeroReason=textField(body.taxZeroReason??'');
 d.employerFeeExemptionReason=textField(body.employerFeeExemptionReason??'');
 d.notes=textField(body.notes??'',2000);
 if(netPay(d)<0)throw new Error('Skatt och förskott ger ett negativt belopp att betala ut. Kontrollera beloppen.');
 return d;
}
export function approvalError(d:PayrollDetails):string|null {
 if(!hasPayrollCalculation(d))return missingTaxMessage;
 if(!d.employerName||!d.employerAddress||!d.employeeAddress||!d.taxBasis)return 'Fyll i arbetsgivare, adresser och underlag för skatteavdrag.';
 if(!/^\d{10}$/.test(d.employerOrg.replace(/[- ]/g,'')))return 'Ange arbetsgivarens organisationsnummer med 10 siffror.';
 if(!/^\d{12}$/.test(d.employeeIdentity.replace(/[-+ ]/g,'')))return 'Ange person- eller samordningsnummer med 12 siffror.';
 if(d.gross===0&&d.benefits===0)return 'Ange bruttolön eller förmån innan du godkänner.';
 return null;
}
export function csv(rows:unknown[][]):string {
 return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(';')).join('\r\n');
}
export function fileType(bytes:Uint8Array):string|null {
 if(bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-')return 'application/pdf';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 return null;
}
