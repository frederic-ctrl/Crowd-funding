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
import { useLang, useT } from "../i18n";

type Choice = "pass" | "agency" | "steun";
type Phase = "idle" | "preparing" | "signing" | "sending" | "done";
type Result = { choice: Choice; number: number | null; label: string; amountMicro: number; signature: string };

const CHOICES: Choice[] = ["pass", "agency", "steun"];

const T = {
  en: {
    title: "Claim your Genesis Pass.",
    sub: "Lifetime Marketing Scan Pro, numbered in your own wallet.",
    notActive: "Genesis isn’t active on this network yet.",
    which: "Which pass?",
    whichHint: "Choose one.",
    options: {
      pass: { name: PASS.naam, desc: "Lifetime Pro · 1 website" },
      agency: { name: AGENCY.naam, desc: "Lifetime Pro · 10 websites" },
      steun: { name: genesis.steun.naam, desc: "No subscription" },
    },
    from: (p: string) => `from ${p}`,
    soldOut: "Sold out",
    signIn: "Sign in.",
    signInHint: "With your wallet.",
    signInText: "Phantom, Solflare or Backpack. Your wallet is your login.",
    signInBtn: "Sign in with wallet",
    signedIn: "Signed in",
    funds: "Test euros.",
    fundsHint: "Free, no value.",
    fundsText: (b: string) => `On devnet you pay with test euros (${SYMBOL}). We pay the network fees. Balance: ${b}.`,
    fundsBtn: `Get 1,000 ${SYMBOL}`,
    got: (a: string) => `You received ${a}.`,
    amount: "Amount.",
    amountHint: "From €1.",
    name: "Your name on the wall.",
    nameHint: "Optional.",
    namePlaceholder: "@yourname or your company",
    nameNote: "Shown on the Genesis wall and stored on the blockchain for good. Leave empty to show only your wallet address.",
    review: "Review.",
    terms: <>I agree to the <Link to="/voorwaarden" target="_blank">terms</Link>.</>,
    naturePass: "I understand this is not an investment: I’m buying a lifetime subscription, and my pass is non-transferable and earns nothing.",
    natureSupport: "I understand support is a voluntary contribution, without a subscription and without refunds.",
    demo: "I understand this is a demo on devnet, with no real money and no real subscription.",
    rows: { number: "Your number", plan: "Plan", sites: "Websites", refund: "Refund", fees: "Network fees", badge: "Badge" },
    planValue: "Pro, for life",
    refundValue: `${genesis.bedenktijdDagen} days, one click`,
    feesValue: "On us",
    badgeValue: `${genesis.steun.symbool}, non-transferable`,
    total: "Total",
    preparing: "Preparing…",
    signing: "Confirm in your wallet…",
    sending: "Confirming on Solana…",
    claim: (n: string, p: string) => `Claim ${n} for ${p}`,
    support: (p: string) => `Support with ${p}`,
    soldOutBtn: "Sold out",
    explainPass: (p: string) => `Your wallet shows exactly what happens: ${p} ${SYMBOL} from you to the treasury, your pass to you, in one transaction. If someone beats you to this number, you get the next one.`,
    explainSupport: (p: string) => `Your wallet shows exactly what happens: ${p} ${SYMBOL} from you to the treasury, and a supporter badge the first time.`,
    welcome: (n: string) => `Welcome to Genesis, ${n}.`,
    thanks: "Thank you for your support.",
    welcomeText: (label: string, a: string) => `Your ${label} is in your wallet. You paid ${a} (${SYMBOL}). Activate it now in My pass to link Pro to your account.`,
    thanksText: (a: string) => `You supported Marketing Scan with ${a} (${SYMBOL}). Your badge is in your wallet and you’re on the Genesis wall.`,
    activate: "Activate my pass",
    myPass: "Go to my pass",
    share: "Share on X",
    tx: "View transaction",
    again: "Claim another",
    shareText: (label: string) => `I just claimed Marketing Scan ${label}: lifetime Marketing Scan Pro, soulbound on Solana. Not an investment, just my marketing tool.`,
    shareSupport: "I’m backing Marketing Scan Genesis: a marketing tool for small businesses, built in public on Solana.",
  },
  nl: {
    title: "Claim je Genesis Pass.",
    sub: "Levenslang Marketing Scan Pro, genummerd in je eigen wallet.",
    notActive: "Genesis is nog niet actief op dit netwerk.",
    which: "Welke pass?",
    whichHint: "Kies er één.",
    options: {
      pass: { name: PASS.naam, desc: "Levenslang Pro · 1 website" },
      agency: { name: AGENCY.naam, desc: "Levenslang Pro · 10 websites" },
      steun: { name: genesis.steun.naam, desc: "Geen abonnement" },
    },
    from: (p: string) => `vanaf ${p}`,
    soldOut: "Uitverkocht",
    signIn: "Log in.",
    signInHint: "Met je wallet.",
    signInText: "Phantom, Solflare of Backpack. Je wallet is je login.",
    signInBtn: "Inloggen met wallet",
    signedIn: "Ingelogd",
    funds: "Test-euro.",
    fundsHint: "Gratis, zonder waarde.",
    fundsText: (b: string) => `Op het testnet betaal je met test-euro (${SYMBOL}). De transactiekosten betalen wij. Saldo: ${b}.`,
    fundsBtn: `Ontvang 1.000 ${SYMBOL}`,
    got: (a: string) => `Je kreeg ${a}.`,
    amount: "Bedrag.",
    amountHint: "Vanaf €1.",
    name: "Je naam op de muur.",
    nameHint: "Optioneel.",
    namePlaceholder: "@jouwnaam of je bedrijf",
    nameNote: "Komt op de Genesis-muur en blijft voor altijd op de blockchain. Laat leeg om enkel je walletadres te tonen.",
    review: "Bevestig.",
    terms: <>Ik ga akkoord met de <Link to="/voorwaarden" target="_blank">voorwaarden</Link>.</>,
    naturePass: "Ik begrijp dat dit geen investering is: ik koop een levenslang abonnement, en mijn pass is niet overdraagbaar en levert niets op.",
    natureSupport: "Ik begrijp dat steun een vrijwillige bijdrage is, zonder abonnement en zonder terugbetaling.",
    demo: "Ik begrijp dat dit een demo op het testnet is, zonder echt geld en zonder echt abonnement.",
    rows: { number: "Je nummer", plan: "Abonnement", sites: "Websites", refund: "Geld terug", fees: "Transactiekosten", badge: "Badge" },
    planValue: "Pro, levenslang",
    refundValue: `${genesis.bedenktijdDagen} dagen, één klik`,
    feesValue: "Betalen wij",
    badgeValue: `${genesis.steun.symbool}, niet overdraagbaar`,
    total: "Totaal",
    preparing: "Even voorbereiden…",
    signing: "Bevestig in je wallet…",
    sending: "Bevestigen op Solana…",
    claim: (n: string, p: string) => `Claim ${n} voor ${p}`,
    support: (p: string) => `Steun met ${p}`,
    soldOutBtn: "Uitverkocht",
    explainPass: (p: string) => `Je wallet toont exact wat er gebeurt: ${p} ${SYMBOL} van jou naar de kas, je pass naar jou, in één transactie. Was iemand je voor met dit nummer, dan krijg je het volgende.`,
    explainSupport: (p: string) => `Je wallet toont exact wat er gebeurt: ${p} ${SYMBOL} van jou naar de kas, en de eerste keer een supporter-badge.`,
    welcome: (n: string) => `Welkom bij Genesis, ${n}.`,
    thanks: "Bedankt voor je steun.",
    welcomeText: (label: string, a: string) => `Je ${label} staat in je wallet. Je betaalde ${a} (${SYMBOL}). Activeer hem nu in Mijn pass, dan hangt Pro aan je account.`,
    thanksText: (a: string) => `Je steunde Marketing Scan met ${a} (${SYMBOL}). Je badge staat in je wallet en je staat op de Genesis-muur.`,
    activate: "Activeer mijn pass",
    myPass: "Naar mijn pass",
    share: "Deel op X",
    tx: "Bekijk de transactie",
    again: "Nog iets claimen",
    shareText: (label: string) => `Ik heb Marketing Scan ${label}: levenslang Marketing Scan Pro, soulbound op Solana. Geen investering, gewoon mijn marketingtool.`,
    shareSupport: "Ik steun Marketing Scan Genesis: een marketingtool voor kmo’s, in het openbaar gebouwd op Solana.",
  },
};

export default function Claim() {
  const t = useT(T);
  const { lang } = useLang();
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
  const nameCheck = cleanName(name, lang);
  const live: string[] = useMemo(() => {
    const bal = balance.data ?? undefined;
    const errs: string[] = product
      ? checkPassPurchase({ cfg: genesis, product, nextNumber: next.next, held, balanceMicro: bal, network, lang })
      : checkSupport({ cfg: genesis, eurMicro, balanceMicro: bal, network, lang });
    return nameCheck.fout ? [...errs, nameCheck.fout] : errs;
  }, [product, next.next, held, balance.data, eurMicro, nameCheck.fout, lang]);

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
      setFaucet({ busy: false, msg: t.got(`${euro(res.amountMicro, { whole: true })} ${SYMBOL}`) });
      balance.refresh();
    } catch (err) {
      setFaucet({ busy: false, msg: err instanceof Error ? err.message : "" });
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
      await confirmSignature(connection, signature, lang);
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
      setErrors(err instanceof ApiError ? err.messages : [explainError(err, lang)]);
    }
  }

  if (!deployment) {
    return (
      <>
        <Head t={t} />
        <div className="container narrow page"><p className="notice">{t.notActive}</p></div>
      </>
    );
  }

  if (phase === "done" && result) {
    const site = company.communitySite ?? "https://funding.marketingscan.be";
    const text = result.choice === "steun" ? t.shareSupport : t.shareText(result.label);
    const share = `https://x.com/intent/post?text=${encodeURIComponent(`${text}${isTestnet ? " (devnet demo)" : ""}`)}&url=${encodeURIComponent(`${site}/genesis?lang=${lang}`)}`;
    return (
      <div className="container wide page" style={{ paddingTop: "clamp(48px, 7vw, 88px)" }}>
        <div className="claimed">
          <div className="buy-visual">
            <SpinningPass label={result.label} initialSpin={1080} front={<PassCard variant={result.choice} number={result.number} holder={wallet} />} back={<PassBack variant={result.choice} />} />
          </div>
          <div className="claimed-copy">
            <h2>{result.choice === "steun" ? t.thanks : t.welcome(result.label.split(" ").pop() ?? "")}</h2>
            <p className="lead">{result.choice === "steun" ? t.thanksText(euro(result.amountMicro)) : t.welcomeText(result.label, euro(result.amountMicro))}</p>
            <div className="actions">
              <Link className="btn btn-lg" to="/mijn-pass">{result.choice === "steun" ? t.myPass : t.activate}</Link>
              <a className="more" href={share} target="_blank" rel="noreferrer">{t.share}</a>
              <a className="more" href={explorerTx(result.signature)} target="_blank" rel="noreferrer">{t.tx}</a>
            </div>
            <button type="button" className="linkbtn" onClick={() => { setPhase("idle"); setResult(null); }}>{t.again}</button>
          </div>
        </div>
      </div>
    );
  }

  const signedIn = Boolean(wallet);
  const priceLabel = product ? (next.price ? euro(next.price, { whole: true }) : t.soldOut) : Number.isFinite(eurMicro) ? euro(eurMicro) : "-";

  return (
    <>
      <Head t={t} />
      <div className="container wide page">
        <div className="buy">
          <aside className="buy-visual" aria-label={t.options[choice].name}>
            <SpinningPass
              key={choice}
              label={t.options[choice].name}
              front={<PassCard variant={choice} number={product ? next.next : null} holder={wallet} />}
              back={<PassBack variant={choice} />}
            />
            <div className="buy-visual-meta">
              <b>{product && next.next ? `${product.naam} ${formatNumber(product, next.next)}` : t.options[choice].name}</b>
              <span>{priceLabel}</span>
            </div>
          </aside>

          <div className="buy-steps">
            <section className="step" aria-labelledby="s-which">
              <h2 id="s-which">{t.which} <span>{t.whichHint}</span></h2>
              <div className="options" role="radiogroup" aria-labelledby="s-which">
                {CHOICES.map((c) => {
                  const p = c === "agency" ? AGENCY : c === "pass" ? PASS : null;
                  const n = c === "agency" ? v.agency : v.pass;
                  return (
                    <button key={c} type="button" role="radio" aria-checked={choice === c} className={`option${choice === c ? " is-on" : ""}`} onClick={() => choose(c)}>
                      <span>
                        <strong>{t.options[c].name}</strong>
                        <small>{t.options[c].desc}{p && n.next ? ` · ${formatNumber(p, n.next)}` : ""}</small>
                      </span>
                      <span className="price">{p ? (n.price ? euro(n.price, { whole: true }) : t.soldOut) : t.from(`€${genesis.steun.minimumEur}`)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="step" aria-labelledby="s-in">
              <h2 id="s-in">{t.signIn} <span>{t.signInHint}</span></h2>
              {wallet ? (
                <div className="signed-in"><span>{t.signedIn}</span><span className="mono" title={wallet}>{wallet}</span></div>
              ) : (
                <>
                  <p className="muted">{t.signInText}</p>
                  <div><button type="button" className="btn" onClick={open}>{t.signInBtn}</button></div>
                </>
              )}
            </section>

            {isTestnet && (
              <section className={`step${signedIn ? "" : " locked"}`} aria-labelledby="s-funds">
                <h2 id="s-funds">{t.funds} <span>{t.fundsHint}</span></h2>
                <p className="muted">{t.fundsText(balance.data === null ? "-" : `${euro(balance.data)} ${SYMBOL}`)}</p>
                <div className="actions">
                  <button type="button" className={`btn${needsFunds ? "" : " btn-quiet"}`} onClick={getTestEuro} disabled={faucet.busy || !signedIn}>{faucet.busy ? t.preparing : t.fundsBtn}</button>
                  {faucet.msg && <span className="muted" role="status">{faucet.msg}</span>}
                </div>
              </section>
            )}

            {!product && (
              <section className={`step${signedIn ? "" : " locked"}`} aria-labelledby="s-amount">
                <h2 id="s-amount">{t.amount} <span>{t.amountHint}</span></h2>
                <label className="amount" htmlFor="bedrag">
                  <span>€</span>
                  <input id="bedrag" className="input" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <div className="pills" role="group" aria-label={t.amount}>
                  {[1, 5, 10, 25, 50].map((x) => (
                    <button key={x} type="button" className="pill-btn" onClick={() => setAmount(String(x))}>€{x}</button>
                  ))}
                </div>
              </section>
            )}

            <section className={`step${signedIn ? "" : " locked"}`} aria-labelledby="s-name">
              <h2 id="s-name">{t.name} <span>{t.nameHint}</span></h2>
              <label className="field" htmlFor="naam">
                <span className="sr-only">{t.name}</span>
                <input id="naam" className="input" maxLength={24} autoComplete="off" placeholder={t.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
                <span className="fine">{t.nameNote}</span>
              </label>
            </section>

            <section className={`step${signedIn ? "" : " locked"}`} aria-labelledby="s-review">
              <h2 id="s-review">{t.review}</h2>
              <dl className="rows">
                {product ? (
                  <>
                    <div><dt>{t.rows.number}</dt><dd>{next.next ? formatNumber(product, next.next) : "-"}</dd></div>
                    <div><dt>{t.rows.plan}</dt><dd>{t.planValue}</dd></div>
                    <div><dt>{t.rows.sites}</dt><dd>{product.websites}</dd></div>
                    <div><dt>{t.rows.refund}</dt><dd>{t.refundValue}</dd></div>
                  </>
                ) : (
                  <div><dt>{t.rows.badge}</dt><dd>{t.badgeValue}</dd></div>
                )}
                <div><dt>{t.rows.fees}</dt><dd>{t.feesValue}</dd></div>
              </dl>
              <p className="total"><span>{t.total}</span><span>{priceLabel}</span></p>
              <div style={{ display: "grid", gap: 12 }}>
                <label className="check" htmlFor="a-terms">
                  <input id="a-terms" type="checkbox" checked={agreed.terms} onChange={(e) => setAgreed({ ...agreed, terms: e.target.checked })} />
                  <span>{t.terms}</span>
                </label>
                <label className="check" htmlFor="a-nature">
                  <input id="a-nature" type="checkbox" checked={agreed.nature} onChange={(e) => setAgreed({ ...agreed, nature: e.target.checked })} />
                  <span>{product ? t.naturePass : t.natureSupport}</span>
                </label>
                {isTestnet && (
                  <label className="check" htmlFor="a-demo">
                    <input id="a-demo" type="checkbox" checked={agreed.demo} onChange={(e) => setAgreed({ ...agreed, demo: e.target.checked })} />
                    <span>{t.demo}</span>
                  </label>
                )}
              </div>
              {wallet && live.length > 0 && <ul className="errors">{live.map((e) => <li key={e}>{e}</li>)}</ul>}
              {errors.length > 0 && <ul className="errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              <button type="button" className="btn btn-lg btn-block" disabled={!canBuy} onClick={buy}>
                {phase === "preparing" && t.preparing}
                {phase === "signing" && t.signing}
                {phase === "sending" && t.sending}
                {phase === "idle" && (product ? (next.next ? t.claim(`${product.naam} ${formatNumber(product, next.next)}`, priceLabel) : t.soldOutBtn) : t.support(priceLabel))}
              </button>
              <p className="fine">{product ? t.explainPass(priceLabel) : t.explainSupport(priceLabel)}</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function Head({ t }: { t: (typeof T)["en"] }) {
  return (
    <header className="page-head">
      <div className="container">
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </div>
    </header>
  );
}
