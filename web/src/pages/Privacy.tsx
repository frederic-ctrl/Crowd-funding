import { company } from "../config";

const missing = "wordt aangevuld na de oprichting van de vennootschap";

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
            Inloggen gebeurt met je wallet. We krijgen enkel je publieke walletadres te zien, nooit je geheime zin. Alles wat op de blockchain staat, zoals je aandelen en aankopen, is publiek. Daar staan geen namen of e-mailadressen op.
          </p>
          <h2>Wachtlijst</h2>
          <ul>
            <li>We bewaren je e-mailadres, de taal en het tijdstip van je toestemming.</li>
            <li>We gebruiken die enkel om je te mailen over de community-ronde.</li>
            <li>Rechtsgrond: je toestemming. Je kan die altijd intrekken via de link in elke e-mail.</li>
            <li>We bewaren je gegevens tot 12 maanden na de laatste ronde, of korter als je je uitschrijft.</li>
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
