import { Link } from "react-router-dom";
import { AGENCY, PASS, company, genesis, isTestnet } from "../config";
import { EUR, maxRevenueMicro } from "../../../shared/genesis.js";
import { euro } from "../lib/format";

const missing = "wordt aangevuld vóór de start van de verkoop";

export default function Terms() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--pill)" }}>Voorwaarden</p>
          <h1>Voorwaarden van Marketing Scan Genesis</h1>
          <p>In gewone taal. Wat je koopt, wat je krijgt en wat er gebeurt als het anders loopt.</p>
        </div>
      </section>
      <div className="container page-body">
        <div className="prose">
          <p className="notice notice-info">
            <strong>Concept.</strong> Deze voorwaarden worden nagelezen vóór de echte verkoop start.{isTestnet ? " Op het testnet is er geen verkoop: je betaalt met test-euro zonder waarde en krijgt geen echt abonnement." : ""}
          </p>

          <h2>1. Wie verkoopt</h2>
          <p>
            {company.vennootschap ?? company.merk}, {company.adres ?? missing}
            {company.ondernemingsnummer ? `, ondernemingsnummer ${company.ondernemingsnummer}` : ""}. Contact: {company.privacyEmail ?? missing}.
          </p>

          <h2>2. Wat je koopt</h2>
          <ul>
            <li><b>{PASS.naam}:</b> levenslang toegang tot Marketing Scan Pro voor {PASS.websites} website. Er zijn er {PASS.max}, genummerd van #001 tot #{PASS.max}.</li>
            <li><b>{AGENCY.naam}:</b> levenslang toegang tot Marketing Scan Pro voor tot {AGENCY.websites} websites. Er zijn er {AGENCY.max}, genummerd van #01 tot #{AGENCY.max}.</li>
            <li><b>{genesis.steun.naam}:</b> een vrijwillige bijdrage vanaf €{genesis.steun.minimumEur}, zonder abonnement. Je krijgt een supporter-badge in je wallet.</li>
          </ul>
          <p>Pro omvat alles wat in het Pro-abonnement van Marketing Scan zit, ook functies die er later bijkomen, zoals de SEO-suite, e-mailmarketing en social posting. Een pass is een abonnement, vooraf betaald. Het is geen investering.</p>

          <h2>3. Wat "levenslang" betekent</h2>
          <p>Zolang Marketing Scan als dienst bestaat, betaal je geen abonnementsprijs voor Pro. Levenslang slaat op de levensduur van de dienst, niet op die van een persoon of bedrijf. Je pass hoort bij één bedrijf; voor meerdere bedrijven heb je meerdere passes of een {AGENCY.naam} nodig.</p>

          <h2>4. Normaal gebruik</h2>
          <p>Pro is bedoeld voor normaal gebruik door je eigen bedrijf (of, met {AGENCY.naam}, voor je klanten). Toegang doorverkopen of de dienst automatisch en massaal bevragen valt daar niet onder. Bij misbruik nemen we eerst contact op; pas daarna kunnen we de toegang beperken.</p>

          <h2>5. Geen investering</h2>
          <ul>
            <li>Je krijgt geen aandeel in het bedrijf, geen recht op winst, geen dividend en geen stemrecht in de onderneming.</li>
            <li>Je pass is soulbound: hij kan je wallet niet verlaten en kan dus niet doorverkocht worden. Hij heeft geen handelswaarde.</li>
            <li>Mee stemmen over de volgorde van de roadmap is een advies aan de oprichter, geen zeggenschap.</li>
          </ul>

          <h2>6. Prijs en betaling</h2>
          <p>
            De prijs van een {PASS.naam} hangt af van het nummer: {PASS.prijsladder.map((t, i) => `${i === 0 ? "#001" : `#${String(PASS.prijsladder[i - 1].tot + 1).padStart(3, "0")}`} tot #${String(t.tot).padStart(3, "0")}: ${euro(t.prijsEur * EUR, { whole: true })}`).join("; ")}. Een {AGENCY.naam} kost {euro(AGENCY.prijsladder[0].prijsEur * EUR, { whole: true })}. Alle prijzen zijn eindprijzen. Samen brengen alle passes maximaal {euro(maxRevenueMicro(PASS) + maxRevenueMicro(AGENCY), { whole: true })} op.
          </p>
          <p>Je betaalt in euro-stablecoin (EURC) op Solana. Je nummer ligt pas vast als je transactie bevestigd is. Was iemand je net voor, dan mislukt je transactie zonder dat er iets betaald wordt, en krijg je het volgende vrije nummer.</p>

          <h2>7. Geld terug binnen {genesis.bedenktijdDagen} dagen</h2>
          <p>Binnen {genesis.bedenktijdDagen} dagen na je aankoop kan je je geld terugvragen bij Mijn pass, zonder reden en ook als je een bedrijf bent. In één transactie wordt je pass verbrand en krijg je het volledige bedrag terug in je wallet. Een teruggegeven nummer wordt niet opnieuw verkocht. Steun is een gift en wordt niet terugbetaald.</p>

          <h2>8. Activeren</h2>
          <p>Je activeert je pass met een gratis handtekening in je wallet (geen transactie). Je krijgt een activatiecode die je in Marketing Scan invult. Daarna hangt Pro aan je Marketing Scan-account. Eén pass kan bij één account tegelijk horen.</p>

          <h2>9. Je wallet</h2>
          <p>Je bent zelf verantwoordelijk voor je wallet en je geheime zin. Wij vragen die nooit. Ben je je wallet kwijt nadat je pass geactiveerd is, dan blijft Pro aan je account hangen. Een pass zelf kunnen we niet terughalen of opnieuw uitgeven.</p>

          <h2>10. Als Marketing Scan stopt</h2>
          <p>Stopt Marketing Scan ooit, dan laten we dat minstens 6 maanden vooraf weten en kan je al je gegevens exporteren.</p>

          <h2>11. Aansprakelijkheid</h2>
          <p>We doen ons best om Marketing Scan goed en beschikbaar te houden, maar beloven geen ononderbroken werking. Onze aansprakelijkheid is beperkt tot het bedrag dat je voor je pass betaalde. Die beperking geldt niet bij bedrog, opzet of zware fout, en niet waar de wet ze verbiedt. Je wettelijke rechten als consument blijven altijd gelden.</p>

          <h2>12. Privacy en toepasselijk recht</h2>
          <p>Hoe we met je gegevens omgaan, lees je in de <Link to="/privacy">privacyverklaring</Link>. Op deze voorwaarden is Belgisch recht van toepassing.</p>
        </div>
      </div>
    </>
  );
}
