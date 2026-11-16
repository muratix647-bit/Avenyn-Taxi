import credits from "@/public/welcome/credits.json";
export const metadata = { title: "Foto och film – Avenyn Taxi", robots: { index: false, follow: true } };
export default function WelcomeCredits() {
  return <main style={{maxWidth:800,margin:"40px auto",padding:24,lineHeight:1.7}}>
    <a href="/valkommen">← Till välkomstfilmen</a><h1>Foto och film</h1>
    <section id="bakgrundsfilm"><h2>Hemsidans bakgrundsfilm</h2>
    <p>Göteborg och västkusten: filmklipp från Pexels och Christian Åkerlund (CC0). <a href="/gothenburg-westcoast-cinema-sources.txt">Fullständig källförteckning</a>.</p>
    <p>Liseberg: ”Rabalder, Liseberg full ride”, Albin Olsson, filmat 2012. <a href="https://commons.wikimedia.org/wiki/File:Rabalder,_Liseberg_full_ride.ogv">Original</a>. Det separata bearbetade Lisebergsklippet delas under <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>. Ändringar: utdrag, beskärning, färgjustering, utan ljud, MP4. <a href="/liseberg-rabalder-background.mp4">Ladda ned bearbetat klipp</a>. Upphovspersonen och Liseberg är inte knutna till Avenyn Taxi.</p></section>
    <h2>Välkomstfilmens bilder</h2><p>Platsbilderna från Göteborg, Västkusten och Borås är ett montage av fotografier med animerad kamerarörelse. Flygplatsscenen är ett separat filmklipp med två passagerarflygplan. Den visar inte Landvetter.</p>
    <p>Varje bearbetat foto och motsvarande videosegment tillhandahålls under licensen som anges nedan. Varumärket Avenyn Taxi och webbplatsens övriga innehåll omfattas inte av dessa medielicenser. Upphovspersonerna och flygbolagen är inte knutna till Avenyn Taxi.</p>
    <ul>{credits.map(item => <li key={item.scene} style={{marginBottom:24}}><strong>{({avenyn:"Avenyn",liseberg:"Liseberg – Valkyria",centralen:"Centralstationen",karlatornet:"Karlatornet",planes:"Två passagerarflygplan",marstrand:"Marstrand",orust:"Orust",kladesholmen:"Klädesholmen",tjorn:"Tjörn",henan:"Henån",smogen:"Smögen",kungsbacka:"Kungsbacka",asa:"Åsa",vastkusten:"Västkusten",boras:"Borås"} as Record<string,string>)[item.scene]}</strong><br/>
      {item.author} · <a href={item.source}>Original och upphovsperson</a> · <a href={item.licenseUrl}>{item.license}</a><br/>
      <span>{item.changes}</span><br/><a href={`/welcome/${item.scene}.mp4`}>Visa videosegment</a></li>)}</ul>
  </main>;
}
