
import {AppText} from "@/components/app-language";
import {sumCommission} from '@/lib/trip-commission';
import styles from './commission-breakdown.module.css';
const money=(ore:number)=>new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',minimumFractionDigits:2,maximumFractionDigits:2}).format(ore/100);
export default function CommissionBreakdown({amounts,title='Moms och provision',driver=false,commission=false,showDriverShare=true}:{amounts:unknown[];title?:string;driver?:boolean;commission?:boolean;showDriverShare?:boolean}){
 const total=sumCommission(amounts);
 return <section className={styles.panel} aria-label={title}><h3>{<AppText text={title} />}</h3><dl>
 <div><dt><AppText text={"Inkört inkl. moms"} /></dt><dd>{<AppText text={money(total.gross)} />}</dd></div>
 {commission?<><div><dt><AppText text={"Moms på resorna · 6 %"} /></dt><dd>{<AppText text={money(total.vat)} />}</dd></div><div><dt><AppText text={"Inkört exkl. moms"} /></dt><dd>{<AppText text={money(total.net)} />}</dd></div><div><dt><AppText text={"Provision · 10 % av inkört"} /></dt><dd>{<AppText text={money(-total.commission)} />}</dd></div><div className={styles.total}><dt><AppText text={"Kvar efter provision"} /></dt><dd>{<AppText text={money(total.remainder)} />}</dd></div></>:showDriverShare?<>
 <div><dt><AppText text={"Avdrag · inkört × 0,06"} /></dt><dd>{<AppText text={money(-total.driverDeduction)} />}</dd></div>
 <div><dt><AppText text={"Underlag efter avdrag"} /></dt><dd>{<AppText text={money(total.driverBase)} />}</dd></div>
 <div className={styles.total}><dt>{<AppText text={driver?'Din andel':'Förarandel'} />} · 30 %</dt><dd>{<AppText text={money(total.driverShare)} />}</dd></div></>:<div><dt><AppText text={"Inkört exkl. moms"} /></dt><dd>{<AppText text={money(total.net)} />}</dd></div>}
 </dl>
 {!commission&&showDriverShare&&<details style={{marginTop:14}}><summary style={{cursor:'pointer',fontSize:14}}><AppText text={"Visa momsuppgifter"} /></summary><dl><div><dt><AppText text={"Moms på resorna · 6 %"} /></dt><dd>{<AppText text={money(total.vat)} />}</dd></div><div><dt><AppText text={"Inkört exkl. moms"} /></dt><dd>{<AppText text={money(total.net)} />}</dd></div></dl><p><AppText text={"Avdraget i förarberäkningen är separat från momsbeloppet."} /></p></details>}
 <p><AppText text={"Slutförda resor."} />{<AppText text={commission?' Veckounderlag före eventuell moms på provision och avräkning av betalningar som åkeriet redan tagit emot.':showDriverShare?' Förarandelen beräknas på periodens totalbelopp och visas före personlig skatt.':' Ersättningen till föraren hanteras av åkeriet.'} />} <AppText text={"Ingen utbetalning görs här."} /></p></section>;
}
