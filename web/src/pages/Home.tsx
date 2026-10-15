import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { activeRound, deployment, isTestnet, metrics, offering } from "../config";
import { EUR, percentOfCompany } from "../../../shared/offering.js";
import { useNow, useOfferingState } from "../lib/hooks";
import { ago, count, euro, price } from "../lib/format";
import { explorerAddress } from "../lib/explorer";
import { joinWaitlist, ApiError } from "../lib/api";
import { Check, Progress, ScanLines, StatusPill, Value } from "../components/ui";

const TOTAL = offering.token.totaal;

function useRoundNumbers() {
  const state = useOfferingState();
  const vault = state.data?.vaults[activeRound.id] ?? null;
  const sold = vault ? activeRound.tokens - Number(vault.amount) : 0;
  return {
    state,
    sold,
    raisedMicro: sold * activeRound.prijsPerTokenMicro,
    capMicro: activeRound.tokens * activeRound.prijsPerTokenMicro,
    loading: Boolean(deployment) && !state.data,
  };
}

function LiveRoundCard() {
  const { state, sold, raisedMicro, capMicro, loading } = useRoundNumbers();
  useNow();
  const goalMicro = (activeRound.minimumdoelEur ?? 0) * EUR;
  return (
    <aside className="live-card" aria-label={`${activeRound.naam} live`}>
      <div className="live-head">
        <div className="live-title">
          <strong>{activeRound.naam} · {activeRound.label}</strong>
          <span>{percentOfCompany(activeRound.tokens, TOTAL)}% van Marketing Scan</span>
        </div>
        <span className="live-dot">{deployment ? "live van Solana" : "binnenkort live"}</span>
      </div>
      <div className="live-price">
        <b>{price(activeRound.prijsPerTokenMicro)}</b>
        <span>per aandeel · €1 = {count(Math.floor(EUR / activeRound.prijsPerTokenMicro))} aandelen</span>
      </div>
      <Progress
        value={raisedMicro}
        max={capMicro}
        goal={goalMicro}
        labels={[
          <Value key="a" loading={loading}>{euro(raisedMicro)} opgehaald</Value>,
          <span key="b">doel {euro(goalMicro, { whole: true })} · max {euro(capMicro, { whole: true })}</span>,
        ]}
      />
      <dl className="live-grid">
        <div>
          <dt>Verkocht</dt>
          <dd><Value loading={loading}>{count(sold)}</Value></dd>
        </div>
        <div>
          <dt>Investeerders</dt>
          <dd><Value loading={loading}>{state.data?.investors ?? "-"}</Value></dd>
        </div>
        <div>
          <dt>Waardering</dt>
          <dd>{euro(activeRound.prijsPerTokenMicro * TOTAL, { whole: true })}</dd>
        </div>
        <div>
          <dt>Instap</dt>
          <dd>vanaf €{activeRound.minimumEur}</dd>
        </div>
      </dl>
      <div className="live-foot">
        <span>{state.updatedAt ? `Bijgewerkt ${ago(state.updatedAt)}` : deployment ? "Gegevens laden..." : "Demo nog niet geactiveerd"}</span>
        {deployment && <a href={explorerAddress(deployment.vaults[activeRound.id])} target="_blank" rel="noreferrer">Bekijk de kluis op Solana</a>}
      </div>
    </aside>
  );
}

function Hero() {
  return (
    <section className="hero">
      <ScanLines />
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="kicker"><span className="pill">{isTestnet ? "testnet-demo" : "open"}</span> Community-ronde</p>
          <h1>Word <em>mede-eigenaar</em> van Marketing Scan.</h1>
          <p className="lead">
            Vanaf €1 bezit je een stukje van het bedrijf achter de marketingscan voor kmo's. Je aandelen staan als token in je eigen wallet, en elke euro is live te volgen op de blockchain.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-large btn-light" to="/investeren">Investeer vanaf €1</Link>
            <Link className="btn btn-large btn-ghost on-night" to="/transparantie">Controleer alles live</Link>
          </div>
          <ul className="hero-checks">
            <li>✓ Vaste voorraad: 100.000.000 aandelen</li>
            <li>✓ Oprichter 51% vergrendeld</li>
            <li>✓ Betalen en ontvangen in één transactie</li>
          </ul>
        </div>
        <LiveRoundCard />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section" id="hoe-het-werkt" aria-labelledby="h-werkt">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Hoe het werkt</p>
          <h2 id="h-werkt">In drie stappen mede-eigenaar</h2>
        </div>
        <ol className="steps">
          <li className="step">
            <h3>Log in met je wallet</h3>
            <p>Phantom, Solflare of Backpack. Je wallet is je login en je kluis: niemand anders heeft je sleutels.</p>
          </li>
          <li className="step">
            <h3>Kies je bedrag</h3>
            <p>Vanaf €1. Je ziet meteen hoeveel aandelen je krijgt en welk deel van Marketing Scan dat is. Betalen gebeurt in euro-stablecoin.</p>
          </li>
          <li className="step">
            <h3>Bevestig in je wallet</h3>
            <p>Je betaling en je aandelen gaan in één transactie. Lukt één deel niet, dan gebeurt er niets. Je deel zie je meteen in je portefeuille.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

function Allocation() {
  const { sold } = useRoundNumbers();
  const a = offering.allocaties;
  const r1Open = a["ronde-1"] - sold;
  const seg = (n: number) => ({ flexGrow: n, flexBasis: 0 });
  return (
    <section className="section section-band" id="rondes" aria-labelledby="h-rondes">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">De verdeling</p>
          <h2 id="h-rondes">51% blijft bij de oprichter, 49% voor de community</h2>
          <p className="section-lead">Er bestaan exact 100.000.000 aandelen, en dat blijft zo: het recht om er bij te maken is op de blockchain definitief ingetrokken. De community kan in twee rondes instappen.</p>
        </div>
        <figure className="split" style={{ margin: "0 0 2rem" }}>
          <div className="split-bar" role="img" aria-label={`Oprichter 51%, ronde 1 ${percentOfCompany(a["ronde-1"], TOTAL)}%, ronde 2 ${percentOfCompany(a["ronde-2"], TOTAL)}%`}>
            <span className="seg-founder" style={seg(a.oprichter)} />
            {sold > 0 && <span className="seg-sold" style={seg(sold)} />}
            <span className="seg-open" style={seg(r1Open)} />
            <span className="seg-reserve" style={seg(a["ronde-2"])} />
          </div>
          <ul className="legend">
            <li><i className="key seg-founder" />Oprichter 51% (vergrendeld)</li>
            <li><i className="key seg-sold" />Ronde 1 verkocht: {count(sold)}</li>
            <li><i className="key seg-open" />Ronde 1 beschikbaar: {count(r1Open)}</li>
            <li><i className="key seg-reserve" />Ronde 2: 40%</li>
          </ul>
        </figure>
        <div className="rounds">
          {offering.rondes.map((r) => (
            <article key={r.id} className={`round${r.status === "open" ? " is-open" : ""}`}>
              <div className="round-head">
                <p>{r.naam} · {r.label}</p>
                <StatusPill status={r.status} />
              </div>
              <span className="round-pct">{percentOfCompany(r.tokens, TOTAL)}%</span>
              <dl>
                <div><dt>Prijs per aandeel</dt><dd>{price(r.prijsPerTokenMicro)}</dd></div>
                <div><dt>Maximum op te halen</dt><dd>{euro(r.tokens * r.prijsPerTokenMicro, { whole: true })}</dd></div>
                <div><dt>Waardering</dt><dd>{euro(r.prijsPerTokenMicro * TOTAL, { whole: true })}</dd></div>
                <div><dt>Voor €1 krijg je</dt><dd>{count(Math.floor(EUR / r.prijsPerTokenMicro))} aandelen</dd></div>
                <div><dt>Minimumdoel</dt><dd>{r.minimumdoelEur ? euro(r.minimumdoelEur * EUR, { whole: true }) : "nog te bepalen"}</dd></div>
                <div><dt>Max per persoon</dt><dd>{r.maxPerPersoonEur ? euro(r.maxPerPersoonEur * EUR, { whole: true }) : "geen"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="fineprint">
          Ronde 2 opent pas als de mijlpalen van ronde 1 gehaald en publiek gerapporteerd zijn. De prijzen zijn voorstellen: een onafhankelijke waardering bevestigt ze vóór de echte start.
        </p>
      </div>
    </section>
  );
}

const ICONS = {
  scan: <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 12h10" />,
  seo: <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21M7.5 12.5l2-2 2 2 3-3" />,
  mail: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3.5 6l8.5 7 8.5-7" />,
  social: <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 14l2 2 4-4" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className="feature-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name]}
      </svg>
    </span>
  );
}

function Product() {
  return (
    <section className="section" id="product" aria-labelledby="h-product">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Wat we bouwen met jouw inleg</p>
          <h2 id="h-product">Eén plek voor de online marketing van elke kmo</h2>
          <p className="section-lead">Vandaag analyseert Marketing Scan je zichtbaarheid. Met de community-ronde bouwen we de tools om er ook iets aan te doen.</p>
        </div>
        <div className="features">
          <article className="feature">
            <Icon name="scan" />
            <h3>Marketingscan en SEO-analyse</h3>
            <p>Meer dan 30 controlepunten, je vindbaarheid in Google en in AI-assistenten, resultaat in 60 seconden.</p>
            <span className="status status-open">Live</span>
          </article>
          <article className="feature">
            <Icon name="seo" />
            <h3>Volledige SEO-suite</h3>
            <p>Zoekwoorden, posities, concurrenten en backlinks opvolgen, zoals Semrush, maar gemaakt voor kmo's.</p>
            <span className="status status-plan">Gepland</span>
          </article>
          <article className="feature">
            <Icon name="mail" />
            <h3>E-mailmarketing</h3>
            <p>Nieuwsbrieven en automatische mails naar je klanten, rechtstreeks vanuit je scanresultaten.</p>
            <span className="status status-plan">Gepland</span>
          </article>
          <article className="feature">
            <Icon name="social" />
            <h3>Social posting</h3>
            <p>Je posts plannen en publiceren op alle kanalen, met suggesties uit je eigen scan.</p>
            <span className="status status-plan">Gepland</span>
          </article>
        </div>
      </div>
    </section>
  );
}

function Honest() {
  const date = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(metrics.bijgewerkt));
  return (
    <section className="section section-band" aria-labelledby="h-eerlijk">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Eerlijk over waar we staan</p>
          <h2 id="h-eerlijk">We zijn vroeg. Daarom is de instap laag, en het risico hoog.</h2>
        </div>
        <div className="metrics">
          <div className="metric"><b>{count(metrics.wekelijkseGebruikers)}</b><span>wekelijkse gebruikers</span></div>
          <div className="metric"><b>{count(metrics.betalendeKlanten)}</b><span>betalende klanten</span></div>
          <div className="metric"><b>{euro(metrics.mrrEur * EUR, { whole: true })}</b><span>terugkerende omzet per maand</span></div>
        </div>
        <p className="fineprint">Bijgewerkt op {date}. We publiceren deze cijfers elk kwartaal, ook als ze tegenvallen.</p>
      </div>
    </section>
  );
}

function Trust() {
  const { state, loading } = useRoundNumbers();
  const s = state.data;
  const pending = !deployment || loading;
  return (
    <section className="section section-night" id="vertrouwen" aria-labelledby="h-trust">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Vertrouw ons niet. Controleer het.</p>
          <h2 id="h-trust">Live nagekeken op de blockchain, elke keer dat je deze pagina opent</h2>
        </div>
        <ul className="checks">
          <Check
            state={pending ? "wait" : s && s.supply === BigInt(TOTAL) ? "ok" : "bad"}
            title={`Er bestaan exact ${count(TOTAL)} aandelen`}
            link={deployment ? { href: explorerAddress(deployment.tokenMint), label: "Bekijk de token" } : undefined}
          >
            {s ? `Totale voorraad op de keten: ${count(s.supply)}.` : "Wordt gecontroleerd."}
          </Check>
          <Check
            state={pending ? "wait" : s && s.mintAuthority === null ? "ok" : "bad"}
            title="Niemand kan er aandelen bij maken"
            link={deployment ? { href: explorerAddress(deployment.tokenMint), label: "Controleer het muntrecht" } : undefined}
          >
            Het muntrecht is definitief ingetrokken. Ook wij kunnen je deel niet verwateren buiten de aangekondigde rondes.
          </Check>
          <Check
            state={pending ? "wait" : s?.founder?.frozen && s.founder.amount === BigInt(offering.allocaties.oprichter) ? "ok" : "bad"}
            title="De 51% van de oprichter zit vast"
            link={deployment ? { href: explorerAddress(deployment.founderTokenAccount), label: "Bekijk de oprichterswallet" } : undefined}
          >
            {count(offering.allocaties.oprichter)} aandelen in de wallet van de oprichter, vergrendeld. Verkopen kan niet zonder publieke procedure.
          </Check>
          <Check
            state={pending ? "wait" : "ok"}
            title="Jouw geld gaat naar een escrow, niet naar een persoon"
            link={deployment ? { href: explorerAddress(deployment.escrow), label: "Bekijk de escrow" } : undefined}
          >
            {s ? `Nu in escrow: ${euro(s.escrowMicro)}. ` : ""}Wordt het minimumdoel niet gehaald, dan krijgt iedereen de volledige inleg terug.
          </Check>
        </ul>
        <p className="fineprint" style={{ color: "var(--on-night-muted)" }}>
          <Link to="/transparantie" style={{ color: "var(--on-night)" }}>Alle adressen, aankopen en controles op de transparantiepagina</Link>
        </p>
      </div>
    </section>
  );
}

function Risks() {
  return (
    <section className="section" id="risicos" aria-labelledby="h-risico">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Risico's</p>
          <h2 id="h-risico">Lees dit voor je instapt</h2>
        </div>
        <ul className="risks">
          <li><h3>Je kan je volledige inleg verliezen</h3><p>Marketing Scan is een jong bedrijf zonder betalende klanten. Als het mislukt, zijn je aandelen niets waard.</p></li>
          <li><h3>Je geld zit lang vast</h3><p>Er komt geen notering op een beurs of crypto-platform. Verkopen kan enkel via een gecontroleerde procedure.</p></li>
          <li><h3>Uitkeringen zijn niet zeker</h3><p>Uitkeringen in crypto komen er enkel als er winst is en die wordt uitgekeerd. Reken er niet op.</p></li>
          <li><h3>De waardering is ambitieus</h3><p>De prijs per aandeel is een voorstel, geen marktprijs. Een onafhankelijke waardering kan lager uitvallen.</p></li>
          <li><h3>Beperkte zeggenschap</h3><p>De oprichter houdt 51% en neemt de beslissingen.</p></li>
          <li><h3>Nog geen vennootschap</h3><p>Marketing Scan wordt eerst een BV. Tot dan is dit een demo zonder echte aandelen.</p></li>
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="section section-band" id="vragen" aria-labelledby="h-vragen">
      <div className="container narrow">
        <div className="section-head">
          <p className="eyebrow">Vragen</p>
          <h2 id="h-vragen">Veelgestelde vragen</h2>
        </div>
        <div className="faq">
          <details><summary>Wat koop ik precies?</summary><p>Per aandeel krijg je één token in je wallet. Er bestaan er 100.000.000, dus 1 token is 0,000001% van Marketing Scan. Vóór de echte ronde wordt Marketing Scan een BV en leggen we juridisch vast welke rechten bij een token horen. Tot dan is dit een demo op het testnet.</p></details>
          <details><summary>Wat heb ik nodig?</summary><p>Een Solana-wallet zoals Phantom of Solflare. Betalen gebeurt in een euro-stablecoin (EURC). In de demo krijg je gratis test-euro, en de transactiekosten betalen wij.</p></details>
          <details><summary>Waar zie ik wat mijn deel waard is?</summary><p>In je portefeuille: je aantal aandelen, je percentage van het bedrijf en de waarde volgens de prijs van de laatste ronde, met de bron erbij. Dat is geen verkoopprijs.</p></details>
          <details><summary>Kan ik mijn aandelen verkopen?</summary><p>Niet vrij. Je aandelen zijn vergrendeld in je wallet, zodat ze niet op speculatieve markten belanden. Een overdracht aan een andere geverifieerde investeerder kan via een gecontroleerde procedure.</p></details>
          <details><summary>Wat als het minimumdoel niet gehaald wordt?</summary><p>Je inleg staat in een publiek zichtbare escrow. Wordt het minimumdoel van ronde 1 niet gehaald, dan krijgt iedereen alles terug.</p></details>
          <details><summary>Krijg ik uitkeringen in crypto?</summary><p>Als er winst is en we keren uit, dan rechtstreeks naar je wallet in een euro-stablecoin, in verhouding tot je aandelen. Elke uitkering is publiek na te kijken.</p></details>
          <details><summary>Wat als ik mijn wallet verlies?</summary><p>Dan ben je je aandelen niet kwijt. Een aparte herstelsleutel, die offline bewaard wordt, kan je aandelen na een identiteitscontrole naar een nieuwe wallet overzetten. Elke inzet daarvan is publiek zichtbaar.</p></details>
          <details><summary>Is dit gereguleerd?</summary><p>Een aanbieding van aandelen valt onder de regels van de FSMA. Daarom is dit nu een demo. De echte ronde start pas met een vennootschap en de juiste documenten.</p></details>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<{ kind: "" | "ok" | "err"; text: string }>({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setStatus({ kind: "err", text: "Vul een geldig e-mailadres in." });
    if (!consent) return setStatus({ kind: "err", text: "Vink aan dat je e-mails over de ronde wil ontvangen." });
    setBusy(true);
    try {
      await joinWaitlist(email.trim());
      setStatus({ kind: "ok", text: "Je staat op de lijst. We mailen je bij de start van de echte ronde." });
      setEmail("");
      setConsent(false);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setStatus({ kind: "err", text: status === 503 ? "De wachtlijst is nog niet geactiveerd. Probeer het binnenkort opnieuw." : "Inschrijven lukte niet. Probeer later opnieuw." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section cta-band on-night" aria-labelledby="h-cta">
      <div className="container cta-grid">
        <div style={{ display: "grid", gap: "1rem" }}>
          <h2 id="h-cta">Probeer het nu, zonder risico</h2>
          <p>Op het testnet doorloop je alles zoals het straks echt werkt: inloggen, test-euro ontvangen, investeren vanaf €1 en je deel zien in je portefeuille.</p>
          <div className="hero-ctas">
            <Link className="btn btn-large btn-light" to="/investeren">Start de demo</Link>
          </div>
        </div>
        <form className="waitlist" onSubmit={submit} noValidate>
          <h3>Verwittig me bij de echte ronde</h3>
          <label className="sr-only" htmlFor="wl-email">E-mailadres</label>
          <div className="waitlist-row">
            <input id="wl-email" className="input" type="email" autoComplete="email" placeholder="jij@bedrijf.be" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" type="submit" disabled={busy}>{busy ? "Even geduld..." : "Op de lijst"}</button>
          </div>
          <label className="consent" htmlFor="wl-consent">
            <input id="wl-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Ik wil e-mails over de community-ronde ontvangen. Uitschrijven kan altijd. <Link to="/privacy">Privacy</Link></span>
          </label>
          <p className={`form-status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>
        </form>
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Allocation />
      <Product />
      <Honest />
      <Trust />
      <Risks />
      <Faq />
      <Cta />
    </>
  );
}

