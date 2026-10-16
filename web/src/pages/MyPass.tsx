import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SYMBOL, deployment, genesis, isTestnet } from "../config";
import { activationMessage, formatNumber, refundDeadline } from "../../../shared/genesis.js";
import { useAsync, useBalance, useGenesis } from "../lib/hooks";
import { confirmSignature, decodeTransaction, explainError, holdsPass } from "../lib/chain";
import { ApiError, activatePass, prepareRefund, type GenesisEvent } from "../lib/api";
import { dateTime, euro, shortAddress } from "../lib/format";
import { explorerAddress, explorerTx } from "../lib/explorer";
import { useWalletUi } from "../components/Wallet";
import { PassCard, productOf } from "../components/genesis";

function validAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

const dateLong = (ms: number) => new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));

function toBase64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function PassBlock({ e, owner, own, onChange }: { e: GenesisEvent; owner: string; own: boolean; onChange: () => void }) {
  const { connection } = useConnection();
  const { signMessage, signTransaction } = useWallet();
  const product = productOf(e.productId)!;
  const inWallet = useAsync(e.mint && !e.teruggegeven ? () => holdsPass(connection, new PublicKey(owner), e.mint!) : null, [connection, e.mint, owner, e.teruggegeven]);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "activeren" | "terug">("");
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const deadline = e.time ? refundDeadline(genesis, e.time) : 0;
  const canRefund = own && !e.teruggegeven && Date.now() < deadline;

  async function activate() {
    if (!signMessage) return setMsg({ kind: "err", text: "Je wallet ondersteunt geen handtekeningen. Probeer Phantom of Solflare." });
    setBusy("activeren");
    setMsg(null);
    try {
      const message = activationMessage(product, e.number!, owner, new Date().toISOString());
      const signature = await signMessage(new TextEncoder().encode(message));
      const res = await activatePass(owner, product.id, e.number!, message, toBase64(signature));
      setCode(res.code);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof ApiError ? err.message : explainError(err) });
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
      await confirmSignature(connection, signature);
      setMsg({ kind: "ok", text: `Teruggestort: ${euro(prepared.amountMicro)} staat terug in je wallet. Je pass is verbrand.` });
      setConfirmRefund(false);
      onChange();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof ApiError ? err.message : explainError(err) });
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
    <article className="pass-block">
      <PassCard variant={product.id} number={e.number} holder={owner} status={e.teruggegeven ? "teruggegeven" : "actief"} />
      <div className="pass-side">
        <h2>{product.naam} {formatNumber(product, e.number!)}</h2>
        <dl className="kv">
          <div><dt>Status</dt><dd>{e.teruggegeven ? "Teruggegeven" : inWallet.data === undefined || inWallet.data === null ? "Wordt nagekeken..." : inWallet.data ? <span className="ok">✓ Staat in je wallet</span> : <span className="bad">Niet gevonden in deze wallet</span>}</dd></div>
          <div><dt>Gekocht</dt><dd>{dateTime(e.time)}</dd></div>
          <div><dt>Betaald</dt><dd>{euro(e.amountMicro)} {SYMBOL}</dd></div>
          <div><dt>Abonnement</dt><dd>Pro, levenslang, {product.websites === 1 ? "1 website" : `${product.websites} websites`}</dd></div>
          {!e.teruggegeven && e.time && <div><dt>Geld terug</dt><dd>{Date.now() < deadline ? `kan tot ${dateLong(deadline)}` : "bedenktijd voorbij"}</dd></div>}
          {e.mint && <div><dt>Munt</dt><dd><a className="mono" href={explorerAddress(e.mint)} target="_blank" rel="noreferrer">{shortAddress(e.mint)}</a></dd></div>}
        </dl>

        {code && (
          <div className="code-box" role="status">
            <span>Je activatiecode</span>
            <div className="code-row">
              <code>{code}</code>
              <button type="button" className="btn btn-small btn-ghost" onClick={copy}>{copied ? "Gekopieerd" : "Kopieer"}</button>
            </div>
            <small>Vul deze code in bij Marketing Scan (Account › Genesis). Je kan hem altijd opnieuw opvragen met je wallet.</small>
          </div>
        )}
        {msg && <p className={`notice ${msg.kind === "ok" ? "notice-ok" : "notice-bad"}`}>{msg.text}</p>}

        {own && !e.teruggegeven && (
          <div className="pass-actions">
            {!code && <button type="button" className="btn" disabled={busy !== ""} onClick={activate}>{busy === "activeren" ? "Onderteken in je wallet..." : "Activeer in Marketing Scan"}</button>}
            {canRefund && !confirmRefund && <button type="button" className="btn btn-ghost" disabled={busy !== ""} onClick={() => setConfirmRefund(true)}>Geld terug</button>}
          </div>
        )}
        {confirmRefund && (
          <div className="confirm">
            <p><strong>Zeker?</strong> Je pass {formatNumber(product, e.number!)} wordt verbrand en dat nummer komt niet meer terug. Je krijgt {euro(e.amountMicro)} terug in dezelfde transactie.</p>
            <div className="pass-actions">
              <button type="button" className="btn btn-danger" disabled={busy !== ""} onClick={refund}>{busy === "terug" ? "Bevestig in je wallet..." : `Ja, stort ${euro(e.amountMicro)} terug`}</button>
              <button type="button" className="btn btn-ghost" disabled={busy !== ""} onClick={() => setConfirmRefund(false)}>Toch niet</button>
            </div>
          </div>
        )}
        {!own && <p className="muted" style={{ fontSize: "0.9rem" }}>Je bekijkt deze wallet zonder in te loggen. Activeren en geld terug kan enkel de eigenaar.</p>}
      </div>
    </article>
  );
}

export default function MyPass() {
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
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--pill)" }}>Mijn pass</p>
          <h1>{owner ? (viewing && !own ? `Wallet ${shortAddress(owner)}` : "Jouw Genesis") : "Log in om je pass te zien"}</h1>
          <p>Alles hieronder komt rechtstreeks van de blockchain: je pass, je betaling en je steun.</p>
        </div>
      </section>
      <div className="container page-body">
        {!deployment && <p className="notice"><strong>Genesis is nog niet geactiveerd op dit netwerk.</strong></p>}

        {!owner && (
          <div className="login-card">
            <p className="muted">Log in met de wallet waarmee je je pass claimde. Je ziet je pass, kan hem activeren en binnen {genesis.bedenktijdDagen} dagen je geld terugvragen.</p>
            <button type="button" className="btn btn-large" onClick={open}>Inloggen met wallet</button>
            <div className="card">
              <h3 style={{ fontSize: "1.05rem" }}>Of bekijk een wallet</h3>
              <form className="view-form" onSubmit={submitLookup}>
                <label className="sr-only" htmlFor="adres">Walletadres</label>
                <input id="adres" className="input input-paper" placeholder="Solana-adres" value={lookup} onChange={(e) => setLookup(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                <button type="submit" className="btn btn-ghost">Bekijk</button>
              </form>
            </div>
          </div>
        )}

        {owner && (
          <>
            {viewing && !own && (
              <p className="notice notice-info">
                <strong>Alleen bekijken.</strong> <button type="button" className="link-button" onClick={() => setParams({})}>Terug naar je eigen wallet</button>
              </p>
            )}
            {state.error && <p className="notice notice-bad"><strong>Laden lukte niet.</strong> {state.error}</p>}
            {!state.data && !state.error && <p className="muted">Laden...</p>}
            {state.data && passes.length === 0 && support.length === 0 && (
              <div className="empty-state">
                <PassCard variant="pass" number={null} holder={owner} status="voorbeeld" footer="Nog geen pass in deze wallet" />
                <div>
                  <h2>Nog geen Genesis Pass</h2>
                  <p className="muted">Claim je genummerde pass en krijg levenslang Marketing Scan Pro. {isTestnet ? "Op het testnet kan dat gratis, met test-euro." : ""}</p>
                  <Link className="btn" to="/genesis">Claim je Genesis Pass</Link>
                </div>
              </div>
            )}
            {passes.map((e) => (
              <PassBlock key={e.signature} e={e} owner={owner} own={own} onChange={() => { state.refresh(); balance.refresh(); }} />
            ))}
            {support.length > 0 && (
              <section className="pass-block" aria-labelledby="h-steun">
                <PassCard variant="steun" holder={owner} footer="Supporter-badge · niet overdraagbaar" />
                <div className="pass-side">
                  <h2 id="h-steun">Supporter</h2>
                  <p className="muted">Je steunde Marketing Scan {support.length === 1 ? "één keer" : `${support.length} keer`}, samen {euro(supportTotal)}. Bedankt.</p>
                  <ul className="mini-list">
                    {support.map((e) => (
                      <li key={e.signature}><span>{dateTime(e.time)}</span><span>{euro(e.amountMicro)}</span><a href={explorerTx(e.signature)} target="_blank" rel="noreferrer">transactie</a></li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            {own && isTestnet && (
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Saldo test-euro: {balance.data === null ? "-" : `${euro(balance.data)} ${SYMBOL}`}. <Link to="/genesis">Nog iets claimen</Link>
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
