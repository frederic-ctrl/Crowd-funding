import { company } from "../config";

const missing = "wordt aangevuld vóór de start van de verkoop";

export default function Privacy() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--pill)" }}>Privacy</p>
          <h1>Hoe we met je gegevens omgaan</h1>
        </div>
      </section>
      <div className="container page-body">
        <div className="prose">
          <h2>Wie is verantwoordelijk?</h2>
          <p>
            {company.vennootschap ?? company.merk}, {company.adres ?? missing}
            {company.ondernemingsnummer ? `, ondernemingsnummer ${company.ondernemingsnummer}` : ""}. Vragen over je gegevens:{" "}
            {company.privacyEmail ?? missing}.
          </p>
          <h2>Wallet en blockchain</h2>
          <p>
            Inloggen gebeurt met je wallet. We krijgen enkel je publieke walletadres te zien, nooit je geheime zin. Alles wat op de blockchain staat is publiek en blijft daar voor altijd: je pass, je betaling, je steun en de publieke naam die je zelf kiest voor de Genesis-muur. Kies dus geen naam die je later liever niet meer ziet. Laat je het veld leeg, dan tonen we enkel je walletadres.
          </p>
          <p>Op verzoek tonen we je naam niet meer op deze website. Van de blockchain zelf kan niemand hem verwijderen.</p>
          <h2>Activeren</h2>
          <p>Als je je pass activeert, onderteken je een tekst met je wallet. We bewaren welke pass bij welk Marketing Scan-account hoort, zodat je Pro krijgt.</p>
          <h2>Wachtlijst</h2>
          <ul>
            <li>We bewaren je e-mailadres, de taal en het tijdstip van je toestemming.</li>
            <li>We gebruiken die enkel om je te mailen over Marketing Scan Genesis.</li>
            <li>Rechtsgrond: je toestemming. Je kan die altijd intrekken via de link in elke e-mail.</li>
            <li>We bewaren je gegevens tot 12 maanden na het einde van Genesis, of korter als je je uitschrijft.</li>
          </ul>
          <h2>Je rechten</h2>
          <p>
            Je kan je gegevens inkijken, laten verbeteren of laten wissen, en bezwaar maken. Ben je niet tevreden, dan kan je klacht indienen bij de Gegevensbeschermingsautoriteit (www.gegevensbeschermingsautoriteit.be).
          </p>
        </div>
      </div>
    </>
  );
}
