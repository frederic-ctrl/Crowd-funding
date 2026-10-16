// Directe steun: een gift in crypto rechtstreeks naar de wallet van de oprichter. Los van de
// Genesis-verkoop: geen pass, geen abonnement, geen terugbetaling. Adressen en ontvanger staan in
// shared/directe-steun.json; de site toont enkel geldige adressen (zie shared/directe-steun.js).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import qrcode from "qrcode-generator";
import { paymentUri } from "../../../shared/directe-steun.js";
import { gift, giftActive, giftAddresses, type GiftAddress } from "../config";
import { useT } from "../i18n";

const T = {
  en: {
    title: "Back the build.",
    sub: "Send crypto straight to the founder of Marketing Scan. A gift, with nothing in return.",
    off: "Direct gifts aren’t open yet.",
    accepts: (coins: string[]) => `Accepts ${coins.join(", ")}`,
    onlyOn: (coins: string[], network: string) => `Only send ${coins.join(", ")} on the ${network} network to this address. Coins sent on another network are lost.`,
    copy: "Copy address",
    copied: "Copied",
    scan: "Scan with your wallet",
    whatTitle: "What this is.",
    what: (who: string, mail: string) => [
      `A voluntary gift to ${who}, founder of Marketing Scan. It goes straight to their personal wallet.`,
      "You get nothing in return: no Genesis Pass, no subscription, no shares, no tokens and no refund.",
      "Not an investment. Gifts don’t earn anything and don’t give you any rights.",
      `Questions or a wrong transfer? Mail ${mail}.`,
    ],
    want: "Rather get lifetime Marketing Scan Pro for your support?",
    wantLink: "See the Genesis Pass",
  },
  nl: {
    title: "Steun de bouw.",
    sub: "Stuur crypto rechtstreeks naar de oprichter van Marketing Scan. Een gift, zonder iets terug.",
    off: "Directe steun is nog niet open.",
    accepts: (coins: string[]) => `Aanvaardt ${coins.join(", ")}`,
    onlyOn: (coins: string[], network: string) => `Stuur naar dit adres enkel ${coins.join(", ")} op het ${network}-netwerk. Munten op een ander netwerk ben je kwijt.`,
    copy: "Kopieer adres",
    copied: "Gekopieerd",
    scan: "Scan met je wallet",
    whatTitle: "Wat dit is.",
    what: (who: string, mail: string) => [
      `Een vrijwillige gift aan ${who}, oprichter van Marketing Scan. Ze gaat rechtstreeks naar diens persoonlijke wallet.`,
      "Je krijgt er niets voor terug: geen Genesis Pass, geen abonnement, geen aandelen, geen tokens en geen terugbetaling.",
      "Geen investering. Een gift levert niets op en geeft je geen rechten.",
      `Vragen of iets verkeerd gestuurd? Mail naar ${mail}.`,
    ],
    want: "Liever levenslang Marketing Scan Pro voor je steun?",
    wantLink: "Bekijk de Genesis Pass",
  },
};

/** QR-code als SVG, zonder externe diensten. */
function Qr({ value, label }: { value: string; label: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [value]);
  return (
    <svg className="qr" viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={path.n + 4} height={path.n + 4} fill="#fff" />
      <path d={path.d} fill="#1d1d1f" />
    </svg>
  );
}

function AddressCard({ a, t }: { a: GiftAddress; t: (typeof T)["en"] }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(a.adres);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* klembord niet beschikbaar: het adres blijft selecteerbaar */
    }
  }
  return (
    <article className="gift-card">
      <header>
        <h2>{a.netwerk}</h2>
        <span className="muted">{t.accepts(a.munten)}</span>
      </header>
      <Qr value={paymentUri(a.schema, a.adres)} label={`${t.scan}: ${a.adres}`} />
      <code className="gift-address">{a.adres}</code>
      <button type="button" className="btn btn-quiet" onClick={copy}>{copied ? t.copied : t.copy}</button>
      <p className="fine">{t.onlyOn(a.munten, a.netwerk)}</p>
    </article>
  );
}

export default function Gift() {
  const t = useT(T);
  return (
    <>
      <header className="page-head">
        <div className="container">
          <h1>{t.title}</h1>
          <p>{t.sub}</p>
        </div>
      </header>
      <div className="container wide page">
        {!giftActive ? (
          <p className="notice">{t.off}</p>
        ) : (
          <>
            <div className="gift-grid">
              {giftAddresses.map((a) => <AddressCard key={a.schema} a={a} t={t} />)}
            </div>
            <section className="gift-what" aria-labelledby="h-gift-what">
              <h2 id="h-gift-what">{t.whatTitle}</h2>
              <ul>{t.what(gift.ontvanger ?? "", gift.email ?? "").map((line) => <li key={line}>{line}</li>)}</ul>
            </section>
            <p className="center muted">{t.want} <Link to="/genesis">{t.wantLink}</Link></p>
          </>
        )}
      </div>
    </>
  );
}
