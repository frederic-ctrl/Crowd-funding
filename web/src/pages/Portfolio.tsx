import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { deployment, FOUNDER_WALLET, isTestnet, offering, referencePriceMicro } from "../config";
import { useHolding, usePurchasesOf } from "../lib/hooks";
import { count, dateTime, euro, percent, price, shortAddress } from "../lib/format";
import { explorerAddress, explorerTx } from "../lib/explorer";
import { Address, LogoMark, Value } from "../components/ui";
import { useWalletUi } from "../components/Wallet";

const TOTAL = offering.token.totaal;

function isAddress(value: string) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export default function Portfolio() {
  const { publicKey, disconnect } = useWallet();
  const [params, setParams] = useSearchParams();
  const viewing = params.get("adres");
  const viewAddress = viewing && isAddress(viewing) ? viewing : null;
  const owner = viewAddress ?? publicKey?.toBase58() ?? null;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--pill)" }}>Mijn portefeuille</p>
          <h1>{owner ? "Jouw deel van Marketing Scan" : "Log in om je deel te zien"}</h1>
          <p>Alles hieronder komt live van de blockchain: je aantal aandelen, je percentage en je aankopen.</p>
        </div>
      </section>
      <div className="container page-body">
        {!deployment ? (
          <p className="notice"><strong>De demo is nog niet geactiveerd.</strong> Zodra de token op het testnet staat, zie je hier je aandelen.</p>
        ) : owner ? (
          <Dashboard
            owner={owner}
            readOnly={Boolean(viewAddress) && viewAddress !== publicKey?.toBase58()}
            onLeave={() => (viewAddress ? setParams({}) : void disconnect())}
          />
        ) : (
          <Login onView={(a) => setParams({ adres: a })} />
        )}
      </div>
    </>
  );
}

function Login({ onView }: { onView: (address: string) => void }) {
  const { open } = useWalletUi();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!isAddress(v)) return setError("Dat is geen geldig Solana-adres.");
    setError("");
    onView(v);
  }

  return (
    <div className="login-card">
      <LogoMark size={48} />
      <h2>Inloggen met je wallet</h2>
      <p className="muted">Je wallet is je login. We vragen nooit je geheime zin.</p>
      <button type="button" className="btn btn-large" onClick={open}>Inloggen</button>
      <div className="card">
        <h3>Of bekijk een adres zonder in te loggen</h3>
        <p className="muted" style={{ fontSize: "0.93rem" }}>Alles op de blockchain is publiek. Plak een walletadres om de aandelen ervan te bekijken.</p>
        <form className="view-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="adres">Walletadres</label>
          <input id="adres" className="input mono" placeholder="Solana-adres" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck={false} />
          <button className="btn btn-ghost" type="submit">Bekijken</button>
        </form>
        {error && <p className="form-status err">{error}</p>}
        <button type="button" className="link-button" style={{ justifySelf: "start", fontSize: "0.93rem" }} onClick={() => onView(FOUNDER_WALLET)}>
          Bekijk de wallet van de oprichter
        </button>
      </div>
    </div>
  );
}

function Dashboard({ owner, readOnly, onLeave }: { owner: string; readOnly: boolean; onLeave: () => void }) {
  const holding = useHolding(owner, 30_000);
  const purchases = usePurchasesOf(holding.data?.shareAccount ?? null);
  const { price: refPrice, round } = referencePriceMicro();
  const tokens = Number(holding.data?.tokens ?? 0n);
  const loading = !holding.data && !holding.error;
  const isFounder = owner === FOUNDER_WALLET;
  const oneIn = tokens > 0 ? Math.round(TOTAL / tokens) : 0;

  return (
    <>
      {readOnly && (
        <p className="notice notice-info">
          <strong>Je bekijkt een ander adres.</strong> Alleen-lezen: <span className="mono">{shortAddress(owner, 6)}</span>.{" "}
          <button type="button" className="link-button" onClick={onLeave}>Terug</button>
        </p>
      )}
      {holding.error && <p className="notice notice-bad"><strong>Laden lukte niet.</strong> {holding.error}</p>}

      <div className="dash">
        <section className="cert" aria-label="Jouw aandelen">
          <div className="cert-top">
            <div className="cert-token">
              <LogoMark size={40} />
              <div>
                <strong>{offering.token.naam}{isTestnet ? " (testnet)" : ""}</strong>
                <span>{offering.token.symbool} · Token-2022 · Solana</span>
              </div>
            </div>
            <span className="status status-open">{isFounder ? "Oprichter" : tokens > 0 ? "Mede-eigenaar" : "Nog geen aandelen"}</span>
          </div>
          <p className="cert-amount">
            <Value loading={loading} width="5ch">{count(tokens)}</Value>
            <small>aandelen</small>
          </p>
          <dl className="cert-grid">
            <div>
              <dt>Deel van Marketing Scan</dt>
              <dd><Value loading={loading}>{percent(tokens, TOTAL)}</Value></dd>
            </div>
            <div>
              <dt>Indicatieve waarde</dt>
              <dd><Value loading={loading}>{euro(tokens * refPrice)}</Value></dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><Value loading={loading}>{holding.data?.exists ? (holding.data.frozen ? "Vergrendeld" : "Vrij") : "-"}</Value></dd>
            </div>
          </dl>
          <p className="cert-note">
            {tokens > 0 ? `Je bezit 1 op elke ${count(oneIn)} aandelen. ` : ""}
            Waarde volgens de prijs van {round.naam} ({price(refPrice)} per aandeel). Dat is geen verkoopprijs.
          </p>
        </section>

        <div className="side-cards">
          <div className="card">
            <span className="card-label">Wallet</span>
            <Address value={owner} chars={6} />
            {!readOnly && <button type="button" className="link-button" style={{ justifySelf: "start" }} onClick={onLeave}>Uitloggen</button>}
          </div>
          {isTestnet && (
            <div className="card">
              <span className="card-label">Saldo test-euro</span>
              <span className="card-value"><Value loading={loading}>{euro(holding.data?.paymentMicro ?? 0n)}</Value></span>
              {!readOnly && <Link to="/investeren">Investeren</Link>}
            </div>
          )}
          <div className="card">
            <span className="card-label">Uitkeringen ontvangen</span>
            <span className="card-value">{euro(0)}</span>
            <p className="muted" style={{ fontSize: "0.92rem" }}>Als er winst is en we keren uit, komt je deel rechtstreeks in je wallet, in een euro-stablecoin.</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="h-aankopen" style={{ display: "grid", gap: "1rem" }}>
        <h2 id="h-aankopen" style={{ fontSize: "1.6rem" }}>Aankopen</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Datum</th><th className="r">Aandelen</th><th className="r">Betaald</th><th>Transactie</th></tr>
            </thead>
            <tbody>
              {purchases.loading && !purchases.data && (
                <tr><td colSpan={4} className="empty">Aankopen laden...</td></tr>
              )}
              {purchases.data?.length === 0 && (
                <tr><td colSpan={4} className="empty">{isFounder ? "De oprichter kocht niet: de 51% werd bij de start toegewezen en vergrendeld." : "Nog geen aankopen."}</td></tr>
              )}
              {purchases.data?.map((p) => (
                <tr key={p.signature}>
                  <td>{dateTime(p.time)}</td>
                  <td className="r">{count(p.tokens)}</td>
                  <td className="r">{euro(p.paidMicro)}</td>
                  <td><a href={explorerTx(p.signature)} target="_blank" rel="noreferrer" className="mono">{shortAddress(p.signature, 6)}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {holding.data?.exists && (
          <p className="muted" style={{ fontSize: "0.92rem" }}>
            Je aandelenaccount op de blockchain: <a href={explorerAddress(holding.data.shareAccount)} target="_blank" rel="noreferrer" className="mono">{shortAddress(holding.data.shareAccount, 6)}</a>
          </p>
        )}
      </section>
    </>
  );
}
