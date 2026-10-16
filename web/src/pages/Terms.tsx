import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AGENCY, PASS, company, genesis, isTestnet } from "../config";
import { EUR, maxRevenueMicro } from "../../../shared/genesis.js";
import { euro } from "../lib/format";
import { useT } from "../i18n";

function ladder(sep: string) {
  let from = 1;
  return PASS.prijsladder
    .map((t) => {
      const line = `#${String(from).padStart(3, "0")}–#${String(t.tot).padStart(3, "0")}: ${euro(t.prijsEur * EUR, { whole: true })}`;
      from = t.tot + 1;
      return line;
    })
    .join(sep);
}

type Section = { title: string; body: ReactNode };

const T: Record<"en" | "nl", { title: string; sub: string; draft: string; testnet: string; missing: string; sections: () => Section[] }> = {
  en: {
    title: "Terms.",
    sub: "In plain language. What you buy, what you get, and what happens if things change.",
    draft: "Draft.",
    testnet: " On devnet there are no sales: you pay with test euros without value and get no real subscription.",
    missing: "published before sales start",
    sections: () => [
      { title: "1. Who sells", body: <p>{company.vennootschap ?? company.merk}, {company.adres ?? T.en.missing}{company.ondernemingsnummer ? `, company number ${company.ondernemingsnummer}` : ""}. Contact: {company.privacyEmail ?? T.en.missing}.</p> },
      {
        title: "2. What you buy",
        body: (
          <>
            <ul>
              <li><b>{PASS.naam}:</b> lifetime access to Marketing Scan Pro for {PASS.websites} website. There are {PASS.max}, numbered #001 to #{PASS.max}.</li>
              <li><b>{AGENCY.naam}:</b> lifetime access to Marketing Scan Pro for up to {AGENCY.websites} websites. There are {AGENCY.max}, numbered #01 to #{AGENCY.max}.</li>
              <li><b>{genesis.steun.naam}:</b> a voluntary contribution from €{genesis.steun.minimumEur}, without a subscription. You get a supporter badge in your wallet.</li>
            </ul>
            <p>Pro includes everything in the Marketing Scan Pro plan, including features added later, such as the SEO suite, email marketing and social posting. A pass is a subscription paid upfront. It is not an investment.</p>
          </>
        ),
      },
      { title: "3. What “lifetime” means", body: <p>For as long as Marketing Scan exists as a service, you pay no subscription fee for Pro. Lifetime refers to the life of the service, not of a person or company. A pass belongs to one business; for more businesses you need more passes or a {AGENCY.naam}.</p> },
      { title: "4. Fair use", body: <p>Pro is meant for normal use by your own business (or, with {AGENCY.naam}, for your clients). Reselling access or querying the service automatically at scale is not included. In case of abuse we contact you first; only then may we limit access.</p> },
      {
        title: "5. Not an investment",
        body: (
          <ul>
            <li>You get no share in the company, no right to profit, no dividend and no voting rights in the company.</li>
            <li>Your pass is soulbound: it can’t leave your wallet and can’t be resold. It has no trading value.</li>
            <li>Voting on the order of the roadmap is advice to the founder, not control.</li>
          </ul>
        ),
      },
      {
        title: "6. Price and payment",
        body: (
          <>
            <p>The price of a {PASS.naam} depends on its number: {ladder("; ")}. A {AGENCY.naam} costs {euro(AGENCY.prijsladder[0].prijsEur * EUR, { whole: true })}. All prices are final prices. All passes together raise at most {euro(maxRevenueMicro(PASS) + maxRevenueMicro(AGENCY), { whole: true })}.</p>
            <p>You pay in euro stablecoin (EURC) on Solana. Your number is fixed only once your transaction is confirmed. If someone beats you to it, your transaction fails without any payment, and you get the next free number.</p>
          </>
        ),
      },
      { title: `7. Refund within ${genesis.bedenktijdDagen} days`, body: <p>Within {genesis.bedenktijdDagen} days of your purchase you can request a refund in My pass, without giving a reason and also as a business. In one transaction your pass is burned and you get the full amount back in your wallet. A refunded number is not sold again. Support is a gift and is not refunded.</p> },
      { title: "8. Activation", body: <p>You activate your pass with a free signature in your wallet (not a transaction). You get an activation code to enter in Marketing Scan. Pro is then tied to your Marketing Scan account. One pass can belong to one account at a time.</p> },
      { title: "9. Your wallet", body: <p>You are responsible for your wallet and your secret phrase. We never ask for it. If you lose your wallet after activating, Pro stays tied to your account. We can’t recover or reissue a pass itself.</p> },
      { title: "10. If Marketing Scan stops", body: <p>If Marketing Scan ever shuts down, we’ll announce it at least 6 months in advance and you can export all your data.</p> },
      { title: "11. Liability", body: <p>We do our best to keep Marketing Scan good and available, but we don’t promise uninterrupted service. Our liability is limited to the amount you paid for your pass. This limit does not apply in case of fraud, intent or gross negligence, nor where the law forbids it. Your statutory consumer rights always apply.</p> },
      { title: "12. Privacy and governing law", body: <p>How we handle your data is in the <Link to="/privacy">privacy statement</Link>. These terms are governed by Belgian law.</p> },
    ],
  },
  nl: {
    title: "Voorwaarden.",
    sub: "In gewone taal. Wat je koopt, wat je krijgt en wat er gebeurt als het anders loopt.",
    draft: "Concept.",
    testnet: " Op het testnet is er geen verkoop: je betaalt met test-euro zonder waarde en krijgt geen echt abonnement.",
    missing: "wordt aangevuld vóór de start van de verkoop",
    sections: () => [
      { title: "1. Wie verkoopt", body: <p>{company.vennootschap ?? company.merk}, {company.adres ?? T.nl.missing}{company.ondernemingsnummer ? `, ondernemingsnummer ${company.ondernemingsnummer}` : ""}. Contact: {company.privacyEmail ?? T.nl.missing}.</p> },
      {
        title: "2. Wat je koopt",
        body: (
          <>
            <ul>
              <li><b>{PASS.naam}:</b> levenslang toegang tot Marketing Scan Pro voor {PASS.websites} website. Er zijn er {PASS.max}, genummerd van #001 tot #{PASS.max}.</li>
              <li><b>{AGENCY.naam}:</b> levenslang toegang tot Marketing Scan Pro voor tot {AGENCY.websites} websites. Er zijn er {AGENCY.max}, genummerd van #01 tot #{AGENCY.max}.</li>
              <li><b>{genesis.steun.naam}:</b> een vrijwillige bijdrage vanaf €{genesis.steun.minimumEur}, zonder abonnement. Je krijgt een supporter-badge in je wallet.</li>
            </ul>
            <p>Pro omvat alles wat in het Pro-abonnement van Marketing Scan zit, ook functies die er later bijkomen, zoals de SEO-suite, e-mailmarketing en social posting. Een pass is een abonnement, vooraf betaald. Het is geen investering.</p>
          </>
        ),
      },
      { title: "3. Wat “levenslang” betekent", body: <p>Zolang Marketing Scan als dienst bestaat, betaal je geen abonnementsprijs voor Pro. Levenslang slaat op de levensduur van de dienst, niet op die van een persoon of bedrijf. Je pass hoort bij één bedrijf; voor meerdere bedrijven heb je meerdere passes of een {AGENCY.naam} nodig.</p> },
      { title: "4. Normaal gebruik", body: <p>Pro is bedoeld voor normaal gebruik door je eigen bedrijf (of, met {AGENCY.naam}, voor je klanten). Toegang doorverkopen of de dienst automatisch en massaal bevragen valt daar niet onder. Bij misbruik nemen we eerst contact op; pas daarna kunnen we de toegang beperken.</p> },
      {
        title: "5. Geen investering",
        body: (
          <ul>
            <li>Je krijgt geen aandeel in het bedrijf, geen recht op winst, geen dividend en geen stemrecht in de onderneming.</li>
            <li>Je pass is soulbound: hij kan je wallet niet verlaten en kan dus niet doorverkocht worden. Hij heeft geen handelswaarde.</li>
            <li>Mee stemmen over de volgorde van de roadmap is een advies aan de oprichter, geen zeggenschap.</li>
          </ul>
        ),
      },
      {
        title: "6. Prijs en betaling",
        body: (
          <>
            <p>De prijs van een {PASS.naam} hangt af van het nummer: {ladder("; ")}. Een {AGENCY.naam} kost {euro(AGENCY.prijsladder[0].prijsEur * EUR, { whole: true })}. Alle prijzen zijn eindprijzen. Samen brengen alle passes maximaal {euro(maxRevenueMicro(PASS) + maxRevenueMicro(AGENCY), { whole: true })} op.</p>
            <p>Je betaalt in euro-stablecoin (EURC) op Solana. Je nummer ligt pas vast als je transactie bevestigd is. Was iemand je net voor, dan mislukt je transactie zonder dat er iets betaald wordt, en krijg je het volgende vrije nummer.</p>
          </>
        ),
      },
      { title: `7. Geld terug binnen ${genesis.bedenktijdDagen} dagen`, body: <p>Binnen {genesis.bedenktijdDagen} dagen na je aankoop kan je je geld terugvragen bij Mijn pass, zonder reden en ook als je een bedrijf bent. In één transactie wordt je pass verbrand en krijg je het volledige bedrag terug in je wallet. Een teruggegeven nummer wordt niet opnieuw verkocht. Steun is een gift en wordt niet terugbetaald.</p> },
      { title: "8. Activeren", body: <p>Je activeert je pass met een gratis handtekening in je wallet (geen transactie). Je krijgt een activatiecode die je in Marketing Scan invult. Daarna hangt Pro aan je Marketing Scan-account. Eén pass hoort bij één account tegelijk.</p> },
      { title: "9. Je wallet", body: <p>Je bent zelf verantwoordelijk voor je wallet en je geheime zin. Wij vragen die nooit. Ben je je wallet kwijt nadat je pass geactiveerd is, dan blijft Pro aan je account hangen. Een pass zelf kunnen we niet terughalen of opnieuw uitgeven.</p> },
      { title: "10. Als Marketing Scan stopt", body: <p>Stopt Marketing Scan ooit, dan laten we dat minstens 6 maanden vooraf weten en kan je al je gegevens exporteren.</p> },
      { title: "11. Aansprakelijkheid", body: <p>We doen ons best om Marketing Scan goed en beschikbaar te houden, maar beloven geen ononderbroken werking. Onze aansprakelijkheid is beperkt tot het bedrag dat je voor je pass betaalde. Die beperking geldt niet bij bedrog, opzet of zware fout, en niet waar de wet ze verbiedt. Je wettelijke rechten als consument blijven altijd gelden.</p> },
      { title: "12. Privacy en toepasselijk recht", body: <p>Hoe we met je gegevens omgaan, lees je in de <Link to="/privacy">privacyverklaring</Link>. Op deze voorwaarden is Belgisch recht van toepassing.</p> },
    ],
  },
};

export default function Terms() {
  const t = useT(T);
  return (
    <>
      <header className="page-head">
        <div className="container">
          <h1>{t.title}</h1>
          <p>{t.sub}</p>
        </div>
      </header>
      <div className="container page">
        <article className="prose">
          <p className="notice"><strong>{t.draft}</strong>{isTestnet ? t.testnet : ""}</p>
          {t.sections().map((s) => (
            <section key={s.title} style={{ display: "grid", gap: 14 }}>
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
