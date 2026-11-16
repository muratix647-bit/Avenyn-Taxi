export type ReportPeriod={from:string;to:string};
export function stockholmDay(value:Date|string=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function monthPeriod(month=stockholmDay().slice(0,7)):ReportPeriod{return {from:month+'-01',to:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10)}}
export function validPeriod(p:ReportPeriod){return [p.from,p.to].every(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v)&&p.from<=p.to;}
export function isOwnCompany(company:string){return company.trim().toLocaleLowerCase('sv-SE').replace(/\s+/g,' ')==='citra trans och bilservice ab';}

export function weekPeriod(previous=false):ReportPeriod{const d=new Date(stockholmDay()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)-(previous?7:0));const from=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {from,to:d.toISOString().slice(0,10)}}
