import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AGENCY, PASS, SYMBOL, company, deployment, genesis, isTestnet, network } from "../config";
import { checkPassPurchase, checkSupport, cleanName, formatNumber, parseEuro } from "../../../shared/genesis.js";
import { useBalance, useGenesis } from "../lib/hooks";
import { confirmSignature, decodeTransaction, explainError } from "../lib/chain";
import { ApiError, preparePass, prepareSupport, requestTestEuro } from "../lib/api";
import { euro } from "../lib/format";
import { explorerTx } from "../lib/explorer";
import { useWalletUi } from "../components/Wallet";
import { PassBack, PassCard, view } from "../components/genesis";
import { SpinningPass } from "../components/SpinningPass";

type Choice = "pass" | "agency" | "steun";
type Phase = "idle" | "preparing" | "signing" | "sending" | "done";
type Result = { choice: Choice; number: number | null; label: string; amountMicro: number; signature: string };

const CHOICES: Choice[] = ["pass", "agency", "steun"];

function shareUrl(r: Result) {
  const site = company.communitySite ?? "https://community.marketingscan.be";
  const text =
    r.choice === "steun"
      ? `Ik steun Marketing Scan Genesis: een marketingtool voor kmo's, gebouwd in het openbaar op Solana. Geen investering, wel een mooie missie.`
      : `Ik heb Marketing Scan ${r.label}: levenslang Marketing Scan Pro, soulbound op Solana. Geen investering, gewoon mijn marketingtool.`;
  return `https://x.com/intent/post?text=${encodeURIComponent(`${text}${isTestnet ? " (testnet-demo)" : ""}`)}&url=${encodeURIComponent(`${site}/genesis`)}`;
}

export default function Claim() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { open } = useWalletUi();
  const [params, setParams] = useSearchParams();
  const choice: Choice = CHOICES.includes(params.get("product") as Choice) ? (params.get("product") as Choice) : "pass";
  const product = choice === "agency" ? AGENCY : choice === "pass" ? PASS : null;

  const wallet = publicKey?.toBase58() ?? null;
  const state = useGenesis(10_000);
  const balance = useBalance(wallet, 15_000);
  const v = view(state.data);
  const next = choice === "agency" ? v.agency : v.pass;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("5");
  const [agreed, setAgreed] = useState({ terms: false, nature: false, demo: !isTestnet });
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [faucet, setFaucet] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });
  const [result, setResult] = useState<Result | null>(null);

  const held = useMemo(
    () => (state.data?.muur ?? []).filter((e) => e.kind === "aankoop" && e.productId === choice && e.wallet === wallet && !e.teruggegeven).length,
    [state.data, choice, wallet],
  );
  const eurMicro = parseEuro(amount);
  const costMicro = product ? (next.price ?? 0) : Number.isFinite(eurMicro) ? eurMicro : 0;
  const nameCheck = cleanName(name);
  const live: string[] = useMemo(() => {
    const bal = balance.data ?? undefined;
    const errs: string[] = product
      ? checkPassPurchase({ cfg: genesis, product, nextNumber: next.next, held, balanceMicro: bal, network })
      : checkSupport({ cfg: genesis, eurMicro, balanceMicro: bal, network });
    return nameCheck.fout ? [...errs, nameCheck.fout] : errs;
  }, [product, next.next, held, balance.data, eurMicro, nameCheck.fout]);

  const needsFunds = balance.data !== null && balance.data < costMicro;
  const allAgreed = agreed.terms && agreed.nature && agreed.demo;
  const busy = phase === "preparing" || phase === "signing" || phase === "sending";
  const canBuy = Boolean(wallet && signTransaction && deployment && state.data) && live.length === 0 && allAgreed && !busy;

  function choose(c: Choice) {
    setParams(c === "pass" ? {} : { product: c }, { replace: true });
    setErrors([]);
    setAgreed((a) => ({ ...a, nature: false }));
  }

  async function getTestEuro() {
    if (!wallet) return;
    setFaucet({ busy: true, msg: "" });
    try {
      const res = await requestTestEuro(wallet);
      setFaucet({ busy: false, msg: `Je kreeg ${euro(res.amountMicro, { whole: true })} ${SYMBOL}.` });
      balance.refresh();
    } catch (err) {
      setFaucet({ busy: false, msg: err instanceof Error ? err.message : "Testgeld lukte niet." });
    }
  }

  async function buy() {
    if (!wallet || !signTransaction) return;
    setErrors([]);
    setPhase("preparing");
    try {
      const prepared = product ? await preparePass(wallet, product.id, nameCheck.naam ?? "") : await prepareSupport(wallet, amount, nameCheck.naam ?? "");
      setPhase("signing");
      const signed = await signTransaction(decodeTransaction(prepared.transaction));
      setPhase("sending");
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await confirmSignature(connection, signature);
      setResult(
        "number" in prepared
          ? { choice, number: prepared.number, label: `${product!.naam} ${prepared.label}`, amountMicro: prepared.priceMicro, signature }
          : { choice, number: null, label: "Supporter", amountMicro: prepared.amountMicro, signature },
      );
      setPhase("done");
      state.refresh();
      balance.refresh();
    } catch (err) {
      setPhase("idle");
      state.refresh();
      setErrors(err instanceof ApiError ? err.messages : [explainError(err)]);
    }
  }

  if (!deployment) {
    return (
      <>
        <PageHero />
        <div className="container page-body narrow">
          <p className="notice"><strong>Genesis is nog niet geactiveerd op dit netwerk.</strong> Zodra alles op het testnet staat, kan je hier je pass claimen.</p>
        </div>
      </>
    );
  }

  if (phase === "done" && result) {
    return (
      <>
        <PageHero />
        <div className="container page-body">
          <div className="claimed">
            <SpinningPass
              label={result.label}
              initialSpin={1080}
              front={<PassCard variant={result.choice} number={result.number} holder={wallet} />}
              back={<PassBack variant={result.choice} />}
            />
            <div className="claimed-copy">
              <span className="success-mark" aria-hidden="true">✓</span>
              <h2>{result.choice === "steun" ? "Bedankt voor je steun" : `Welkom bij Genesis, ${result.label.split(" ").pop()}`}</h2>
              <p className="muted">
                {result.choice === "steun"
                  ? `Je steunde Marketing Scan met ${euro(result.amountMicro)} (${SYMBOL}). Je badge staat in je wallet en je staat op de Genesis-muur.`
                  : `Je ${result.label} staat in je wallet. Je betaalde ${euro(result.amountMicro)} (${SYMBOL}). Activeer hem nu bij Mijn pass, dan hangt Pro aan je account.`}
              </p>
              <div className="hero-ctas">
                <Link className="btn" to="/mijn-pass">{result.choice === "steun" ? "Naar mijn pass" : "Activeer mijn pass"}</Link>
                <a className="btn btn-ghost" href={shareUrl(result)} target="_blank" rel="noreferrer">Deel op X</a>
                <a className="btn btn-ghost" href={explorerTx(result.signature)} target="_blank" rel="noreferrer">Bekijk de transactie</a>
              </div>
              <button type="button" className="link-button" onClick={() => { setPhase("idle"); setResult(null); }}>Nog iets claimen</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const step1Done = Boolean(wallet);
  const step2Done = step1Done && !needsFunds && balance.data !== null;
  const priceLabel = product ? (next.price ? euro(next.price, { whole: true }) : "uitverkocht") : Number.isFinite(eurMicro) ? euro(eurMicro) : "-";

  return (
    <>
      <PageHero />
      <div className="container page-body">
        <div className="invest">
          <div className="flow">
            <section className="flow-step current" aria-labelledby="s0">
              <div className="flow-step-head">
                <span className="flow-num">1</span>
                <h2 id="s0" style={{ fontSize: "1.2rem" }}>Kies wat je claimt</h2>
              </div>
              <div className="choices" role="radiogroup" aria-label="Kies een pakket">
                {CHOICES.map((c) => {
                  const p = c === "agency" ? AGENCY : c === "pass" ? PASS : null;
                  const n = c === "agency" ? v.agency : v.pass;
                  return (
                    <button key={c} type="button" role="radio" aria-checked={choice === c} className={`choice${choice === c ? " is-on" : ""}`} onClick={() => choose(c)}>
                      <strong>{p ? p.naam : genesis.steun.naam}</strong>
                      <span>{p ? (n.price ? `${euro(n.price, { whole: true })} · ${n.next ? formatNumber(p, n.next) : ""}` : "uitverkocht") : `vanaf €${genesis.steun.minimumEur}`}</span>
                      <small>{p ? `${p.websites === 1 ? "1 website" : `${p.websites} websites`}, levenslang` : "zonder abonnement"}</small>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={`flow-step ${step1Done ? "done" : "current"}`} aria-labelledby="s1">
              <div className="flow-step-head">
                <span className="flow-num">{step1Done ? "✓" : "2"}</span>
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
                  <span className="flow-num">{step2Done ? "✓" : "3"}</span>
                  <h2 id="s2" style={{ fontSize: "1.2rem" }}>Ontvang test-euro</h2>
                </div>
                <p className="muted">
                  Op het testnet betaal je met test-euro ({SYMBOL}) zonder waarde. De transactiekosten betalen wij. Saldo:{" "}
                  <strong>{balance.data === null ? "-" : `${euro(balance.data)} ${SYMBOL}`}</strong>
                </p>
                {step1Done && (
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" className={`btn ${needsFunds ? "" : "btn-ghost"}`} onClick={getTestEuro} disabled={faucet.busy}>
                      {faucet.busy ? "Even geduld..." : `Ontvang 1.000 ${SYMBOL}`}
                    </button>
                    {faucet.msg && <span className="muted" role="status">{faucet.msg}</span>}
                  </div>
                )}
              </section>
            )}

            <section className={`flow-step ${!step1Done ? "locked" : "current"}`} aria-labelledby="s3">
              <div className="flow-step-head">
                <span className="flow-num">{isTestnet ? "4" : "3"}</span>
                <h2 id="s3" style={{ fontSize: "1.2rem" }}>{product ? "Je naam op de muur" : "Je steun"}</h2>
              </div>
              {!product && (
                <>
                  <label className="sr-only" htmlFor="bedrag">Bedrag in euro</label>
                  <div className="amount">
                    <span>€</span>
                    <input id="bedrag" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="chips" role="group" aria-label="Snelle bedragen">
                    {[1, 5, 10, 25, 50].map((x) => (
                      <button key={x} type="button" className="chip" onClick={() => setAmount(String(x))}>€{x}</button>
                    ))}
                  </div>
                </>
              )}
              <label className="field" htmlFor="naam">
                <span>Publieke naam (optioneel)</span>
                <input id="naam" className="input input-paper" maxLength={24} autoComplete="off" placeholder="bv. @jouwnaam of je bedrijf" value={name} onChange={(e) => setName(e.target.value)} />
                <small>Komt op de Genesis-muur en blijft voor altijd op de blockchain staan. Laat leeg om enkel je walletadres te tonen.</small>
              </label>
              {wallet && live.length > 0 && <ul className="errors">{live.map((e) => <li key={e}>{e}</li>)}</ul>}
            </section>

            <section className={`flow-step ${!step1Done ? "locked" : "current"}`} aria-labelledby="s4">
              <div className="flow-step-head">
                <span className="flow-num">{isTestnet ? "5" : "4"}</span>
                <h2 id="s4" style={{ fontSize: "1.2rem" }}>Bevestig</h2>
              </div>
              <div className="agree">
                <label htmlFor="a-terms">
                  <input id="a-terms" type="checkbox" checked={agreed.terms} onChange={(e) => setAgreed({ ...agreed, terms: e.target.checked })} />
                  <span>Ik ga akkoord met de <Link to="/voorwaarden" target="_blank">voorwaarden</Link>.</span>
                </label>
                <label htmlFor="a-nature">
                  <input id="a-nature" type="checkbox" checked={agreed.nature} onChange={(e) => setAgreed({ ...agreed, nature: e.target.checked })} />
                  <span>
                    {product
                      ? "Ik begrijp dat dit geen investering is: ik koop een levenslang abonnement, mijn pass is niet overdraagbaar en levert niets op."
                      : "Ik begrijp dat steun een vrijwillige bijdrage is, zonder abonnement en zonder terugbetaling."}
                  </span>
                </label>
                {isTestnet && (
                  <label htmlFor="a-demo">
                    <input id="a-demo" type="checkbox" checked={agreed.demo} onChange={(e) => setAgreed({ ...agreed, demo: e.target.checked })} />
                    <span>Ik begrijp dat dit een demo op het testnet is, zonder echt geld en zonder echt abonnement.</span>
                  </label>
                )}
              </div>
              {errors.length > 0 && <ul className="errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              <button type="button" className="btn btn-large btn-block" disabled={!canBuy} onClick={buy}>
                {phase === "preparing" && "Even voorbereiden..."}
                {phase === "signing" && "Bevestig in je wallet..."}
                {phase === "sending" && "Bevestigen op Solana..."}
                {phase === "idle" &&
                  (product
                    ? next.next
                      ? `Claim ${product.naam} ${formatNumber(product, next.next)} voor ${priceLabel}`
                      : `${product.naam} is uitverkocht`
                    : `Steun met ${priceLabel}`)}
              </button>
              <p className="muted" style={{ fontSize: "0.88rem" }}>
                {product
                  ? `Je wallet toont exact wat er gebeurt: ${priceLabel} ${SYMBOL} van jou naar de kas, je pass naar jou. In één transactie: lukt één deel niet, dan gebeurt er niets. Was iemand je net voor met dit nummer, dan krijg je het volgende.`
                  : `Je wallet toont exact wat er gebeurt: ${priceLabel} ${SYMBOL} van jou naar de kas${held === 0 ? ", en de eerste keer een supporter-badge naar jou" : ""}.`}
              </p>
            </section>
          </div>

          <aside className="summary" aria-label="Samenvatting">
            <PassCard variant={choice} number={product ? next.next : null} holder={wallet} status={product ? "voorbeeld" : undefined} footer={product ? undefined : "Supporter-badge · niet overdraagbaar"} />
            <div className="summary-card">
              <dl>
                <div><dt>{product ? "Je betaalt" : "Je steun"}</dt><dd>{priceLabel}</dd></div>
                {product ? (
                  <>
                    <div><dt>Je nummer</dt><dd>{next.next ? formatNumber(product, next.next) : "-"}</dd></div>
                    <div><dt>Abonnement</dt><dd>Pro, levenslang</dd></div>
                    <div><dt>Websites</dt><dd>{product.websites}</dd></div>
                    <div><dt>Geld terug</dt><dd>{genesis.bedenktijdDagen} dagen, één klik</dd></div>
                  </>
                ) : (
                  <>
                    <div><dt>Badge</dt><dd>{genesis.steun.symbool}, soulbound</dd></div>
                    <div><dt>Abonnement</dt><dd>geen</dd></div>
                  </>
                )}
                <div><dt>Transactiekosten</dt><dd>betalen wij</dd></div>
              </dl>
            </div>
            <p className="notice">
              <strong>{isTestnet ? "Testnet-demo." : "Geen investering."}</strong>{" "}
              {isTestnet
                ? "Nog geen verkoop. Alles werkt zoals het straks echt werkt, maar met test-euro zonder waarde."
                : "Je koopt een levenslang abonnement. Je pass is niet overdraagbaar en levert niets op."}
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
        <p className="eyebrow" style={{ color: "var(--pill)" }}>Marketing Scan Genesis{isTestnet ? " · testnet-demo" : ""}</p>
        <h1>Claim je Genesis Pass</h1>
        <p>Levenslang Marketing Scan Pro, genummerd in je eigen wallet. Je nummer bepaalt je prijs: hoe vroeger, hoe goedkoper.</p>
      </div>
    </section>
  );
}
