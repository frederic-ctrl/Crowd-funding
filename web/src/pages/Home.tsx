import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import { AGENCY, PASS, deployment, genesis, isTestnet, metrics } from "../config";
import { EUR, formatNumber } from "../../../shared/genesis.js";
import { useAsync, useGenesis } from "../lib/hooks";
import { count, euro } from "../lib/format";
import { explorerAddress } from "../lib/explorer";
import { verifyPasses } from "../lib/chain";
import { joinWaitlist, ApiError, type GenesisState } from "../lib/api";
import { Bar, Reveal, State, Value } from "../components/ui";
import { Ladder, PassBack, PassCard, Wall, eventLabel, goalMicro, view } from "../components/genesis";
import { SpinningPass } from "../components/SpinningPass";
import { useLang, useT } from "../i18n";

const T = {
  en: {
    kicker: "Marketing Scan Genesis",
    h1: ["Pay once.", "Use it forever."],
    sub: "Lifetime Marketing Scan Pro. 250 numbered passes, from €99.",
    cta: isTestnet ? "Try the demo" : "Claim your pass",
    how: "How it works",
    live: "Live on Solana",
    next: (n: string, p: string) => `Next: ${n} for ${p}`,
    claimed: (n: string, max: number) => `${n} of ${max} claimed`,
    soldOut: "Sold out",
    spinLabel: "Genesis Pass. Drag to spin.",
    raised: "raised of",
    passes: (max: number) => `of ${max} passes claimed`,
    days: "days",
    refundWindow: "to change your mind",
    goalLeft: "raised",
    goalRight: "Goal",
    proHead: ["Everything in Pro.", "Forever."],
    proLead: "One payment covers today’s scan and every Pro feature we build next.",
    tiles: [
      { tag: "Live", live: true, title: "The marketing scan.", text: "30+ checks across your website, Google, reviews, social and AI assistants. Results in 60 seconds." },
      { tag: "In development", title: "SEO suite.", text: "Keywords, rankings, competitors and backlinks. Built for small businesses." },
      { tag: "Planned", title: "Email.", text: "Newsletters and automations, straight from your scan." },
      { tag: "Planned", title: "Social posting.", text: "Plan and publish everywhere, with ideas from your own scan." },
    ],
    score: "Marketing score",
    ladderHead: "Your number sets your price.",
    ladderLead: "The first 50 passes are €99. Every 50 after that, €50 more. No discount codes. No exceptions.",
    ladderNow: (p: string, n: string, left: number) => (
      <>Right now: <b>{p}</b> for {n}. {left} left at this price.</>
    ),
    plansHead: "Pick your pass.",
    plans: {
      pass: { flag: "Most popular", desc: "Lifetime Pro for one business.", small: (n: string) => `one-time · ${n} is next`, items: ["Marketing Scan Pro for 1 website", "Every future Pro feature", "A numbered pass in your wallet", "Your name on the Genesis wall", "14-day refund, one click"], button: isTestnet ? "Try Genesis Pass" : "Claim Genesis Pass" },
      agency: { flag: "For agencies", desc: "Lifetime Pro for up to 10 websites.", small: () => `one-time · ${AGENCY.max} passes`, items: ["Everything in Genesis Pass", "Up to 10 client websites", "Direct line to the founder", "A numbered agency pass", "14-day refund, one click"], button: "Choose Agency" },
      steun: { flag: "", desc: "Back the build. No subscription.", small: () => "any amount", items: ["Supporter badge in your wallet", "Your name on the Genesis wall", "Counts toward the €50,000 goal"], button: "Support from €1" },
    },
    left: (n: number, max: number) => `${n} of ${max} left`,
    supporters: (n: number) => `${n} supporters so far`,
    trustHead: "Every euro. On-chain.",
    trustLead: "Don’t take our word for it. This page checks the blockchain every time you open it.",
    checking: "Checking",
    verified: "Verified",
    problem: "Problem",
    facts: {
      kas: { title: "The treasury adds up.", text: (a: string, b: string) => `${a} in the treasury. Everything in, minus refunds and withdrawals: ${b}.` },
      buffer: { title: "Refunds are covered.", text: (a: string) => `Purchases from the last ${genesis.bedenktijdDagen} days stay in the treasury until the refund window closes: ${a}.` },
      unique: { title: "Every pass exists once.", text: (n: number) => `${n} passes checked on-chain: a supply of one, minting disabled, non-transferable.` },
      freeze: { title: "Nobody can freeze your pass.", text: "There is no freeze authority, not even for us. Only you can return your pass, and then you get your money back." },
    },
    ledger: "Open the ledger",
    refundHead: ["14 days.", "One click.", "Money back."],
    refundText: "Changed your mind? Your pass is burned and the full amount returns to your wallet, in the same transaction.",
    notHead: ["Not an investment.", "Just your marketing tool."],
    notText: "No shares, no returns, no resale. Your pass can’t leave your wallet, so there’s nothing to speculate on. You get Pro for life, and a seat among the first customers.",
    howHead: "How it works.",
    steps: [
      ["Sign in with your wallet.", "Phantom, Solflare or Backpack. No password, no account."],
      ["Pick your pass.", "You see your number and price before you confirm."],
      ["Confirm once.", "Payment and pass in one transaction. If one part fails, nothing happens."],
      ["Activate.", "A free signature gives you your code. Pro is then tied to your account."],
    ],
    earlyHead: "We’re early. Here’s the proof.",
    earlyLead: "Marketing Scan is built by one founder. The scan works and people come back every week. Genesis funds the rest.",
    early: ["weekly users", "paying customers", "monthly revenue"],
    earlyNote: (d: string) => `Updated ${d}. Published every month, good or bad.`,
    wallHead: "The first customers.",
    wallLead: "Everyone who joins goes on the wall, with the name they choose.",
    wallEmpty: "Be the first. #001 is still free.",
    wallLoading: "Loading the wall…",
    faqHead: "Questions.",
    faq: [
      ["Is this an investment?", "No. You buy a lifetime subscription to Marketing Scan Pro, paid upfront. You get no shares, no profit and no say in the company. Your pass can’t be transferred, so it can’t be resold."],
      ["What does lifetime mean?", "For as long as Marketing Scan exists, you pay nothing for Pro. Everything in Pro, now or later, is included. If Marketing Scan ever shuts down, you’ll hear at least 6 months ahead and can export all your data."],
      ["Why does the price go up every 50 passes?", "The earliest customers back us when it matters most. So the price is fixed per number: €99 for #001 to #050, then €50 more per 50, up to €299."],
      ["Why a wallet instead of a card payment?", "Your pass lives in your own wallet: nobody can take it or freeze it, including us. Every payment and refund is public. And refunds are automatic, in the same transaction that burns your pass."],
      ["How do refunds work?", "Within 14 days of buying, tap Refund in My pass. Your pass is burned and the full amount returns to your wallet in one transaction. No questions, no forms."],
      ["What do I need?", "A Solana wallet like Phantom, Solflare or Backpack, and euro stablecoin (EURC). We pay the network fees. In the demo you get free test euros."],
      ["What if I lose my wallet?", "Activate your pass early. After that, your lifetime plan is tied to your Marketing Scan account, even if your wallet is gone."],
      ["Do I get an invoice?", "Yes. Invoicing and VAT are set up before real sales start. All prices are final prices."],
      ["When do real sales start?", "Right now this is a demo on Solana devnet with test money. Real sales open once the legal setup is done. Join the list below to hear first."],
    ],
    ctaHead: "Get in early.",
    ctaLead: isTestnet ? "Try everything now with test euros: claim a pass, activate it, even get a refund." : "Sign in, pick your pass, confirm. Your numbered pass is in your wallet within a minute.",
    listTitle: "Get notified when sales open.",
    email: "Email address",
    emailPlaceholder: "you@company.com",
    notify: "Notify me",
    busy: "One moment…",
    consent: "I want emails about Marketing Scan Genesis. Unsubscribe anytime.",
    privacy: "Privacy",
    badEmail: "Enter a valid email address.",
    needConsent: "Tick the box to receive emails about Genesis.",
    ok: "You’re on the list. You’ll hear first when sales open.",
    notReady: "The list isn’t open yet. Try again soon.",
    failed: "That didn’t work. Please try again later.",
  },
  nl: {
    kicker: "Marketing Scan Genesis",
    h1: ["Eén keer betalen.", "Voor altijd gebruiken."],
    sub: "Levenslang Marketing Scan Pro. 250 genummerde passes, vanaf €99.",
    cta: isTestnet ? "Probeer de demo" : "Claim je pass",
    how: "Hoe het werkt",
    live: "Live op Solana",
    next: (n: string, p: string) => `Volgende: ${n} voor ${p}`,
    claimed: (n: string, max: number) => `${n} van ${max} geclaimd`,
    soldOut: "Uitverkocht",
    spinLabel: "Genesis Pass. Sleep om te draaien.",
    raised: "opgehaald van",
    passes: (max: number) => `van ${max} passes geclaimd`,
    days: "dagen",
    refundWindow: "om van gedacht te veranderen",
    goalLeft: "opgehaald",
    goalRight: "Doel",
    proHead: ["Alles van Pro.", "Voor altijd."],
    proLead: "Eén betaling voor de scan van vandaag en elke Pro-functie die we hierna bouwen.",
    tiles: [
      { tag: "Live", live: true, title: "De marketingscan.", text: "30+ controles op je website, Google, reviews, social en AI-assistenten. Resultaat in 60 seconden." },
      { tag: "In aanbouw", title: "SEO-suite.", text: "Zoekwoorden, posities, concurrenten en backlinks. Gemaakt voor kmo’s." },
      { tag: "Gepland", title: "E-mail.", text: "Nieuwsbrieven en automatische mails, rechtstreeks vanuit je scan." },
      { tag: "Gepland", title: "Social posting.", text: "Overal plannen en publiceren, met ideeën uit je eigen scan." },
    ],
    score: "Marketingscore",
    ladderHead: "Je nummer bepaalt je prijs.",
    ladderLead: "De eerste 50 passes kosten €99. Daarna telkens €50 meer per 50. Geen kortingscodes. Geen uitzonderingen.",
    ladderNow: (p: string, n: string, left: number) => (
      <>Nu: <b>{p}</b> voor {n}. Nog {left} aan deze prijs.</>
    ),
    plansHead: "Kies je pass.",
    plans: {
      pass: { flag: "Meest gekozen", desc: "Levenslang Pro voor één bedrijf.", small: (n: string) => `eenmalig · ${n} is de volgende`, items: ["Marketing Scan Pro voor 1 website", "Elke toekomstige Pro-functie", "Een genummerde pass in je wallet", "Je naam op de Genesis-muur", "14 dagen geld terug, één klik"], button: isTestnet ? "Probeer de Genesis Pass" : "Claim de Genesis Pass" },
      agency: { flag: "Voor bureaus", desc: "Levenslang Pro voor tot 10 websites.", small: () => `eenmalig · ${AGENCY.max} passes`, items: ["Alles van de Genesis Pass", "Tot 10 websites van klanten", "Rechtstreeks contact met de oprichter", "Een genummerde agency-pass", "14 dagen geld terug, één klik"], button: "Kies Agency" },
      steun: { flag: "", desc: "Steun de bouw. Geen abonnement.", small: () => "vrij bedrag", items: ["Supporter-badge in je wallet", "Je naam op de Genesis-muur", "Telt mee voor het doel van €50.000"], button: "Steun vanaf €1" },
    },
    left: (n: number, max: number) => `Nog ${n} van ${max}`,
    supporters: (n: number) => `${n} supporters tot nu`,
    trustHead: "Elke euro. Op de blockchain.",
    trustLead: "Geloof ons niet op ons woord. Deze pagina controleert de blockchain telkens je ze opent.",
    checking: "Bezig",
    verified: "Nagekeken",
    problem: "Probleem",
    facts: {
      kas: { title: "De kas klopt.", text: (a: string, b: string) => `In de kas: ${a}. Alles wat binnenkwam, min terugbetalingen en opnames: ${b}.` },
      buffer: { title: "Geld terug is gedekt.", text: (a: string) => `Aankopen van de laatste ${genesis.bedenktijdDagen} dagen blijven in de kas tot de bedenktijd voorbij is: ${a}.` },
      unique: { title: "Elke pass bestaat één keer.", text: (n: number) => `${n} passes nagekeken op de blockchain: voorraad één, muntrecht ingetrokken, niet overdraagbaar.` },
      freeze: { title: "Niemand kan je pass bevriezen.", text: "Er bestaat geen bevriesrecht, ook niet voor ons. Enkel jij kan je pass teruggeven, en dan krijg je je geld terug." },
    },
    ledger: "Bekijk het kasboek",
    refundHead: ["14 dagen.", "Eén klik.", "Geld terug."],
    refundText: "Van gedacht veranderd? Je pass wordt verbrand en het volledige bedrag staat terug in je wallet, in dezelfde transactie.",
    notHead: ["Geen investering.", "Gewoon je marketingtool."],
    notText: "Geen aandelen, geen rendement, geen doorverkoop. Je pass kan je wallet niet verlaten, dus er valt niets te speculeren. Je krijgt Pro voor altijd, en een plek bij de eerste klanten.",
    howHead: "Hoe het werkt.",
    steps: [
      ["Log in met je wallet.", "Phantom, Solflare of Backpack. Geen wachtwoord, geen account."],
      ["Kies je pass.", "Je ziet je nummer en je prijs voor je bevestigt."],
      ["Bevestig één keer.", "Betaling en pass in één transactie. Lukt één deel niet, dan gebeurt er niets."],
      ["Activeer.", "Een gratis handtekening geeft je je code. Pro hangt dan aan je account."],
    ],
    earlyHead: "We zijn vroeg. Dit is het bewijs.",
    earlyLead: "Marketing Scan wordt gebouwd door één oprichter. De scan werkt en mensen komen elke week terug. Genesis betaalt de rest.",
    early: ["wekelijkse gebruikers", "betalende klanten", "omzet per maand"],
    earlyNote: (d: string) => `Bijgewerkt op ${d}. Elke maand gepubliceerd, goed of slecht.`,
    wallHead: "De eerste klanten.",
    wallLead: "Iedereen die meedoet, komt op de muur, met de naam die die zelf kiest.",
    wallEmpty: "Word de eerste. #001 is nog vrij.",
    wallLoading: "De muur laden…",
    faqHead: "Vragen.",
    faq: [
      ["Is dit een investering?", "Nee. Je koopt een levenslang abonnement op Marketing Scan Pro, vooraf betaald. Je krijgt geen aandeel, geen winst en geen inspraak in het bedrijf. Je pass is niet overdraagbaar, dus doorverkopen kan niet."],
      ["Wat betekent levenslang?", "Zolang Marketing Scan bestaat, betaal je niets voor Pro. Alles wat in Pro zit, nu of later, is inbegrepen. Stopt Marketing Scan ooit, dan hoor je dat minstens 6 maanden vooraf en kan je al je gegevens exporteren."],
      ["Waarom stijgt de prijs per 50 passes?", "Wie vroeg instapt, steunt ons wanneer het het meest uitmaakt. Daarom ligt de prijs vast per nummer: €99 voor #001 tot #050, daarna telkens €50 meer per 50, tot €299."],
      ["Waarom een wallet en geen kaartbetaling?", "Je pass staat in je eigen wallet: niemand kan hem afpakken of bevriezen, ook wij niet. Elke betaling en terugbetaling is publiek. En geld terug gaat automatisch, in dezelfde transactie die je pass verbrandt."],
      ["Hoe werkt geld terug?", "Binnen 14 dagen na je aankoop tik je in Mijn pass op Geld terug. Je pass wordt verbrand en het volledige bedrag staat in één transactie terug in je wallet. Geen vragen, geen formulieren."],
      ["Wat heb ik nodig?", "Een Solana-wallet zoals Phantom, Solflare of Backpack, en euro-stablecoin (EURC). De transactiekosten betalen wij. In de demo krijg je gratis test-euro."],
      ["Wat als ik mijn wallet verlies?", "Activeer je pass snel. Daarna hangt je levenslange abonnement aan je Marketing Scan-account, ook als je wallet ooit weg is."],
      ["Krijg ik een factuur?", "Ja. Facturen en btw worden geregeld voor de echte verkoop start. Alle prijzen zijn eindprijzen."],
      ["Wanneer start de echte verkoop?", "Nu is dit een demo op het Solana-testnet met testgeld. De echte verkoop opent zodra de juridische vorm in orde is. Schrijf je hieronder in om het als eerste te horen."],
    ],
    ctaHead: "Wees er vroeg bij.",
    ctaLead: isTestnet ? "Probeer alles nu al met test-euro: een pass claimen, activeren en zelfs geld terugvragen." : "Log in, kies je pass en bevestig. Binnen een minuut staat je genummerde pass in je wallet.",
    listTitle: "Verwittig me als de verkoop opent.",
    email: "E-mailadres",
    emailPlaceholder: "jij@bedrijf.be",
    notify: "Hou me op de hoogte",
    busy: "Even geduld…",
    consent: "Ik wil e-mails over Marketing Scan Genesis. Uitschrijven kan altijd.",
    privacy: "Privacy",
    badEmail: "Vul een geldig e-mailadres in.",
    needConsent: "Vink het vakje aan om e-mails over Genesis te ontvangen.",
    ok: "Je staat op de lijst. Je hoort het als eerste wanneer de verkoop opent.",
    notReady: "De lijst is nog niet open. Probeer het binnenkort opnieuw.",
    failed: "Dat lukte niet. Probeer het later opnieuw.",
  },
};

type Copy = (typeof T)["en"];

function Hero({ s, t }: { s: GenesisState | null; t: Copy }) {
  const v = view(s);
  return (
    <section className="hero" aria-labelledby="h-hero">
      <div className="container">
        <p className="hero-kicker">{t.kicker}</p>
        <h1 id="h-hero">{t.h1[0]}<br />{t.h1[1]}</h1>
        <p className="hero-sub">{t.sub}</p>
        <div className="hero-ctas">
          <Link className="btn btn-lg" to="/genesis">{t.cta}</Link>
          <a className="more" href="#hoe">{t.how}</a>
        </div>
      </div>
      <div className="hero-stage">
        <SpinningPass label={t.spinLabel} front={<PassCard variant="pass" number={v.pass.next ?? PASS.max} />} back={<PassBack variant="pass" />} />
        <p className="hero-meta">
          {deployment && <span className="live">{t.live}</span>}
          <span>{v.pass.next && v.pass.price ? t.next(formatNumber(PASS, v.pass.next), euro(v.pass.price, { whole: true })) : t.soldOut}</span>
          {s && <span>{t.claimed(count(v.pass.claimed), PASS.max)}</span>}
        </p>
      </div>
    </section>
  );
}

function Numbers({ s, loading, t }: { s: GenesisState | null; loading: boolean; t: Copy }) {
  const v = view(s);
  const raised = s?.opgehaaldMicro ?? 0;
  return (
    <section className="section tight" aria-label="Genesis">
      <div className="container">
        <div className="stats">
          <div className="stat"><b><Value loading={loading} width="4ch">{euro(raised, { whole: true })}</Value></b><span>{t.raised} {euro(goalMicro(), { whole: true })}</span></div>
          <div className="stat"><b><Value loading={loading} width="2ch">{count(v.pass.claimed + v.agency.claimed)}</Value></b><span>{t.passes(PASS.max + AGENCY.max)}</span></div>
          <div className="stat"><b>{genesis.bedenktijdDagen} {t.days}</b><span>{t.refundWindow}</span></div>
        </div>
        <div className="goal">
          <Bar value={raised} max={goalMicro()} />
          <p><span>{euro(raised, { whole: true })} {t.goalLeft}</span><span>{t.goalRight} {euro(goalMicro(), { whole: true })}</span></p>
        </div>
      </div>
    </section>
  );
}

function Pro({ t }: { t: Copy }) {
  const [first, ...rest] = t.tiles;
  return (
    <section className="section alt" aria-labelledby="h-pro">
      <div className="container wide">
        <Reveal className="section-head">
          <h2 id="h-pro" className="headline">{t.proHead[0]}<br />{t.proHead[1]}</h2>
          <p className="lead">{t.proLead}</p>
        </Reveal>
        <div className="bento">
          <Reveal className="tile wide">
            <div className="tile-copy">
              <span className={`tag${first.live ? " live" : ""}`}>{first.tag}</span>
              <h3>{first.title}</h3>
              <p>{first.text}</p>
            </div>
            <div className="score" aria-hidden="true"><div><b>87</b><span>{t.score}</span></div></div>
          </Reveal>
          {rest.map((tile) => (
            <Reveal key={tile.title} className="tile">
              <span className="tag">{tile.tag}</span>
              <h3>{tile.title}</h3>
              <p>{tile.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Price({ s, t }: { s: GenesisState | null; t: Copy }) {
  const v = view(s);
  const tierEnd = PASS.prijsladder.find((x) => (v.pass.next ?? PASS.max) <= x.tot)?.tot ?? PASS.max;
  return (
    <section className="section" aria-labelledby="h-price">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="h-price" className="headline">{t.ladderHead}</h2>
          <p className="lead">{t.ladderLead}</p>
        </Reveal>
        <Reveal>
          <Ladder product={PASS} used={v.pass.used} />
          {v.pass.next && v.pass.price && <p className="ladder-note">{t.ladderNow(euro(v.pass.price, { whole: true }), formatNumber(PASS, v.pass.next), tierEnd - v.pass.used)}</p>}
        </Reveal>
      </div>
    </section>
  );
}

function Plans({ s, t }: { s: GenesisState | null; t: Copy }) {
  const v = view(s);
  const cards = [
    { id: "pass", p: t.plans.pass, price: v.pass.price ? euro(v.pass.price, { whole: true }) : t.soldOut, small: t.plans.pass.small(v.pass.next ? formatNumber(PASS, v.pass.next) : "-"), to: "/genesis", left: t.left(v.pass.left, PASS.max), primary: true },
    { id: "agency", p: t.plans.agency, price: euro(AGENCY.prijsladder[0].prijsEur * EUR, { whole: true }), small: t.plans.agency.small(), to: "/genesis?product=agency", left: t.left(v.agency.left, AGENCY.max), primary: false },
    { id: "steun", p: t.plans.steun, price: `€${genesis.steun.minimumEur}+`, small: t.plans.steun.small(), to: "/genesis?product=steun", left: t.supporters(s?.steun.wallets ?? 0), primary: false },
  ];
  return (
    <section className="section alt" aria-labelledby="h-plans">
      <div className="container wide">
        <Reveal className="section-head">
          <h2 id="h-plans" className="headline">{t.plansHead}</h2>
        </Reveal>
        <div className="plans">
          {cards.map((c) => (
            <Reveal key={c.id} className="plan">
              <span className="plan-flag">{c.p.flag}</span>
              <h3>{c.id === "steun" ? genesis.steun.naam : c.id === "agency" ? AGENCY.naam : PASS.naam}</h3>
              <p className="plan-desc">{c.p.desc}</p>
              <p className="plan-price">{c.price}<small>{c.small}</small></p>
              <ul>{c.p.items.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link className={`btn btn-block${c.primary ? "" : " btn-secondary"}`} to={c.to}>{c.p.button}</Link>
              <span className="plan-left">{c.left}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust({ s, t }: { s: GenesisState | null; t: Copy }) {
  const { connection } = useConnection();
  const v = view(s);
  const passes = (s?.muur ?? []).filter((e) => e.kind === "aankoop" && e.mint).map((e) => ({ mint: e.mint!, teruggegeven: e.teruggegeven, label: eventLabel(e) }));
  const key = passes.map((p) => `${p.mint}${p.teruggegeven ? "x" : ""}`).join();
  const check = useAsync(s ? () => verifyPasses(connection, passes) : null, [connection, key]);
  const c = check.data;
  const label = (state: "ok" | "wait" | "bad") => (state === "ok" ? t.verified : state === "bad" ? t.problem : t.checking);
  const kas: "ok" | "wait" | "bad" = !s ? "wait" : s.kasMicro === s.verwachteKasMicro ? "ok" : "bad";
  const buffer: "ok" | "wait" | "bad" = !s ? "wait" : s.kasMicro >= v.bufferMicro ? "ok" : "bad";
  const unique: "ok" | "wait" | "bad" = !c ? "wait" : c.problems.length === 0 ? "ok" : "bad";
  return (
    <section className="section dark" aria-labelledby="h-trust">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="h-trust" className="headline">{t.trustHead}</h2>
          <p className="lead">{t.trustLead}</p>
        </Reveal>
        <div className="facts">
          <Reveal className="fact">
            <State state={kas}>{label(kas)}</State>
            <h3>{t.facts.kas.title}</h3>
            <p>{s ? t.facts.kas.text(euro(s.kasMicro), euro(s.verwachteKasMicro)) : "…"}</p>
          </Reveal>
          <Reveal className="fact">
            <State state={buffer}>{label(buffer)}</State>
            <h3>{t.facts.buffer.title}</h3>
            <p>{t.facts.buffer.text(euro(v.bufferMicro))}</p>
          </Reveal>
          <Reveal className="fact">
            <State state={unique}>{label(unique)}</State>
            <h3>{t.facts.unique.title}</h3>
            <p>{c && c.problems.length > 0 ? c.problems.join(" ") : t.facts.unique.text(c?.ok ?? 0)}</p>
          </Reveal>
          <Reveal className="fact">
            <State state={unique}>{label(unique)}</State>
            <h3>{t.facts.freeze.title}</h3>
            <p>{t.facts.freeze.text}</p>
          </Reveal>
        </div>
        <p className="facts-more">
          <Link className="more" to="/transparantie">{t.ledger}</Link>
          {deployment && <>{"  "}<a className="more" href={explorerAddress(deployment.kas)} target="_blank" rel="noreferrer" style={{ marginLeft: 28 }}>Solana Explorer</a></>}
        </p>
      </div>
    </section>
  );
}

function Statement({ lines, text, alt }: { lines: string[]; text: string; alt?: boolean }) {
  return (
    <section className={`section statement${alt ? " alt" : ""}`}>
      <Reveal className="container">
        <h2>{lines.map((l, i) => <span key={l}>{l}{i < lines.length - 1 && <br />}</span>)}</h2>
        <p className="lead">{text}</p>
      </Reveal>
    </section>
  );
}

function How({ t }: { t: Copy }) {
  return (
    <section className="section" id="hoe" aria-labelledby="h-how">
      <div className="container wide">
        <Reveal className="section-head">
          <h2 id="h-how" className="headline">{t.howHead}</h2>
        </Reveal>
        <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", textAlign: "left" }}>
          {t.steps.map(([title, text], i) => (
            <Reveal key={title} className="stat">
              <b style={{ fontSize: 40, color: "var(--line)" }}>{i + 1}</b>
              <h3 style={{ fontSize: 21, marginTop: 14 }}>{title}</h3>
              <span>{text}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Early({ t }: { t: Copy }) {
  const { lang } = useLang();
  const date = new Intl.DateTimeFormat(lang === "nl" ? "nl-BE" : "en-IE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(metrics.bijgewerkt));
  return (
    <section className="section alt" aria-labelledby="h-early">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="h-early" className="headline">{t.earlyHead}</h2>
          <p className="lead">{t.earlyLead}</p>
        </Reveal>
        <Reveal className="stats">
          <div className="stat"><b>{count(metrics.wekelijkseGebruikers)}</b><span>{t.early[0]}</span></div>
          <div className="stat"><b>{count(metrics.betalendeKlanten)}</b><span>{t.early[1]}</span></div>
          <div className="stat"><b>{euro(metrics.mrrEur * EUR, { whole: true })}</b><span>{t.early[2]}</span></div>
        </Reveal>
        <p className="fine center" style={{ marginTop: 40 }}>{t.earlyNote(date)}</p>
      </div>
    </section>
  );
}

function WallSection({ s, t }: { s: GenesisState | null; t: Copy }) {
  return (
    <section className="section" aria-labelledby="h-wall">
      <div className="container wide">
        <Reveal className="section-head">
          <h2 id="h-wall" className="headline">{t.wallHead}</h2>
          <p className="lead">{t.wallLead}</p>
        </Reveal>
        {!s ? (
          <p className="wall-empty">{deployment ? t.wallLoading : t.wallEmpty}</p>
        ) : s.muur.length === 0 ? (
          <p className="wall-empty"><Link className="more" to="/genesis">{t.wallEmpty}</Link></p>
        ) : (
          <Wall entries={s.muur.slice(0, 40)} />
        )}
      </div>
    </section>
  );
}

function Faq({ t }: { t: Copy }) {
  return (
    <section className="section alt" id="faq" aria-labelledby="h-faq">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="h-faq" className="headline">{t.faqHead}</h2>
        </Reveal>
        <div className="faq">
          {t.faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta({ t }: { t: Copy }) {
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<{ kind: "" | "ok" | "err"; text: string }>({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setStatus({ kind: "err", text: t.badEmail });
    if (!consent) return setStatus({ kind: "err", text: t.needConsent });
    setBusy(true);
    try {
      await joinWaitlist(email.trim(), lang);
      setStatus({ kind: "ok", text: t.ok });
      setEmail("");
      setConsent(false);
    } catch (err) {
      const code = err instanceof ApiError ? err.status : 0;
      setStatus({ kind: "err", text: code === 503 ? t.notReady : t.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section dark cta center" aria-labelledby="h-cta">
      <div className="container">
        <h2 id="h-cta">{t.ctaHead}</h2>
        <p className="lead">{t.ctaLead}</p>
        <div className="hero-ctas">
          <Link className="btn btn-lg" to="/genesis">{t.cta}</Link>
        </div>
        <form className="waitlist" onSubmit={submit} noValidate>
          <p style={{ fontWeight: 600 }}>{t.listTitle}</p>
          <div className="waitlist-row">
            <label className="sr-only" htmlFor="wl-email">{t.email}</label>
            <input id="wl-email" className="input" type="email" autoComplete="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" type="submit" disabled={busy}>{busy ? t.busy : t.notify}</button>
          </div>
          <label className="check" htmlFor="wl-consent">
            <input id="wl-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t.consent} <Link to="/privacy">{t.privacy}</Link></span>
          </label>
          <p className={`form-status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>
        </form>
      </div>
    </section>
  );
}

export function Home() {
  const t = useT(T);
  const state = useGenesis();
  const s = state.data;
  const loading = Boolean(deployment) && !s;
  return (
    <>
      <Hero s={s} t={t} />
      <Numbers s={s} loading={loading} t={t} />
      <Pro t={t} />
      <Price s={s} t={t} />
      <Plans s={s} t={t} />
      <Trust s={s} t={t} />
      <Statement lines={t.refundHead} text={t.refundText} />
      <Statement lines={t.notHead} text={t.notText} alt />
      <How t={t} />
      <Early t={t} />
      <WallSection s={s} t={t} />
      <Faq t={t} />
      <Cta t={t} />
    </>
  );
}
