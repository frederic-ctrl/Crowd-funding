import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { activeRound, deployment, isTestnet, offering } from "../config";
import { EUR, checkPurchase, parseEuro, percentOfCompany, quote } from "../../../shared/offering.js";
import { useHolding, useOfferingState } from "../lib/hooks";
import { confirmSignature } from "../lib/chain";
import { ApiError, preparePurchase, requestTestEuro } from "../lib/api";
import { count, euro, percent, price } from "../lib/format";
import { explorerTx } from "../lib/explorer";
import { useWalletUi } from "../components/Wallet";

const TOTAL = offering.token.totaal;
const SYMBOL = offering.betaalmunt.symbool;

type Phase = "idle" | "preparing" | "signing" | "sending" | "done";

export default function Invest() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { open } = useWalletUi();
  const wallet = publicKey?.toBase58() ?? null;
  const holding = useHolding(wallet, 15_000);
  const state = useOfferingState(20_000);

  const [amount, setAmount] = useState("1");
  const [agreed, setAgreed] = useState({ risk: false, locked: false, demo: !isTestnet });
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [faucet, setFaucet] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });
  const [result, setResult] = useState<{ signature: string; tokens: number; cost: number } | null>(null);

  const eurMicro = parseEuro(amount);
  const q = Number.isFinite(eurMicro) ? quote(activeRound, eurMicro) : { tokens: 0, cost: 0, rest: 0 };
  const heldTokens = Number(holding.data?.tokens ?? 0n);
  const vault = state.data?.vaults[activeRound.id];
  const live = useMemo(
    () =>
      checkPurchase({
        round: activeRound,
        eurMicro,
        heldTokens,
        vaultRemaining: vault ? Number(vault.amount) : activeRound.tokens,
        balanceMicro: holding.data ? Number(holding.data.paymentMicro) : undefined,
      }),
    [eurMicro, heldTokens, vault, holding.data],
  );

  const balance = holding.data ? Number(holding.data.paymentMicro) : null;
  const needsFunds = balance !== null && balance < q.cost;
  const allAgreed = agreed.risk && agreed.locked && agreed.demo;
  const busy = phase === "preparing" || phase === "signing" || phase === "sending";
  const canBuy = Boolean(wallet && signTransaction && deployment) && live.length === 0 && allAgreed && !busy;

  async function getTestEuro() {
    if (!wallet) return;
    setFaucet({ busy: true, msg: "" });
    try {
      const res = await requestTestEuro(wallet);
      setFaucet({ busy: false, msg: `Je kreeg ${euro(res.amountMicro)} ${SYMBOL}.` });
      holding.refresh();
    } catch (err) {
      setFaucet({ busy: false, msg: err instanceof Error ? err.message : "Testgeld lukte niet." });
    }
  }

  async function buy() {
    if (!wallet || !signTransaction) return;
    setErrors([]);
    setPhase("preparing");
    try {
      const prepared = await preparePurchase(wallet, amount, activeRound.id);
      setPhase("signing");
      const tx = Transaction.from(Uint8Array.from(atob(prepared.transaction), (c) => c.charCodeAt(0)));
      const signed = await signTransaction(tx);
      setPhase("sending");
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await confirmSignature(connection, signature);
      setResult({ signature, tokens: prepared.tokens, cost: prepared.cost });
      setPhase("done");
      holding.refresh();
      state.refresh();
    } catch (err) {
      setPhase("idle");
      if (err instanceof ApiError) setErrors(err.messages);
      else if (err instanceof Error && /reject|declin|cancel/i.test(err.message)) setErrors(["Je hebt de transactie geannuleerd in je wallet. Er is niets gebeurd."]);
      else setErrors([err instanceof Error ? err.message : "De aankoop lukte niet. Er is niets afgeschreven."]);
    }
  }

  if (!deployment) {
    return (
      <>
        <PageHero />
        <div className="container page-body narrow">
          <p className="notice"><strong>De demo is nog niet geactiveerd.</strong> Zodra de token op het testnet staat, kan je hier investeren vanaf €1.</p>
        </div>
      </>
    );
  }

  if (phase === "done" && result) {
    return (
      <>
        <PageHero />
        <div className="container page-body narrow">
          <div className="card success">
            <span className="success-mark" aria-hidden="true">✓</span>
            <h2>Welkom als mede-eigenaar</h2>
            <p className="muted">
              Je kocht {count(result.tokens)} aandelen voor {euro(result.cost)} ({SYMBOL}). Dat is {percent(result.tokens, TOTAL)} van Marketing Scan.
            </p>
            <div className="hero-ctas" style={{ justifyContent: "center" }}>
              <Link className="btn" to="/portefeuille">Naar mijn portefeuille</Link>
              <a className="btn btn-ghost" href={explorerTx(result.signature)} target="_blank" rel="noreferrer">Bekijk de transactie</a>
            </div>
            <button type="button" className="link-button" onClick={() => { setPhase("idle"); setResult(null); }}>Nog eens investeren</button>
          </div>
        </div>
      </>
    );
  }

  const step1Done = Boolean(wallet);
  const step2Done = step1Done && !needsFunds && balance !== null;

  return (
    <>
      <PageHero />
      <div className="container page-body">
        <div className="invest">
          <div className="flow">
            <section className={`flow-step ${step1Done ? "done" : "current"}`} aria-labelledby="s1">
              <div className="flow-step-head">
                <span className="flow-num">{step1Done ? "✓" : "1"}</span>
                <h2 id="s1" style={{ fontSize: "1.2rem" }}>Log in met je wallet</h2>
              </div>
              {wallet ? (
                <p className="muted">Ingelogd als <span className="mono">{wallet}</span></p>
              ) : (
                <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
                  <p className="muted">Phantom, Solflare of Backpack. Je wallet is je login: geen wachtwoord, geen account.</p>
                  <button type="button" className="btn" onClick={open}>Inloggen met wallet</button>
                </div>
              )}
            </section>

            {isTestnet && (
              <section className={`flow-step ${!step1Done ? "locked" : step2Done ? "done" : "current"}`} aria-labelledby="s2">
                <div className="flow-step-head">
                  <span className="flow-num">{step2Done ? "✓" : "2"}</span>
                  <h2 id="s2" style={{ fontSize: "1.2rem" }}>Ontvang test-euro</h2>
                </div>
                <p className="muted">
                  Op het testnet betaal je met test-euro ({SYMBOL}) zonder waarde. De transactiekosten betalen wij. Saldo:{" "}
                  <strong>{balance === null ? "-" : `${euro(balance)} ${SYMBOL}`}</strong>
                </p>
                {step1Done && (
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" className={`btn ${needsFunds ? "" : "btn-ghost"}`} onClick={getTestEuro} disabled={faucet.busy}>
                      {faucet.busy ? "Even geduld..." : `Ontvang 50 ${SYMBOL}`}
                    </button>
                    {faucet.msg && <span className="muted" role="status">{faucet.msg}</span>}
                  </div>
                )}
              </section>
            )}

            <section className={`flow-step ${!step1Done ? "locked" : "current"}`} aria-labelledby="s3">
              <div className="flow-step-head">
                <span className="flow-num">{isTestnet ? "3" : "2"}</span>
                <h2 id="s3" style={{ fontSize: "1.2rem" }}>Kies je bedrag</h2>
              </div>
              <label className="sr-only" htmlFor="bedrag">Bedrag in euro</label>
              <div className="amount">
                <span>€</span>
                <input id="bedrag" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="chips" role="group" aria-label="Snelle bedragen">
                {[1, 10, 25, 50, 250].map((v) => (
                  <button key={v} type="button" className="chip" onClick={() => setAmount(String(v))}>€{v}</button>
                ))}
              </div>
              {wallet && live.length > 0 && Number.isFinite(eurMicro) && (
                <ul className="errors">{live.map((e) => <li key={e}>{e}</li>)}</ul>
              )}
              <p className="muted" style={{ fontSize: "0.92rem" }}>
                Minimum €{activeRound.minimumEur}
                {activeRound.maxPerPersoonEur ? `, maximum ${euro(activeRound.maxPerPersoonEur * EUR, { whole: true })} per persoon` : ""}. Je koopt hele aandelen; een rest van minder dan één aandeel blijft bij jou.
              </p>
            </section>

            <section className={`flow-step ${!step1Done ? "locked" : "current"}`} aria-labelledby="s4">
              <div className="flow-step-head">
                <span className="flow-num">{isTestnet ? "4" : "3"}</span>
                <h2 id="s4" style={{ fontSize: "1.2rem" }}>Bevestig</h2>
              </div>
              <div className="agree">
                <label htmlFor="a-risk">
                  <input id="a-risk" type="checkbox" checked={agreed.risk} onChange={(e) => setAgreed({ ...agreed, risk: e.target.checked })} />
                  <span>Ik begrijp dat ik mijn volledige inleg kan verliezen. <Link to="/#risicos">Lees de risico's</Link></span>
                </label>
                <label htmlFor="a-locked">
                  <input id="a-locked" type="checkbox" checked={agreed.locked} onChange={(e) => setAgreed({ ...agreed, locked: e.target.checked })} />
                  <span>Ik begrijp dat mijn aandelen vergrendeld zijn en niet vrij verhandelbaar.</span>
                </label>
                {isTestnet && (
                  <label htmlFor="a-demo">
                    <input id="a-demo" type="checkbox" checked={agreed.demo} onChange={(e) => setAgreed({ ...agreed, demo: e.target.checked })} />
                    <span>Ik begrijp dat dit een demo op het testnet is, zonder echte aandelen of waarde.</span>
                  </label>
                )}
              </div>
              {errors.length > 0 && <ul className="errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              <button type="button" className="btn btn-large btn-block" disabled={!canBuy} onClick={buy}>
                {phase === "preparing" && "Aankoop voorbereiden..."}
                {phase === "signing" && "Bevestig in je wallet..."}
                {phase === "sending" && "Bevestigen op Solana..."}
                {phase === "idle" && (q.tokens > 0 ? `Koop ${count(q.tokens)} aandelen voor ${euro(q.cost)}` : "Koop aandelen")}
              </button>
              <p className="muted" style={{ fontSize: "0.88rem" }}>
                Je wallet toont exact wat er gebeurt: {euro(q.cost)} {SYMBOL} van jou naar de escrow, {count(q.tokens)} aandelen van de kluis naar jou. In één transactie: lukt één deel niet, dan gebeurt er niets.
              </p>
            </section>
          </div>

          <aside className="summary" aria-label="Samenvatting">
            <div className="summary-card">
              <span className="muted" style={{ color: "var(--on-night-muted)" }}>Je krijgt</span>
              <span className="summary-big">{count(q.tokens)} aandelen</span>
              <dl>
                <div><dt>Je betaalt</dt><dd>{euro(q.cost)}</dd></div>
                <div><dt>Prijs per aandeel</dt><dd>{price(activeRound.prijsPerTokenMicro)}</dd></div>
                <div><dt>Deel van Marketing Scan</dt><dd>{percent(q.tokens, TOTAL)}</dd></div>
                <div><dt>Na deze aankoop heb je</dt><dd>{count(heldTokens + q.tokens)} aandelen</dd></div>
                <div><dt>Ronde</dt><dd>{activeRound.naam} ({percentOfCompany(activeRound.tokens, TOTAL)}%)</dd></div>
              </dl>
            </div>
            <p className="notice">
              <strong>{isTestnet ? "Testnet-demo." : "Risico."}</strong>{" "}
              {isTestnet
                ? "Er is nog geen echte aanbieding. Marketing Scan wordt eerst een vennootschap, daarna volgen de documenten."
                : "Je kan je volledige inleg verliezen."}
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}

function PageHero() {
  return (
    <section className="page-hero">
      <div className="container">
        <p className="eyebrow" style={{ color: "var(--pill)" }}>{activeRound.naam} · {activeRound.label}</p>
        <h1>Investeren vanaf €1</h1>
        <p>{price(activeRound.prijsPerTokenMicro)} per aandeel. Voor €1 krijg je {count(Math.floor(EUR / activeRound.prijsPerTokenMicro))} aandelen in je eigen wallet.</p>
      </div>
    </section>
  );
}
