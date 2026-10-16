import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AGENCY, COINS, PASS, deployment, genesis } from "../config";
import { formatNumber } from "../../../shared/genesis.js";
import { useAsync, useGenesis } from "../lib/hooks";
import { ago, coinAmount, count, dateTime, euro, shortAddress } from "../lib/format";
import { explorerAddress, explorerTx } from "../lib/explorer";
import { verifyInBrowser, verifyPasses } from "../lib/chain";
import type { GenesisEvent, GenesisState } from "../lib/api";
import { Address, Bar, Reveal, State } from "../components/ui";
import { buffersGedekt, eventLabel, goalMicro, kassenKloppen, perCoin, view } from "../components/genesis";
import { useLang, useT } from "../i18n";

const T = {
  en: {
    title: "Every euro. On-chain.",
    sub: "Every pass, payment and refund is public on Solana. This page reads it live, and your own browser can recompute it all.",
    notActive: "Genesis isn’t active on this network yet.",
    loadFailed: "Couldn’t load.",
    raised: (pct: number) => `raised · ${pct}% of the ${euro(goalMicro(), { whole: true })} goal`,
    kas: "In the treasury",
    kasNote: (coins: string) => `Live balance: ${coins}`,
    refunded: "Refunded",
    refundedNote: (n: number) => `${n} ${n === 1 ? "pass" : "passes"} returned`,
    withdrawn: "Withdrawn by the founder",
    withdrawnNote: "only after the refund window",
    checks: "Checks",
    checkedAgo: (a: string) => `Last checked ${a}.`,
    checking: "Checking…",
    c: {
      kas: ["The treasury matches the history.", (a: string, b: string) => `Everything in, minus refunds and withdrawals: ${a}. Live balance: ${b}.`],
      buffer: ["Refunds are covered.", (a: string) => `Purchases within the refund window: ${a}. That stays in the treasury.`],
      unique: ["Every pass is unique and soulbound.", (n: number) => `${n} passes checked: supply of one (zero if refunded), no minting, no freezing, non-transferable.`],
      order: ["Numbers in order.", (p: string, a: string) => `Genesis Pass: highest number ${p} of ${PASS.max}. Agency: ${a} of ${AGENCY.max}.`],
    },
    verifyTitle: "Recompute it yourself.",
    verifyText: "The numbers on this site come from our server. This button makes your browser read the full treasury history straight from Solana and recompute everything, without our server.",
    verifyBtn: "Verify in my browser",
    verifying: "Reading the chain…",
    same: "Everything matches.",
    sameText: "Your browser arrives at exactly the same numbers.",
    diff: "There’s a difference.",
    diffText: "Let us know, or check the transactions below yourself.",
    you: "Your browser",
    site: "This site",
    lines: ["Genesis Passes sold", "Agency sold", "Raised", "Refunded", "Withdrawn"],
    kasLine: (sym: string) => `Treasury ${sym}`,
    ledger: "Ledger.",
    ledgerNote: "Every movement in the treasury, newest first. Only transactions signed by the server key count.",
    cols: ["Date", "What", "Wallet", "Amount", "Transaction"],
    empty: "No movements yet.",
    loading: "Loading…",
    kinds: { aankoop: "Purchase", steun: "Support", terugbetaling: "Refund", opname: "Founder withdrawal" },
    addresses: "Addresses.",
    addr: {
      kas: (sym: string) => `Treasury ${sym} (payments)`,
      authority: "Server key (creates passes, pays fees, manages the treasury)",
      founder: "Founder wallet",
      founderAcc: (sym: string) => `Founder account ${sym} (withdrawals)`,
      badge: `Supporter badge (${genesis.steun.symbool})`,
      payment: (sym: string) => `Payment coin ${sym}`,
      program: "Pass token program (Token-2022)",
    },
    howTitle: "How it works.",
    how: [
      ["Every pass is its own token.", "When you buy, the token for your number is created, exactly one goes to your wallet, and minting is disabled in the same transaction."],
      ["A number exists once.", "Each number has a fixed address. If two people try the same number at once, the blockchain lets only one through."],
      ["Soulbound.", "Passes use Token-2022’s NonTransferable extension: they can’t leave your wallet. There is no freeze authority."],
      ["Refunds.", `Within ${genesis.bedenktijdDagen} days you burn your pass and get everything back from the treasury in the same transaction. Recent purchases stay in the treasury until the window closes.`],
      ["Withdrawals.", "The founder only withdraws money outside the refund window, and every withdrawal is in the ledger with a fixed memo."],
    ],
  },
  nl: {
    title: "Elke euro. Op de blockchain.",
    sub: "Elke pass, betaling en terugbetaling staat publiek op Solana. Deze pagina leest het live, en je eigen browser kan alles narekenen.",
    notActive: "Genesis is nog niet actief op dit netwerk.",
    loadFailed: "Laden lukte niet.",
    raised: (pct: number) => `opgehaald · ${pct}% van het doel van ${euro(goalMicro(), { whole: true })}`,
    kas: "In de kas",
    kasNote: (coins: string) => `Live saldo: ${coins}`,
    refunded: "Teruggestort",
    refundedNote: (n: number) => `${n} ${n === 1 ? "pass" : "passes"} teruggegeven`,
    withdrawn: "Opgenomen door de oprichter",
    withdrawnNote: "enkel na de bedenktijd",
    checks: "Controles",
    checkedAgo: (a: string) => `Laatst gecontroleerd ${a}.`,
    checking: "Bezig…",
    c: {
      kas: ["De kas klopt met de geschiedenis.", (a: string, b: string) => `Alles wat binnenkwam, min terugbetalingen en opnames: ${a}. Live saldo: ${b}.`],
      buffer: ["Geld terug is gedekt.", (a: string) => `Aankopen binnen de bedenktijd: ${a}. Dat blijft in de kas.`],
      unique: ["Elke pass is uniek en soulbound.", (n: number) => `${n} passes nagekeken: voorraad één (nul als teruggegeven), geen muntrecht, geen bevriesrecht, niet overdraagbaar.`],
      order: ["Nummers in volgorde.", (p: string, a: string) => `Genesis Pass: hoogste nummer ${p} van ${PASS.max}. Agency: ${a} van ${AGENCY.max}.`],
    },
    verifyTitle: "Reken het zelf na.",
    verifyText: "De cijfers op deze site komen van onze server. Met deze knop leest je browser de volledige geschiedenis van de kas rechtstreeks van Solana en rekent alles opnieuw uit, zonder onze server.",
    verifyBtn: "Controleer in mijn browser",
    verifying: "De blockchain lezen…",
    same: "Alles klopt.",
    sameText: "Je browser komt tot exact dezelfde cijfers.",
    diff: "Er is een verschil.",
    diffText: "Laat het ons weten, of kijk zelf in de transacties hieronder.",
    you: "Je browser",
    site: "Deze site",
    lines: ["Genesis Passes verkocht", "Agency verkocht", "Opgehaald", "Teruggestort", "Opgenomen"],
    kasLine: (sym: string) => `Kas ${sym}`,
    ledger: "Kasboek.",
    ledgerNote: "Elke beweging in de kas, nieuwste eerst. Enkel transacties die de serversleutel ondertekende tellen mee.",
    cols: ["Datum", "Wat", "Wallet", "Bedrag", "Transactie"],
    empty: "Nog geen bewegingen.",
    loading: "Laden…",
    kinds: { aankoop: "Aankoop", steun: "Steun", terugbetaling: "Geld terug", opname: "Opname oprichter" },
    addresses: "Adressen.",
    addr: {
      kas: (sym: string) => `Kas ${sym} (betalingen)`,
      authority: "Serversleutel (maakt passen aan, betaalt kosten, beheert de kas)",
      founder: "Wallet van de oprichter",
      founderAcc: (sym: string) => `Rekening van de oprichter in ${sym} (opnames)`,
      badge: `Supporter-badge (${genesis.steun.symbool})`,
      payment: (sym: string) => `Betaalmunt ${sym}`,
      program: "Token-programma van de passes (Token-2022)",
    },
    howTitle: "Hoe het werkt.",
    how: [
      ["Elke pass is een eigen token.", "Bij je aankoop wordt de token van jouw nummer aangemaakt, er gaat precies één naar je wallet en het muntrecht wordt in dezelfde transactie ingetrokken."],
      ["Een nummer bestaat één keer.", "Elk nummer heeft een vast adres. Proberen twee mensen tegelijk hetzelfde nummer, dan laat de blockchain er maar één toe."],
      ["Soulbound.", "De passes gebruiken de extensie NonTransferable van Token-2022: ze kunnen je wallet niet verlaten. Er is geen bevriesrecht."],
      ["Geld terug.", `Binnen ${genesis.bedenktijdDagen} dagen verbrand je je pass en krijg je alles terug uit de kas, in dezelfde transactie. Recente aankopen blijven in de kas tot de bedenktijd voorbij is.`],
      ["Opnames.", "De oprichter neemt enkel geld op dat buiten de bedenktijd valt, en elke opname staat met een vaste memo in het kasboek."],
    ],
  },
};

function signed(e: GenesisEvent) {
  const coin = COINS.find((c) => c.id === e.munt);
  return (
    <>
      {e.kind === "aankoop" || e.kind === "steun" ? "+ " : "− "}
      {euro(e.eurMicro)}
      {coin && <small className="muted coin-note">{coinAmount(e.amountMicro, coin)}</small>}
    </>
  );
}

/** Wat er in de kassen zit, omgerekend naar euro (USDC aan de koers van vandaag). */
function kassenInEuro(s: GenesisState): number | null {
  let total = 0;
  for (const c of COINS) {
    const micro = s.kassen[c.id] ?? 0;
    if (c.valuta === "EUR") total += micro;
    else if (s.koers) total += Math.round(micro / s.koers.eurUsd);
    else if (micro > 0) return null;
  }
  return total;
}

export default function Transparency() {
  const t = useT(T);
  const { lang } = useLang();
  const { connection } = useConnection();
  const state = useGenesis(15_000);
  const s = state.data;
  const v = view(s);
  const passes = (s?.muur ?? []).filter((e) => e.kind === "aankoop" && e.mint).map((e) => ({ mint: e.mint!, teruggegeven: e.teruggegeven, label: eventLabel(e, lang) }));
  const passCheck = useAsync(s ? () => verifyPasses(connection, passes) : null, [connection, passes.map((p) => p.mint + (p.teruggegeven ? "x" : "")).join()]);
  const [browser, setBrowser] = useState<{ busy: boolean; result: null | { same: boolean; lines: [string, string, string, boolean][] }; error: string }>({ busy: false, result: null, error: "" });

  async function runBrowserCheck() {
    if (!deployment || !s) return;
    setBrowser({ busy: true, result: null, error: "" });
    try {
      const mine = await verifyInBrowser(connection, deployment, genesis);
      const pairs: [number, number, (n: number) => string][] = [
        [mine.producten.pass.verkocht, s.producten.pass.verkocht, count],
        [mine.producten.agency.verkocht, s.producten.agency.verkocht, count],
        [mine.opgehaaldMicro, s.opgehaaldMicro, (n) => euro(n)],
        [mine.terugbetaaldMicro, s.terugbetaaldMicro, (n) => euro(n)],
        [mine.opgenomenMicro, s.opgenomenMicro, (n) => euro(n)],
      ];
      const lines = pairs.map(([a, b, f], i) => [t.lines[i], f(a), f(b), a === b] as [string, string, string, boolean]);
      for (const coin of COINS) {
        const a = mine.perMunt[coin.id]?.verwachteKasMicro ?? 0;
        const b = s.kassen[coin.id] ?? 0;
        lines.push([t.kasLine(coin.symbool), coinAmount(a, coin), coinAmount(b, coin), a === b]);
      }
      setBrowser({ busy: false, result: { same: lines.every((l) => l[3]), lines }, error: "" });
    } catch (err) {
      setBrowser({ busy: false, result: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const c = passCheck.data;
  const st = (ok: boolean | null): "ok" | "wait" | "bad" => (ok === null ? "wait" : ok ? "ok" : "bad");
  const pct = s ? Math.floor((s.opgehaaldMicro / goalMicro()) * 100) : 0;
  const kasEur = s ? kassenInEuro(s) : null;
  const expected = Object.fromEntries(Object.entries(s?.perMunt ?? {}).map(([id, m]) => [id, m?.verwachteKasMicro ?? 0]));

  return (
    <>
      <header className="page-head">
        <div className="container">
          <h1>{t.title}</h1>
          <p>{t.sub}</p>
        </div>
      </header>
      <div className="container wide page">
        {!deployment ? (
          <p className="notice">{t.notActive}</p>
        ) : (
          <>
            {state.error && <p className="notice bad"><strong>{t.loadFailed}</strong> {state.error}</p>}
            <Reveal className="raised">
              <b>{s ? euro(s.opgehaaldMicro) : "–"}</b>
              <span>{t.raised(pct)}</span>
              <Bar value={s?.opgehaaldMicro ?? 0} max={goalMicro()} />
            </Reveal>

            <div className="kpis">
              <div className="kpi"><span>{t.kas}</span><b>{s && kasEur !== null ? euro(kasEur) : "–"}</b><small>{s ? t.kasNote(perCoin(s.kassen)) : ""}</small></div>
              <div className="kpi"><span>{t.refunded}</span><b>{s ? euro(s.terugbetaaldMicro) : "–"}</b><small>{s ? t.refundedNote(s.producten.pass.teruggegeven + s.producten.agency.teruggegeven) : ""}</small></div>
              <div className="kpi"><span>{t.withdrawn}</span><b>{s ? euro(s.opgenomenMicro) : "–"}</b><small>{t.withdrawnNote}</small></div>
            </div>

            <section aria-labelledby="h-checks">
              <h2 id="h-checks" className="block-title">{t.checks}</h2>
              <ul className="checklist">
                <li>
                  <State state={st(s ? kassenKloppen(s) : null)}><span className="sr-only">status</span></State>
                  <h3>{t.c.kas[0] as string}</h3>
                  <p>{s ? (t.c.kas[1] as (a: string, b: string) => string)(perCoin(expected), perCoin(s.kassen)) : t.checking}</p>
                </li>
                <li>
                  <State state={st(s ? buffersGedekt(s, v.buffers) : null)}><span className="sr-only">status</span></State>
                  <h3>{t.c.buffer[0] as string}</h3>
                  <p>{s ? (t.c.buffer[1] as (a: string) => string)(perCoin(v.buffers)) : t.checking}</p>
                </li>
                <li>
                  <State state={st(c ? c.problems.length === 0 : null)}><span className="sr-only">status</span></State>
                  <h3>{t.c.unique[0] as string}</h3>
                  <p>{c ? (c.problems.length === 0 ? (t.c.unique[1] as (n: number) => string)(c.ok) : c.problems.join(" ")) : t.checking}</p>
                </li>
                <li>
                  <State state={st(s ? true : null)}><span className="sr-only">status</span></State>
                  <h3>{t.c.order[0] as string}</h3>
                  <p>{s ? (t.c.order[1] as (p: string, a: string) => string)(formatNumber(PASS, s.producten.pass.hoogsteNummer), formatNumber(AGENCY, s.producten.agency.hoogsteNummer)) : t.checking}</p>
                </li>
              </ul>
              <p className="fine" style={{ marginTop: 12 }}>{state.updatedAt ? t.checkedAgo(ago(state.updatedAt)) : t.checking}</p>
            </section>

            <section className="verify" aria-labelledby="h-verify">
              <h2 id="h-verify">{t.verifyTitle}</h2>
              <p>{t.verifyText}</p>
              <button type="button" className="btn" onClick={runBrowserCheck} disabled={browser.busy || !s}>{browser.busy ? t.verifying : t.verifyBtn}</button>
              {browser.error && <p className="notice bad">{browser.error}</p>}
              {browser.result && (
                <>
                  <p className={`notice ${browser.result.same ? "ok" : "bad"}`}><strong>{browser.result.same ? t.same : t.diff}</strong> {browser.result.same ? t.sameText : t.diffText}</p>
                  <div className="table-wrap" style={{ width: "100%" }}>
                    <table>
                      <thead><tr><th></th><th className="r">{t.you}</th><th className="r">{t.site}</th></tr></thead>
                      <tbody>
                        {browser.result.lines.map(([label, a, b, same]) => (
                          <tr key={label}><td>{same ? "✓" : "!"} {label}</td><td className="r">{a}</td><td className="r">{b}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section aria-labelledby="h-ledger">
              <h2 id="h-ledger" className="block-title">{t.ledger}</h2>
              <p className="fine" style={{ marginBottom: 18 }}>{t.ledgerNote}</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>{t.cols.map((col, i) => <th key={col} className={i === 3 ? "r" : ""}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!s && <tr><td colSpan={5} className="empty">{t.loading}</td></tr>}
                    {s?.gebeurtenissen.length === 0 && <tr><td colSpan={5} className="empty">{t.empty}</td></tr>}
                    {s?.gebeurtenissen.map((e) => (
                      <tr key={e.signature}>
                        <td>{dateTime(e.time)}</td>
                        <td className="wrap">{t.kinds[e.kind]}{e.kind === "aankoop" || e.kind === "terugbetaling" ? ` · ${eventLabel(e, lang)}` : ""}{e.name ? <span className="muted"> · {e.name}</span> : null}</td>
                        <td><a className="mono" href={`/mijn-pass?adres=${e.wallet}`}>{shortAddress(e.wallet)}</a></td>
                        <td className={`r ${e.kind === "aankoop" || e.kind === "steun" ? "in" : "out"}`}>{signed(e)}</td>
                        <td><a className="mono" href={explorerTx(e.signature)} target="_blank" rel="noreferrer">{shortAddress(e.signature, 6)}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="h-addr">
              <h2 id="h-addr" className="block-title">{t.addresses}</h2>
              <dl className="group stack" style={{ background: "var(--bg-alt)" }}>
                {COINS.map((c) => <div key={`kas-${c.id}`}><dt>{t.addr.kas(c.symbool)}</dt><dd><Address value={c.kas} /></dd></div>)}
                <div><dt>{t.addr.authority}</dt><dd><Address value={deployment.authority} /></dd></div>
                <div><dt>{t.addr.founder}</dt><dd><Address value={deployment.founderWallet} /></dd></div>
                {COINS.map((c) => <div key={`fa-${c.id}`}><dt>{t.addr.founderAcc(c.symbool)}</dt><dd><Address value={c.founderAccount} /></dd></div>)}
                <div><dt>{t.addr.badge}</dt><dd><Address value={deployment.supporterMint} /></dd></div>
                {COINS.map((c) => <div key={`mint-${c.id}`}><dt>{t.addr.payment(c.symbool)}</dt><dd><Address value={c.mint} /></dd></div>)}
                <div><dt>{t.addr.program}</dt><dd><Address value={deployment.passProgram} /></dd></div>
              </dl>
              <p className="fine" style={{ marginTop: 12 }}><a href={explorerAddress(deployment.authority)} target="_blank" rel="noreferrer">Solana Explorer ›</a></p>
            </section>

            <section aria-labelledby="h-how">
              <h2 id="h-how" className="block-title">{t.howTitle}</h2>
              <ul className="how">
                {t.how.map(([title, text]) => (
                  <li key={title}><b>{title}</b><span>{text}</span></li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}
