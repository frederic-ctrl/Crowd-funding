import { company } from "../config";
import { useT } from "../i18n";

const T = {
  en: {
    title: "Privacy.",
    sub: "What we keep, why, and what stays on the blockchain.",
    missing: "published before sales start",
    who: "Who is responsible?",
    whoText: (m: string) => `${company.vennootschap ?? company.merk}, ${company.adres ?? m}${company.ondernemingsnummer ? `, company number ${company.ondernemingsnummer}` : ""}. Questions about your data: ${company.privacyEmail ?? m}.`,
    chain: "Wallet and blockchain",
    chainText: "You sign in with your wallet. We only see your public wallet address, never your secret phrase. Everything on the blockchain is public and stays there forever: your pass, your payment, your support and the public name you choose for the Genesis wall. So don’t pick a name you’d rather not see later. Leave the field empty and we show only your wallet address.",
    chainHide: "On request we stop showing your name on this website. Nobody can remove it from the blockchain itself.",
    activate: "Activation",
    activateText: "When you activate your pass, you sign a message with your wallet. We store which pass belongs to which Marketing Scan account, so you get Pro.",
    list: "Waiting list",
    listItems: [
      "We store your email address, your language and the time of your consent.",
      "We only use it to email you about Marketing Scan Genesis.",
      "Legal basis: your consent. You can withdraw it anytime through the link in every email.",
      "We keep your data until 12 months after Genesis ends, or shorter if you unsubscribe.",
    ],
    rights: "Your rights",
    rightsText: "You can access, correct or delete your data, and object. If you’re not satisfied, you can file a complaint with the Belgian Data Protection Authority (www.dataprotectionauthority.be).",
  },
  nl: {
    title: "Privacy.",
    sub: "Wat we bewaren, waarom, en wat op de blockchain blijft.",
    missing: "wordt aangevuld vóór de start van de verkoop",
    who: "Wie is verantwoordelijk?",
    whoText: (m: string) => `${company.vennootschap ?? company.merk}, ${company.adres ?? m}${company.ondernemingsnummer ? `, ondernemingsnummer ${company.ondernemingsnummer}` : ""}. Vragen over je gegevens: ${company.privacyEmail ?? m}.`,
    chain: "Wallet en blockchain",
    chainText: "Inloggen gebeurt met je wallet. We zien enkel je publieke walletadres, nooit je geheime zin. Alles op de blockchain is publiek en blijft daar voor altijd: je pass, je betaling, je steun en de publieke naam die je zelf kiest voor de Genesis-muur. Kies dus geen naam die je later liever niet meer ziet. Laat je het veld leeg, dan tonen we enkel je walletadres.",
    chainHide: "Op verzoek tonen we je naam niet meer op deze website. Van de blockchain zelf kan niemand hem verwijderen.",
    activate: "Activeren",
    activateText: "Als je je pass activeert, onderteken je een tekst met je wallet. We bewaren welke pass bij welk Marketing Scan-account hoort, zodat je Pro krijgt.",
    list: "Wachtlijst",
    listItems: [
      "We bewaren je e-mailadres, je taal en het tijdstip van je toestemming.",
      "We gebruiken die enkel om je te mailen over Marketing Scan Genesis.",
      "Rechtsgrond: je toestemming. Je kan die altijd intrekken via de link in elke e-mail.",
      "We bewaren je gegevens tot 12 maanden na het einde van Genesis, of korter als je je uitschrijft.",
    ],
    rights: "Je rechten",
    rightsText: "Je kan je gegevens inkijken, laten verbeteren of laten wissen, en bezwaar maken. Ben je niet tevreden, dan kan je klacht indienen bij de Gegevensbeschermingsautoriteit (www.gegevensbeschermingsautoriteit.be).",
  },
};

export default function Privacy() {
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
          <h2>{t.who}</h2>
          <p>{t.whoText(t.missing)}</p>
          <h2>{t.chain}</h2>
          <p>{t.chainText}</p>
          <p>{t.chainHide}</p>
          <h2>{t.activate}</h2>
          <p>{t.activateText}</p>
          <h2>{t.list}</h2>
          <ul>{t.listItems.map((x) => <li key={x}>{x}</li>)}</ul>
          <h2>{t.rights}</h2>
          <p>{t.rightsText}</p>
        </article>
      </div>
    </>
  );
}
