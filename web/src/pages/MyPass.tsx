import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SYMBOL, deployment, genesis, isTestnet } from "../config";
import { activationMessage, formatNumber, refundDeadline } from "../../../shared/genesis.js";
import { useAsync, useBalance, useGenesis } from "../lib/hooks";
import { confirmSignature, decodeTransaction, explainError, holdsPass } from "../lib/chain";
import { ApiError, activatePass, prepareRefund, type GenesisEvent } from "../lib/api";
import { dateLong, dateTime, euro, shortAddress } from "../lib/format";
import { explorerAddress, explorerTx } from "../lib/explorer";
import { useWalletUi } from "../components/Wallet";
import { PassBack, PassCard, productOf } from "../components/genesis";
import { SpinningPass } from "../components/SpinningPass";
import { useLang, useT } from "../i18n";

const T = {
  en: {
    title: "Your Genesis.",
    titleOther: (a: string) => `Wallet ${a}.`,
    titleOut: "My pass.",
    sub: "Straight from the blockchain: your pass, your payment, your support.",
    notActive: "Genesis isn’t active on this network yet.",
    signInText: `Sign in with the wallet you used. You’ll see your pass, can activate it, and can get a refund within ${genesis.bedenktijdDagen} days.`,
    signIn: "Sign in with wallet",
    lookup: "Or look up any wallet",
    lookupPlaceholder: "Solana address",
    lookupBtn: "Look up",
    viewing: "View only.",
    back: "Back to your own wallet",
    loading: "Loading…",
    loadFailed: "Couldn’t load.",
    emptyTitle: "No Genesis Pass yet.",
    emptyText: isTestnet ? "Claim your numbered pass and get Marketing Scan Pro for life. On devnet it’s free, with test euros." : "Claim your numbered pass and get Marketing Scan Pro for life.",
    emptyCta: "Claim your pass",
    status: "Status",
    inWallet: "In your wallet",
    notInWallet: "Not found in this wallet",
    checking: "Checking…",
    refunded: "Refunded",
    bought: "Purchased",
    paid: "Paid",
    plan: "Plan",
    planValue: (n: number) => `Pro, for life, ${n === 1 ? "1 website" : `${n} websites`}`,
    refund: "Refund",
    refundUntil: (d: string) => `until ${d}`,
    refundOver: "window closed",
    mint: "Token",
    codeLabel: "Your activation code",
    codeNote: "Enter this code in Marketing Scan (Account › Genesis). You can request it again with your wallet anytime.",
    copy: "Copy",
    copied: "Copied",
    activate: "Activate in Marketing Scan",
    activating: "Sign in your wallet…",
    noSign: "Your wallet can’t sign messages. Try Phantom or Solflare.",
    refundBtn: "Request refund",
    confirmText: (n: string, a: string) => <><strong>Are you sure?</strong> Pass {n} will be burned and that number won’t come back. You get {a} back in the same transaction.</>,
    confirmYes: (a: string) => `Yes, refund ${a}`,
    confirmNo: "Keep my pass",
    refundBusy: "Confirm in your wallet…",
    refundedMsg: (a: string) => `Refunded: ${a} is back in your wallet. Your pass has been burned.`,
    readOnly: "You’re viewing this wallet without signing in. Only the owner can activate or request a refund.",
    supporter: "Supporter.",
    supportText: (n: number, a: string) => `You supported Marketing Scan ${n === 1 ? "once" : `${n} times`}, ${a} in total. Thank you.`,
    tx: "Transaction",
    balance: (b: string) => `Test euro balance: ${b}.`,
    more: "Claim another",
  },
  nl: {
    title: "Jouw Genesis.",
    titleOther: (a: string) => `Wallet ${a}.`,
    titleOut: "Mijn pass.",
    sub: "Rechtstreeks van de blockchain: je pass, je betaling en je steun.",
    notActive: "Genesis is nog niet actief op dit netwerk.",
    signInText: `Log in met de wallet waarmee je kocht. Je ziet je pass, kan hem activeren en binnen ${genesis.bedenktijdDagen} dagen je geld terugvragen.`,
    signIn: "Inloggen met wallet",
    lookup: "Of bekijk een wallet",
    lookupPlaceholder: "Solana-adres",
    lookupBtn: "Bekijk",
    viewing: "Alleen bekijken.",
    back: "Terug naar je eigen wallet",
    loading: "Laden…",
    loadFailed: "Laden lukte niet.",
    emptyTitle: "Nog geen Genesis Pass.",
    emptyText: isTestnet ? "Claim je genummerde pass en krijg levenslang Marketing Scan Pro. Op het testnet gratis, met test-euro." : "Claim je genummerde pass en krijg levenslang Marketing Scan Pro.",
    emptyCta: "Claim je pass",
    status: "Status",
    inWallet: "In je wallet",
    notInWallet: "Niet gevonden in deze wallet",
    checking: "Nakijken…",
    refunded: "Teruggegeven",
    bought: "Gekocht",
    paid: "Betaald",
    plan: "Abonnement",
    planValue: (n: number) => `Pro, levenslang, ${n === 1 ? "1 website" : `${n} websites`}`,
    refund: "Geld terug",
    refundUntil: (d: string) => `tot ${d}`,
    refundOver: "bedenktijd voorbij",
    mint: "Token",
    codeLabel: "Je activatiecode",
    codeNote: "Vul deze code in bij Marketing Scan (Account › Genesis). Je kan hem altijd opnieuw opvragen met je wallet.",
    copy: "Kopieer",
    copied: "Gekopieerd",
    activate: "Activeer in Marketing Scan",
    activating: "Onderteken in je wallet…",
    noSign: "Je wallet kan geen berichten ondertekenen. Probeer Phantom of Solflare.",
    refundBtn: "Geld terugvragen",
    confirmText: (n: string, a: string) => <><strong>Zeker?</strong> Pass {n} wordt verbrand en dat nummer komt niet terug. Je krijgt {a} terug in dezelfde transactie.</>,
    confirmYes: (a: string) => `Ja, stort ${a} terug`,
    confirmNo: "Pass houden",
    refundBusy: "Bevestig in je wallet…",
    refundedMsg: (a: string) => `Teruggestort: ${a} staat terug in je wallet. Je pass is verbrand.`,
    readOnly: "Je bekijkt deze wallet zonder in te loggen. Activeren en geld terugvragen kan enkel de eigenaar.",
    supporter: "Supporter.",
    supportText: (n: number, a: string) => `Je steunde Marketing Scan ${n === 1 ? "één keer" : `${n} keer`}, samen ${a}. Bedankt.`,
    tx: "Transactie",
    balance: (b: string) => `Saldo test-euro: ${b}.`,
    more: "Nog iets claimen",
  },
};

type Copy = (typeof T)["en"];

function validAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function PassRow({ e, owner, own, onChange, t }: { e: GenesisEvent; owner: string; own: boolean; onChange: () => void; t: Copy }) {
  const { lang } = useLang();
  const { connection } = useConnection();
  const { signMessage, signTransaction } = useWallet();
  const product = productOf(e.productId)!;
  const inWallet = useAsync(e.mint && !e.teruggegeven ? () => holdsPass(connection, new PublicKey(owner), e.mint!) : null, [connection, e.mint, owner, e.teruggegeven]);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "activeren" | "terug">("");
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const deadline = e.time ? refundDeadline(genesis, e.time) : 0;
  const canRefund = own && !e.teruggegeven && Date.now() < deadline;
  const label = formatNumber(product, e.number!);

  async function activate() {
    if (!signMessage) return setMsg({ kind: "bad", text: t.noSign });
    setBusy("activeren");
    setMsg(null);
    try {
      const message = activationMessage(product, e.number!, owner, new Date().toISOString());
      const signature = await signMessage(new TextEncoder().encode(message));
      const res = await activatePass(owner, product.id, e.number!, message, toBase64(signature));
      setCode(res.code);
    } catch (err) {
      setMsg({ kind: "bad", text: err instanceof ApiError ? err.message : explainError(err, lang) });
    } finally {
      setBusy("");
    }
  }

  async function refund() {
    if (!signTransaction) return;
    setBusy("terug");
    setMsg(null);
    try {
      const prepared = await prepareRefund(owner, product.id, e.number!);
      const signed = await signTransaction(decodeTransaction(prepared.transaction));
      const signature = await connection.sendRawTransaction(signed.serialize());
      await confirmSignature(connection, signature, lang);
      setMsg({ kind: "ok", text: t.refundedMsg(euro(prepared.amountMicro)) });
      setConfirmRefund(false);
      onChange();
    } catch (err) {
      setMsg({ kind: "bad", text: err instanceof ApiError ? err.message : explainError(err, lang) });
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* klembord niet beschikbaar: de code blijft selecteerbaar */
    }
  }

  return (
    <article className="my-pass">
      <SpinningPass
        label={`${product.naam} ${label}`}
        front={<PassCard variant={product.id} number={e.number} holder={owner} status={e.teruggegeven ? "teruggegeven" : "actief"} />}
        back={<PassBack variant={product.id} />}
      />
      <div className="my-side">
        <h2>{product.naam} {label}</h2>
        <dl className="group">
          <div>
            <dt>{t.status}</dt>
            <dd>{e.teruggegeven ? t.refunded : inWallet.data === null ? t.checking : inWallet.data ? <span className="ok">{t.inWallet}</span> : <span className="bad">{t.notInWallet}</span>}</dd>
          </div>
          <div><dt>{t.bought}</dt><dd>{dateTime(e.time)}</dd></div>
          <div><dt>{t.paid}</dt><dd>{euro(e.amountMicro)} {SYMBOL}</dd></div>
          <div><dt>{t.plan}</dt><dd>{t.planValue(product.websites)}</dd></div>
          {!e.teruggegeven && e.time && <div><dt>{t.refund}</dt><dd>{Date.now() < deadline ? t.refundUntil(dateLong(deadline)) : t.refundOver}</dd></div>}
          {e.mint && <div><dt>{t.mint}</dt><dd><a className="mono" href={explorerAddress(e.mint)} target="_blank" rel="noreferrer">{shortAddress(e.mint)}</a></dd></div>}
        </dl>

        {code && (
          <div className="code" role="status">
            <span className="code-label">{t.codeLabel}</span>
            <div className="code-row">
              <code>{code}</code>
              <button type="button" className="btn btn-sm btn-quiet" onClick={copy}>{copied ? t.copied : t.copy}</button>
            </div>
            <span className="fine">{t.codeNote}</span>
          </div>
        )}
        {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}

        {own && !e.teruggegeven && !confirmRefund && (
          <div className="actions">
            {!code && <button type="button" className="btn" disabled={busy !== ""} onClick={activate}>{busy === "activeren" ? t.activating : t.activate}</button>}
            {canRefund && <button type="button" className="linkbtn danger" disabled={busy !== ""} onClick={() => setConfirmRefund(true)}>{t.refundBtn}</button>}
          </div>
        )}
        {confirmRefund && (
          <div className="confirm">
            <p>{t.confirmText(label, euro(e.amountMicro))}</p>
            <div className="actions">
              <button type="button" className="btn btn-danger" disabled={busy !== ""} onClick={refund}>{busy === "terug" ? t.refundBusy : t.confirmYes(euro(e.amountMicro))}</button>
              <button type="button" className="linkbtn" disabled={busy !== ""} onClick={() => setConfirmRefund(false)}>{t.confirmNo}</button>
            </div>
          </div>
        )}
        {!own && <p className="fine">{t.readOnly}</p>}
      </div>
    </article>
  );
}

export default function MyPass() {
  const t = useT(T);
  const { publicKey } = useWallet();
  const { open } = useWalletUi();
  const [params, setParams] = useSearchParams();
  const viewParam = params.get("adres");
  const viewing = viewParam && validAddress(viewParam) ? viewParam : null;
  const owner = viewing ?? publicKey?.toBase58() ?? null;
  const own = Boolean(publicKey && owner === publicKey.toBase58());
  const state = useGenesis(10_000);
  const balance = useBalance(own ? owner : null);
  const [lookup, setLookup] = useState("");

  const mine = (state.data?.muur ?? []).filter((e) => e.wallet === owner);
  const passes = mine.filter((e) => e.kind === "aankoop").sort((a, b) => (a.teruggegeven ? 1 : 0) - (b.teruggegeven ? 1 : 0));
  const support = mine.filter((e) => e.kind === "steun");
  const supportTotal = support.reduce((s, e) => s + e.amountMicro, 0);

  function submitLookup(ev: FormEvent) {
    ev.preventDefault();
    if (validAddress(lookup.trim())) setParams({ adres: lookup.trim() });
  }

  return (
    <div className="page-alt-wrap">
      <header className="page-head">
        <div className="container">
          <h1>{owner ? (viewing && !own ? t.titleOther(shortAddress(owner)) : t.title) : t.titleOut}</h1>
          <p>{t.sub}</p>
        </div>
      </header>
      <div className="container wide page">
        {!deployment && <p className="notice">{t.notActive}</p>}

        {!owner && (
          <div className="signin">
            <p className="lead">{t.signInText}</p>
            <button type="button" className="btn btn-lg" onClick={open}>{t.signIn}</button>
            <form onSubmit={submitLookup}>
              <label className="sr-only" htmlFor="adres">{t.lookup}</label>
              <input id="adres" className="input" placeholder={t.lookupPlaceholder} value={lookup} onChange={(e) => setLookup(e.target.value)} />
              <button type="submit" className="btn btn-quiet">{t.lookupBtn}</button>
            </form>
            <span className="fine">{t.lookup}</span>
          </div>
        )}

        {owner && (
          <div className="my">
            {viewing && !own && (
              <p className="notice"><strong>{t.viewing}</strong> <button type="button" className="linkbtn" onClick={() => setParams({})}>{t.back}</button></p>
            )}
            {state.error && <p className="notice bad"><strong>{t.loadFailed}</strong> {state.error}</p>}
            {!state.data && !state.error && <p className="muted center">{t.loading}</p>}
            {state.data && passes.length === 0 && support.length === 0 && (
              <div className="empty">
                <PassCard variant="pass" number={null} holder={owner} />
                <div>
                  <h2>{t.emptyTitle}</h2>
                  <p className="lead">{t.emptyText}</p>
                  <Link className="btn btn-lg" to="/genesis">{t.emptyCta}</Link>
                </div>
              </div>
            )}
            {passes.map((e) => (
              <PassRow key={e.signature} e={e} owner={owner} own={own} t={t} onChange={() => { state.refresh(); balance.refresh(); }} />
            ))}
            {support.length > 0 && (
              <article className="my-pass">
                <PassCard variant="steun" holder={owner} />
                <div className="my-side">
                  <h2>{t.supporter}</h2>
                  <p className="lead">{t.supportText(support.length, euro(supportTotal))}</p>
                  <dl className="group">
                    {support.map((e) => (
                      <div key={e.signature}><dt>{dateTime(e.time)}</dt><dd><a href={explorerTx(e.signature)} target="_blank" rel="noreferrer">{euro(e.amountMicro)}</a></dd></div>
                    ))}
                  </dl>
                </div>
              </article>
            )}
            {own && isTestnet && state.data && (
              <p className="fine center">{t.balance(balance.data === null ? "-" : `${euro(balance.data)} ${SYMBOL}`)} <Link to="/genesis">{t.more}</Link></p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
