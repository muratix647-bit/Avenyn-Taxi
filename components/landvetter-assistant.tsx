"use client";
import { Plane } from "lucide-react";
import styles from "./landvetter-assistant.module.css";
export function LandvetterBookingAssistant({direction, flight, onDirection, onFlight}: {
  direction: "to" | "from" | null; flight: string; onDirection: (direction:"to"|"from")=>void; onFlight:(value:string)=>void;
}) {
  return <details className={styles.card}>
    <summary className={styles.heading}><Plane aria-hidden="true" />Landvetter-assistenten · planera din resa</summary>
    <p className={styles.intro}>Från bokningen till mötet med din förare.</p>
    <div className={styles.actions}>
      <button type="button" aria-pressed={direction==="from"} onClick={()=>onDirection("from")}>Hämta mig vid flyget</button>
      <button type="button" aria-pressed={direction==="to"} onClick={()=>onDirection("to")}>Jag ska till flyget</button>
    </div>
    {direction && <>
      <label className={styles.field}>{direction==="from" ? "Ditt ankommande flygnummer" : "Ditt avgående flygnummer"}
        <input value={flight} maxLength={12} onChange={event=>onFlight(event.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g,""))} placeholder="Exempel: SK123" autoCapitalize="characters" spellCheck={false} />
      </label>
      <p className={styles.hint}>Flygnumret följer med bokningen. Tillgänglig flygstatus visas i Mina resor efter bokning.</p>
      <ol className={styles.steps}>
        <li>{direction==="from" ? "Fyll i destination, datum och önskad hämtningstid i bokningen nedanför. Räkna med tid för bagage." : "Fyll i hämtadress, datum och hämtningstid. Följ flygbolagets råd om när du ska vara på flygplatsen och lägg till restid och marginal."}</li>
        <li>Välj passagerare, bagage och eventuell barnstol. Kontrollera priset före bekräftelse.</li>
        <li>{direction==="from" ? "Efter landning: hämta bagaget och kontakta föraren för att bekräfta mötesplatsen." : "Följ bilen och kontakta din tilldelade förare från resans sida."}</li>
      </ol>
      <p className={styles.hint}>Ändrad flygtid ändrar inte automatiskt din bokade hämtningstid. Kontrollera bokningen och kontakta oss vid behov.</p>
    </>}
  </details>;
}
export function LandvetterTripAssistant({pickup,destination,status,driverName,flight,onView}: {
  pickup:string;destination:string;status:string;driverName?:string;flight?:string;onView:(view:"map"|"flight"|"contact")=>void;
}) {
  const arrival=/landvetter|GOT airport/i.test(pickup||"");
  if (!arrival && !/landvetter|GOT airport/i.test(destination||"")) return null;
  if (["completed","cancelled"].includes(status)) return null;
  const instruction = status==="passenger_onboard" ? "Trevlig resa! Du kan följa resan på kartan." : status==="arrived" ? "Föraren har markerat sig framme. Kontrollera bilens uppgifter och kontakta föraren för att hitta varandra." : arrival ? "När du har hämtat bagaget: kontakta föraren för att bekräfta mötesplatsen. Följ instruktionerna från föraren." : "Var redo vid hämtadressen vid bokad tid. Kontrollera flygets information och följ flygbolagets råd.";
  return <section className={styles.card} aria-label="Din Landvetter-assistent">
    <div className={styles.eyebrow}>DIN LANDVETTER-ASSISTENT</div>
    <h2 className={styles.title}>{arrival ? "Välkommen till Göteborg" : "På väg till Landvetter"}</h2>
    <p className={styles.status}>{instruction}</p>
    <p className={styles.hint}>{driverName ? `Din förare: ${driverName}` : "Förarens uppgifter visas när en förare har tilldelats."}{flight ? ` · Flyg ${flight}` : ""}</p>
    <div className={styles.actions}><button type="button" onClick={()=>onView("flight")}>Mitt flyg</button><button type="button" onClick={()=>onView("map")}>Min taxi</button><button type="button" onClick={()=>onView("contact")}>Hitta föraren</button></div>
  </section>;
}
