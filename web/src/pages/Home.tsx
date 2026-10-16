import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import { AGENCY, PASS, deployment, genesis, isTestnet, metrics } from "../config";
import { EUR, formatNumber, maxRevenueMicro } from "../../../shared/genesis.js";
import { useAsync, useGenesis, useNow } from "../lib/hooks";
import { ago, count, euro } from "../lib/format";
import { explorerAddress } from "../lib/explorer";
import { verifyPasses } from "../lib/chain";
import { joinWaitlist, ApiError, type GenesisState } from "../lib/api";
import { Check, Progress, ScanLines, Value } from "../components/ui";
import { Ladder, PassBack, PassCard, Wall, eventLabel, goalMicro, view } from "../components/genesis";
import { SpinningPass } from "../components/SpinningPass";

const claimLabel = isTestnet ? "Probeer het op het testnet" : "Claim je Genesis Pass";

function Hero({ s }: { s: GenesisState | null }) {
  const v = view(s);
  return (
    <section className="hero">
      <ScanLines />
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="kicker"><span className="pill">Genesis</span> {isTestnet ? "Voorverkoop · demo op het testnet" : "Voorverkoop · open"}</p>
          <h1>Levenslang Marketing Scan Pro. <em>Eén keer betalen.</em></h1>
          <p className="lead">
            Word een van de eerste 250 klanten. Je Genesis Pass staat genummerd in je eigen wallet en geeft je Pro voor altijd: elke nieuwe functie inbegrepen, ook de SEO-suite, mailings en social posting die we nu bouwen.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-large btn-light" to="/genesis">{claimLabel}</Link>
            <Link className="btn btn-large btn-ghost on-night" to="/transparantie">Controleer alles live</Link>
          </div>
          <ul className="hero-checks">
            <li>✓ Geen investering: je koopt je tool</li>
            <li>✓ 14 dagen geld terug, met één klik</li>
            <li>✓ Elke euro live op Solana</li>
          </ul>
        </div>
        <div className="hero-pass">
          <SpinningPass
            label={`Genesis Pass ${v.pass.next ? `#${String(v.pass.next).padStart(3, "0")}` : ""}, de volgende pass`}
            front={<PassCard variant="pass" number={v.pass.next ?? PASS.max} status="voorbeeld" footer={v.pass.price ? `Volgende pass: ${euro(v.pass.price, { whole: true })}` : "Uitverkocht"} />}
            back={<PassBack variant="pass" />}
          />
        </div>
      </div>
    </section>
  );
}

function LiveStrip({ s, loading, updatedAt }: { s: GenesisState | null; loading: boolean; updatedAt: number | null }) {
  useNow();
  const v = view(s);
  const raised = s?.opgehaaldMicro ?? 0;
  return (
    <section className="live-strip on-night" aria-label="Genesis live">
      <div className="container live-strip-inner">
        <div className="live-goal">
          <div className="live-goal-head">
            <span className="live-dot">{deployment ? "live van Solana" : "binnenkort live"}</span>
            <span className="live-updated">{updatedAt ? `bijgewerkt ${ago(updatedAt)}` : deployment ? "laden..." : ""}</span>
          </div>
          <p className="live-raised">
            <b><Value loading={loading} width="5ch">{euro(raised, { whole: true })}</Value></b>
            <span> opgehaald van {euro(goalMicro(), { whole: true })}</span>
          </p>
          <Progress value={raised} max={goalMicro()} />
        </div>
        <dl className="live-stats">
          <div><dt>Genesis Passes</dt><dd><Value loading={loading}>{count(v.pass.claimed)}</Value><small> / {PASS.max}</small></dd></div>
          <div><dt>Agency</dt><dd><Value loading={loading}>{count(v.agency.claimed)}</Value><small> / {AGENCY.max}</small></dd></div>
          <div><dt>Supporters</dt><dd><Value loading={loading}>{count(s?.steun.wallets ?? 0)}</Value></dd></div>
          <div><dt>Prijs nu</dt><dd>{v.pass.price ? euro(v.pass.price, { whole: true }) : "uitverkocht"}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function Products({ s }: { s: GenesisState | null }) {
  const v = view(s);
  return (
    <section className="section" id="pakketten" aria-labelledby="h-pakketten">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Kies hoe je meedoet</p>
          <h2 id="h-pakketten">Drie manieren, één doel: Marketing Scan sneller bouwen</h2>
          <p className="section-lead">Elke pass is een levenslang abonnement, vooraf betaald. Geen maandfactuur, geen kleine lettertjes over prijsstijgingen.</p>
        </div>
        <div className="products">
          <article className="product is-main">
            <p className="product-tag">Meest gekozen</p>
            <h3>{PASS.naam}</h3>
            <p className="product-desc">{PASS.beschrijving}</p>
            <p className="product-price"><b>{v.pass.price ? euro(v.pass.price, { whole: true }) : "uitverkocht"}</b><span>eenmalig · nu voor {v.pass.next ? formatNumber(PASS, v.pass.next) : "-"}</span></p>
            <ul className="product-list">{PASS.voordelen.map((x) => <li key={x}>{x}</li>)}</ul>
            <Link className="btn btn-block" to="/genesis?product=pass">{isTestnet ? "Probeer de Genesis Pass" : "Claim je Genesis Pass"}</Link>
            <p className="product-note">Nog {count(v.pass.left)} van {PASS.max}</p>
          </article>
          <article className="product">
            <p className="product-tag tag-agency">Voor bureaus</p>
            <h3>{AGENCY.naam}</h3>
            <p className="product-desc">{AGENCY.beschrijving}</p>
            <p className="product-price"><b>{euro(AGENCY.prijsladder[0].prijsEur * EUR, { whole: true })}</b><span>eenmalig · {AGENCY.websites} websites</span></p>
            <ul className="product-list">{AGENCY.voordelen.map((x) => <li key={x}>{x}</li>)}</ul>
            <Link className="btn btn-block btn-ghost" to="/genesis?product=agency">Kies Agency</Link>
            <p className="product-note">Nog {count(v.agency.left)} van {AGENCY.max}</p>
          </article>
          <article className="product">
            <p className="product-tag tag-steun">Vanaf €{genesis.steun.minimumEur}</p>
            <h3>{genesis.steun.naam}</h3>
            <p className="product-desc">{genesis.steun.beschrijving}</p>
            <p className="product-price"><b>€{genesis.steun.minimumEur}+</b><span>vrij bedrag</span></p>
            <ul className="product-list">{genesis.steun.voordelen.map((x) => <li key={x}>{x}</li>)}</ul>
            <Link className="btn btn-block btn-ghost" to="/genesis?product=steun">Steun vanaf €1</Link>
            <p className="product-note">{count(s?.steun.wallets ?? 0)} supporters tot nu</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function PriceLadder({ s }: { s: GenesisState | null }) {
  const v = view(s);
  return (
    <section className="section section-band" id="prijsladder" aria-labelledby="h-ladder">
      <div className="container ladder-grid">
        <div className="section-head">
          <p className="eyebrow">De prijsladder</p>
          <h2 id="h-ladder">Je nummer bepaalt je prijs</h2>
          <p className="section-lead">
            De eerste 50 passes kosten €99. Daarna stijgt de prijs per 50 passes, tot €299. Geen kortingscodes, geen uitzonderingen: het nummer staat op de blockchain, en de prijs hoort erbij.
          </p>
          <p className="fineprint">Alle {PASS.max} passes samen brengen {euro(maxRevenueMicro(PASS), { whole: true })} op. Dat is het doel van Genesis: genoeg om de SEO-suite, mailings en social posting te bouwen.</p>
        </div>
        <Ladder product={PASS} used={v.pass.used} />
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
          <h2 id="h-werkt">In vier stappen levenslang Pro</h2>
        </div>
        <ol className="steps steps-4">
          <li className="step">
            <h3>Log in met je wallet</h3>
            <p>Phantom, Solflare of Backpack. Je wallet is je login en je kluis: niemand anders heeft je sleutels.</p>
          </li>
          <li className="step">
            <h3>Kies je pass</h3>
            <p>Je ziet meteen welk nummer je krijgt en wat het kost. Betalen gebeurt in euro-stablecoin; de transactiekosten betalen wij.</p>
          </li>
          <li className="step">
            <h3>Bevestig in je wallet</h3>
            <p>Je betaling en je pass gaan in één transactie. Lukt één deel niet, dan gebeurt er niets.</p>
          </li>
          <li className="step">
            <h3>Activeer in Marketing Scan</h3>
            <p>Met een gratis handtekening krijg je je activatiecode. Vanaf dan hangt Pro aan je account, voor altijd.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

function NotAnInvestment() {
  return (
    <section className="section section-night" id="geen-investering" aria-labelledby="h-geen">
      <div className="container split-2">
        <div className="section-head">
          <p className="eyebrow">Eerlijk is eerlijk</p>
          <h2 id="h-geen">Dit is geen investering. Het is je marketingtool, voor altijd.</h2>
          <p className="section-lead">Je koopt een levenslang abonnement, vooraf betaald. Je pass groeit niet in waarde, levert niets op en is niet verhandelbaar. Wat je krijgt, is Marketing Scan Pro zonder maandprijs, en een plek bij de eerste klanten.</p>
        </div>
        <ul className="facts">
          <li><b>Geen aandeel</b><span>Je krijgt geen deel van het bedrijf, geen winst en geen stemrecht in de onderneming.</span></li>
          <li><b>Niet verhandelbaar</b><span>Je pass is soulbound: hij kan je wallet niet verlaten. Doorverkopen kan niet, speculeren dus ook niet.</span></li>
          <li><b>Waarom dan Solana?</b><span>Omdat je pass dan echt van jou is, elke euro publiek te volgen is, en geld terug automatisch gaat.</span></li>
          <li><b>Geld terug</b><span>Binnen 14 dagen, met één klik. Je pass verdwijnt en je geld staat terug in je wallet, in dezelfde transactie.</span></li>
        </ul>
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
          <p className="eyebrow">Wat er in Pro zit</p>
          <h2 id="h-product">Vandaag een scherpe scan. Straks je hele online marketing.</h2>
          <p className="section-lead">Met een Genesis Pass krijg je alles wat in Pro zit, ook alles wat er later bijkomt. Zonder meerprijs.</p>
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
            <span className="status status-plan">In aanbouw</span>
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
          <p className="eyebrow">Building in public</p>
          <h2 id="h-eerlijk">We zijn vroeg, en dat zeggen we gewoon.</h2>
          <p className="section-lead">Marketing Scan is gebouwd door één oprichter. De scan werkt, de eerste gebruikers komen elke week terug. Met Genesis bouwen we de rest, samen met de mensen die het gaan gebruiken.</p>
        </div>
        <div className="metrics">
          <div className="metric"><b>{count(metrics.wekelijkseGebruikers)}</b><span>wekelijkse gebruikers</span></div>
          <div className="metric"><b>{count(metrics.betalendeKlanten)}</b><span>betalende klanten</span></div>
          <div className="metric"><b>{euro(metrics.mrrEur * EUR, { whole: true })}</b><span>terugkerende omzet per maand</span></div>
        </div>
        <p className="fineprint">Bijgewerkt op {date}. We publiceren deze cijfers elke maand, ook als ze tegenvallen.</p>
      </div>
    </section>
  );
}

function Trust({ s, loading }: { s: GenesisState | null; loading: boolean }) {
  const { connection } = useConnection();
  const v = view(s);
  const passes = (s?.muur ?? []).filter((e) => e.kind === "aankoop" && e.mint).map((e) => ({ mint: e.mint!, teruggegeven: e.teruggegeven, label: eventLabel(e) }));
  const key = passes.map((p) => `${p.mint}${p.teruggegeven ? "x" : ""}`).join();
  const check = useAsync(s ? () => verifyPasses(connection, passes) : null, [connection, key]);
  const pending = !deployment || loading || !s;
  const c = check.data;
  return (
    <section className="section section-night" id="vertrouwen" aria-labelledby="h-trust">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Vertrouw ons niet. Controleer het.</p>
          <h2 id="h-trust">Live nagekeken op de blockchain, elke keer dat je deze pagina opent</h2>
        </div>
        <ul className="checks">
          <Check
            state={pending ? "wait" : s.kasMicro === s.verwachteKasMicro ? "ok" : "bad"}
            title="De kas klopt tot op de cent"
            link={deployment ? { href: explorerAddress(deployment.kas), label: "Bekijk de kas" } : undefined}
          >
            {s ? `In de kas: ${euro(s.kasMicro)}. Alles wat binnenkwam, min terugbetalingen en opnames: ${euro(s.verwachteKasMicro)}.` : "Wordt gecontroleerd."}
          </Check>
          <Check state={pending ? "wait" : s.kasMicro >= v.bufferMicro ? "ok" : "bad"} title="Geld terug is altijd gedekt">
            {s ? `Aankopen van de laatste ${genesis.bedenktijdDagen} dagen: ${euro(v.bufferMicro)}. Dat blijft in de kas tot de bedenktijd voorbij is.` : "Wordt gecontroleerd."}
          </Check>
          <Check state={!c ? "wait" : c.problems.length === 0 ? "ok" : "bad"} title="Elke pass bestaat maar één keer" link={{ href: "/transparantie", label: "Alle passes" }}>
            {c ? (c.problems.length === 0 ? `${count(c.ok)} van ${count(c.checked)} passes nagekeken: voorraad 1, muntrecht ingetrokken, niet overdraagbaar.` : c.problems.join(" ")) : "Wordt gecontroleerd."}
          </Check>
          <Check state={!c ? "wait" : c.problems.length === 0 ? "ok" : "bad"} title="Niemand kan je pass afpakken of bevriezen">
            Er bestaat geen bevriesrecht op de passes. Enkel jij kan je pass teruggeven, en dan krijg je je geld terug.
          </Check>
        </ul>
        <p className="fineprint" style={{ color: "var(--on-night-muted)" }}>
          <Link to="/transparantie" style={{ color: "var(--on-night)" }}>Alle adressen, transacties en controles op de transparantiepagina</Link>
        </p>
      </div>
    </section>
  );
}

function WallPreview({ s }: { s: GenesisState | null }) {
  return (
    <section className="section" id="muur" aria-labelledby="h-muur">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">De Genesis-muur</p>
          <h2 id="h-muur">De eerste klanten van Marketing Scan</h2>
          <p className="section-lead">Iedereen die meedoet, komt op de muur: met de naam die je zelf kiest, of gewoon je walletadres.</p>
        </div>
        {s ? <Wall entries={s.muur.slice(0, 12)} /> : <p className="wall-empty">{deployment ? "Laden..." : "De muur verschijnt zodra Genesis live staat."}</p>}
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
          <details><summary>Is dit een investering?</summary><p>Nee. Je koopt een levenslang abonnement op Marketing Scan Pro, vooraf betaald. Je krijgt geen aandeel, geen winst en geen stemrecht in het bedrijf. Je pass is niet overdraagbaar, dus doorverkopen kan niet.</p></details>
          <details><summary>Wat betekent levenslang?</summary><p>Zolang Marketing Scan bestaat, heb je Pro zonder maandprijs. Alles wat in Pro zit of erbij komt, krijg je zonder meerprijs. Stopt Marketing Scan ooit, dan hoor je dat minstens 6 maanden vooraf en kan je al je gegevens exporteren.</p></details>
          <details><summary>Waarom stijgt de prijs per 50 passes?</summary><p>Wie vroeg instapt, steunt ons op het moment dat het het meest uitmaakt. Daarom ligt de prijs vast per nummer: €99 voor #001 tot #050, daarna telkens €50 meer, tot €299 voor #201 tot #250.</p></details>
          <details><summary>Waarom met een wallet en niet gewoon met je bankkaart?</summary><p>Je pass staat in je eigen wallet: niemand kan hem afpakken of bevriezen, ook wij niet. Elke betaling en terugbetaling is publiek na te kijken. En geld terug gaat automatisch, in dezelfde transactie waarin je pass verdwijnt.</p></details>
          <details><summary>Hoe werkt geld terug?</summary><p>Binnen 14 dagen na je aankoop klik je bij Mijn pass op Geld terug. In één transactie verdwijnt je pass en staat het volledige bedrag terug in je wallet. Geen vragen, geen formulieren.</p></details>
          <details><summary>Wat heb ik nodig?</summary><p>Een Solana-wallet zoals Phantom, Solflare of Backpack, en euro-stablecoin (EURC). De transactiekosten betalen wij. In de demo krijg je gratis test-euro.</p></details>
          <details><summary>Wat als ik mijn wallet verlies?</summary><p>Activeer je pass zo snel mogelijk. Daarna hangt je levenslange abonnement aan je Marketing Scan-account, ook als je wallet ooit kwijt is.</p></details>
          <details><summary>Krijg ik een factuur?</summary><p>Ja. Vóór de echte verkoop leggen we vast hoe facturen en btw werken. Alle prijzen zijn eindprijzen.</p></details>
          <details><summary>Wanneer start de echte verkoop?</summary><p>Nu is dit een demo op het Solana-testnet, zonder echt geld. De echte verkoop start zodra de juridische vorm in orde is. Schrijf je hieronder in, dan hoor je het als eerste.</p></details>
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
    if (!consent) return setStatus({ kind: "err", text: "Vink aan dat je e-mails over Genesis wil ontvangen." });
    setBusy(true);
    try {
      await joinWaitlist(email.trim());
      setStatus({ kind: "ok", text: "Je staat op de lijst. Je hoort het als eerste wanneer Genesis echt start." });
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
          <h2 id="h-cta">{isTestnet ? "Probeer het nu, zonder echt geld" : "Claim je plek bij de eerste 250"}</h2>
          <p>
            {isTestnet
              ? "Op het testnet doorloop je alles zoals het straks echt werkt: inloggen, test-euro ontvangen, je genummerde pass claimen, activeren en zelfs geld terug vragen."
              : "Log in met je wallet, kies je pass en bevestig. Binnen een minuut staat je genummerde pass in je wallet."}
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-large btn-light" to="/genesis">{claimLabel}</Link>
          </div>
        </div>
        <form className="waitlist" onSubmit={submit} noValidate>
          <h3>{isTestnet ? "Verwittig me bij de echte start" : "Hou me op de hoogte"}</h3>
          <label className="sr-only" htmlFor="wl-email">E-mailadres</label>
          <div className="waitlist-row">
            <input id="wl-email" className="input" type="email" autoComplete="email" placeholder="jij@bedrijf.be" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" type="submit" disabled={busy}>{busy ? "Even geduld..." : "Op de lijst"}</button>
          </div>
          <label className="consent" htmlFor="wl-consent">
            <input id="wl-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Ik wil e-mails over Marketing Scan Genesis ontvangen. Uitschrijven kan altijd. <Link to="/privacy">Privacy</Link></span>
          </label>
          <p className={`form-status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>
        </form>
      </div>
    </section>
  );
}

export function Home() {
  const state = useGenesis();
  const s = state.data;
  const loading = Boolean(deployment) && !s;
  return (
    <>
      <Hero s={s} />
      <LiveStrip s={s} loading={loading} updatedAt={state.updatedAt} />
      <Products s={s} />
      <PriceLadder s={s} />
      <HowItWorks />
      <NotAnInvestment />
      <Product />
      <Honest />
      <Trust s={s} loading={loading} />
      <WallPreview s={s} />
      <Faq />
      <Cta />
    </>
  );
}
