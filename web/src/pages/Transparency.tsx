import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AGENCY, PASS, SYMBOL, deployment, genesis } from "../config";
import { useAsync, useGenesis, useNow } from "../lib/hooks";
import { ago, count, dateTime, euro, shortAddress } from "../lib/format";
import { explorerAddress, explorerTx } from "../lib/explorer";
import { verifyInBrowser, verifyPasses } from "../lib/chain";
import type { GenesisEvent } from "../lib/api";
import { Address, Check, Progress } from "../components/ui";
import { eventLabel, goalMicro, view } from "../components/genesis";

const KIND: Record<GenesisEvent["kind"], string> = { aankoop: "Aankoop", steun: "Steun", terugbetaling: "Geld terug", opname: "Opname oprichter" };

function signed(e: GenesisEvent) {
  return e.kind === "aankoop" || e.kind === "steun" ? `+ ${euro(e.amountMicro)}` : `- ${euro(e.amountMicro)}`;
}

export default function Transparency() {
  const { connection } = useConnection();
  const state = useGenesis(15_000);
  useNow();
  const s = state.data;
  const v = view(s);
  const passes = (s?.muur ?? []).filter((e) => e.kind === "aankoop" && e.mint).map((e) => ({ mint: e.mint!, teruggegeven: e.teruggegeven, label: eventLabel(e) }));
  const passCheck = useAsync(s ? () => verifyPasses(connection, passes) : null, [connection, passes.map((p) => p.mint + (p.teruggegeven ? "x" : "")).join()]);
  const [browser, setBrowser] = useState<{ busy: boolean; result: null | { same: boolean; lines: [string, string, string, boolean][] }; error: string }>({ busy: false, result: null, error: "" });

  async function runBrowserCheck() {
    if (!deployment || !s) return;
    setBrowser({ busy: true, result: null, error: "" });
    try {
      const mine = await verifyInBrowser(connection, deployment, genesis);
      const lines: [string, string, string, boolean][] = [
        ["Genesis Passes verkocht", count(mine.producten.pass.verkocht), count(s.producten.pass.verkocht), mine.producten.pass.verkocht === s.producten.pass.verkocht],
        ["Agency verkocht", count(mine.producten.agency.verkocht), count(s.producten.agency.verkocht), mine.producten.agency.verkocht === s.producten.agency.verkocht],
        ["Opgehaald", euro(mine.opgehaaldMicro), euro(s.opgehaaldMicro), mine.opgehaaldMicro === s.opgehaaldMicro],
        ["Teruggestort", euro(mine.terugbetaaldMicro), euro(s.terugbetaaldMicro), mine.terugbetaaldMicro === s.terugbetaaldMicro],
        ["Opgenomen", euro(mine.opgenomenMicro), euro(s.opgenomenMicro), mine.opgenomenMicro === s.opgenomenMicro],
        ["Verwacht in de kas", euro(mine.verwachteKasMicro), euro(s.kasMicro), mine.verwachteKasMicro === s.kasMicro],
      ];
      setBrowser({ busy: false, result: { same: lines.every((l) => l[3]), lines }, error: "" });
    } catch (err) {
      setBrowser({ busy: false, result: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const c = passCheck.data;
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--pill)" }}>Transparantie</p>
          <h1>Vertrouw ons niet. Controleer het.</h1>
          <p>Elke pass, elke euro en elke terugbetaling staat publiek op Solana. Deze pagina leest het live uit, en met één klik rekent je eigen browser alles na.</p>
        </div>
      </section>
      <div className="container page-body">
        {!deployment ? (
          <p className="notice"><strong>Genesis is nog niet geactiveerd op dit netwerk.</strong> Zodra alles op het testnet staat, verschijnen hier alle controles.</p>
        ) : (
          <>
            {state.error && <p className="notice notice-bad"><strong>Laden lukte niet.</strong> {state.error}</p>}
            <div className="stat-cards">
              <div className="stat-card is-main">
                <span>Opgehaald</span>
                <b>{s ? euro(s.opgehaaldMicro) : "-"}</b>
                <Progress value={s?.opgehaaldMicro ?? 0} max={goalMicro()} onPaper labels={[<span key="a">doel {euro(goalMicro(), { whole: true })}</span>, <span key="b">{s ? `${Math.floor((s.opgehaaldMicro / goalMicro()) * 100)}%` : ""}</span>]} />
              </div>
              <div className="stat-card"><span>In de kas</span><b>{s ? euro(s.kasMicro) : "-"}</b><small>{SYMBOL}, live saldo</small></div>
              <div className="stat-card"><span>Teruggestort</span><b>{s ? euro(s.terugbetaaldMicro) : "-"}</b><small>{s ? `${s.producten.pass.teruggegeven + s.producten.agency.teruggegeven} passes teruggegeven` : ""}</small></div>
              <div className="stat-card"><span>Opgenomen door de oprichter</span><b>{s ? euro(s.opgenomenMicro) : "-"}</b><small>enkel na de bedenktijd</small></div>
            </div>

            <div className="trans-grid">
              <section aria-labelledby="h-controles">
                <h2 id="h-controles" style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Controles</h2>
                <ul className="checks">
                  <Check state={!s ? "wait" : s.kasMicro === s.verwachteKasMicro ? "ok" : "bad"} title="De kas klopt met de geschiedenis" link={{ href: explorerAddress(deployment.kas), label: "Kas" }}>
                    {s ? `Binnen min terug min opgenomen: ${euro(s.verwachteKasMicro)}. Live saldo: ${euro(s.kasMicro)}.` : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={!s ? "wait" : s.kasMicro >= v.bufferMicro ? "ok" : "bad"} title="Geld terug is gedekt">
                    {s ? `Aankopen binnen de bedenktijd: ${euro(v.bufferMicro)}. Die blijven in de kas.` : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={!c ? "wait" : c.problems.length === 0 ? "ok" : "bad"} title="Elke pass is uniek en soulbound">
                    {c ? (c.problems.length === 0 ? `${count(c.ok)} passes nagekeken: voorraad 1 (0 als teruggegeven), geen muntrecht, geen bevriesrecht, niet overdraagbaar.` : c.problems.join(" ")) : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={!s ? "wait" : "ok"} title="Nummers in volgorde">
                    {s ? `Genesis Pass: hoogste nummer #${String(s.producten.pass.hoogsteNummer).padStart(3, "0")} van ${PASS.max}. Agency: #${String(s.producten.agency.hoogsteNummer).padStart(2, "0")} van ${AGENCY.max}.` : "Wordt gecontroleerd."}
                  </Check>
                </ul>
                <p className="muted" style={{ fontSize: "0.88rem", marginTop: "0.75rem" }}>{state.updatedAt ? `Laatst gecontroleerd ${ago(state.updatedAt)}.` : "Bezig met controleren..."}</p>
              </section>

              <section className="card" aria-labelledby="h-zelf">
                <h2 id="h-zelf" style={{ fontSize: "1.3rem" }}>Reken het zelf na</h2>
                <p className="muted">De cijfers op deze site komen van onze server. Met deze knop leest je browser de volledige geschiedenis van de kas rechtstreeks van Solana en rekent alles opnieuw uit, zonder onze server.</p>
                <button type="button" className="btn" onClick={runBrowserCheck} disabled={browser.busy || !s}>{browser.busy ? "Bezig met nalezen..." : "Controleer in mijn browser"}</button>
                {browser.error && <p className="notice notice-bad">{browser.error}</p>}
                {browser.result && (
                  <>
                    <p className={`notice ${browser.result.same ? "notice-ok" : "notice-bad"}`}>
                      <strong>{browser.result.same ? "Alles klopt." : "Er is een verschil."}</strong> {browser.result.same ? "Je browser komt tot exact dezelfde cijfers." : "Meld het ons, of kijk zelf in de transacties hieronder."}
                    </p>
                    <div className="table-wrap" style={{ border: 0 }}>
                      <table>
                        <thead><tr><th></th><th className="r">Je browser</th><th className="r">Deze site</th></tr></thead>
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
            </div>

            <section className="card" aria-labelledby="h-boek">
              <h2 id="h-boek" style={{ fontSize: "1.3rem" }}>Kasboek</h2>
              <p className="muted" style={{ fontSize: "0.92rem" }}>Elke beweging in de kas, nieuwste eerst. Enkel transacties die door de serversleutel ondertekend zijn tellen mee.</p>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead>
                    <tr><th>Datum</th><th>Wat</th><th>Wallet</th><th className="r">Bedrag</th><th>Transactie</th></tr>
                  </thead>
                  <tbody>
                    {!s && <tr><td colSpan={5} className="empty">Laden...</td></tr>}
                    {s?.gebeurtenissen.length === 0 && <tr><td colSpan={5} className="empty">Nog geen bewegingen.</td></tr>}
                    {s?.gebeurtenissen.map((e) => (
                      <tr key={e.signature}>
                        <td>{dateTime(e.time)}</td>
                        <td>{KIND[e.kind]}{e.kind === "aankoop" || e.kind === "terugbetaling" ? ` · ${eventLabel(e)}` : ""}{e.name ? <span className="muted"> · {e.name}</span> : null}</td>
                        <td><a className="mono" href={`/mijn-pass?adres=${e.wallet}`}>{shortAddress(e.wallet)}</a></td>
                        <td className={`r ${e.kind === "aankoop" || e.kind === "steun" ? "in" : "out"}`}>{signed(e)}</td>
                        <td><a className="mono" href={explorerTx(e.signature)} target="_blank" rel="noreferrer">{shortAddress(e.signature, 6)}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card" aria-labelledby="h-adressen">
              <h2 id="h-adressen" style={{ fontSize: "1.3rem" }}>Alle adressen</h2>
              <div className="addr-list">
                <div className="addr-row"><span>Kas (alle betalingen)</span><Address value={deployment.kas} /></div>
                <div className="addr-row"><span>Serversleutel (maakt passen aan, betaalt de kosten, beheert de kas)</span><Address value={deployment.authority} /></div>
                <div className="addr-row"><span>Wallet van de oprichter</span><Address value={deployment.founderWallet} /></div>
                <div className="addr-row"><span>Rekening van de oprichter (opnames)</span><Address value={deployment.founderPaymentAccount} /></div>
                <div className="addr-row"><span>Supporter-badge ({genesis.steun.symbool})</span><Address value={deployment.supporterMint} /></div>
                <div className="addr-row"><span>Betaalmunt ({SYMBOL})</span><Address value={deployment.paymentMint} /></div>
                <div className="addr-row"><span>Token-programma van de passes (Token-2022)</span><Address value={deployment.passProgram} /></div>
              </div>
            </section>

            <section className="card prose-card" aria-labelledby="h-hoe">
              <h2 id="h-hoe" style={{ fontSize: "1.3rem" }}>Hoe dit werkt</h2>
              <ul className="plain-list">
                <li><b>Elke pass is een eigen munt.</b> Bij je aankoop wordt de munt van jouw nummer aangemaakt, er komt precies één exemplaar naar je wallet en het muntrecht wordt in dezelfde transactie ingetrokken.</li>
                <li><b>Een nummer bestaat maar één keer.</b> Het adres van elke pass ligt vast per nummer. Proberen twee mensen tegelijk hetzelfde nummer, dan laat de blockchain er maar één toe.</li>
                <li><b>Soulbound.</b> De passes gebruiken de extensie NonTransferable van Token-2022: ze kunnen je wallet niet verlaten. Er is geen bevriesrecht.</li>
                <li><b>Geld terug.</b> Binnen {genesis.bedenktijdDagen} dagen verbrand je je pass en krijg je in dezelfde transactie alles terug uit de kas. Daarom blijven recente aankopen in de kas tot de bedenktijd voorbij is.</li>
                <li><b>Opnames.</b> De oprichter neemt enkel geld op dat buiten de bedenktijd valt, en elke opname staat met een vaste memo in het kasboek.</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}
