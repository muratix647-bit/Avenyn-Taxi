import type { Metadata } from 'next';
import PartnerForm from './partner-form';
import styles from './partner.module.css';
export const metadata:Metadata={title:{absolute:'Bli åkeripartner i Göteborg | Avenyn Taxi'},description:'Ansök om samarbete med Avenyn Taxi. För taxiåkerier i Göteborg och på Västkusten som vill köra förbokade resor och flygtransfer till Landvetter.',alternates:{canonical:'https://www.avenyntaxi.se/bli-akeripartner'}};
export default function Page(){return <div className={styles.page}>
 <header className={styles.header}><a href="/" className={styles.brand}><img src="/avenyn-logo-optimized.webp" width="48" height="48" alt=""/><b>Avenyn Taxi</b></a><a href="/akeri">Åkeriinloggning</a></header>
 <main className={styles.layout}><section className={styles.intro}>
  <span className={styles.eyebrow}>ÅKERIPARTNER · GÖTEBORG & VÄSTKUSTEN</span>
  <h1>Ditt åkeri.<br/>Vårt nästa samarbete.</h1>
  <p>Har du egna taxibilar och förare? Ansök om att köra förbokade resor och Landvettertransfer tillsammans med Avenyn Taxi.</p>
  <img className={styles.photo} src="/avenyn-day-taxi.webp" alt="Avenyn Taxi i Göteborg" width="1000" height="667"/>
  <div className={styles.steps}><div><b>01 · Ansök</b><span>Berätta om ditt åkeri och område.</span></div><div><b>02 · Vi tar kontakt</b><span>Vi går igenom förutsättningar och trafiktillstånd.</span></div><div><b>03 · Kom överens</b><span>Provision, betalning och ansvar bestäms i ett partneravtal.</span></div></div>
  <p className={styles.small}>En ansökan är kostnadsfri och innebär inget bindande avtal. Samarbetet börjar först efter granskning och överenskommelse.</p>
 </section><section className={styles.formCard}><h2>Bli åkeripartner</h2><p>Fyll i uppgifterna så kontaktar vi dig.</p><PartnerForm/></section></main>
 <footer className={styles.footer}><span>Avenyn Taxi · Göteborg sedan 2003</span><a href="/integritet">Integritet</a><a href="mailto:info@avenyntaxi.se">info@avenyntaxi.se</a></footer>
 </div>}
