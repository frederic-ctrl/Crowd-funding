import { deployment, offering } from "../config";
import { useNow, useOfferingState, useRecentPurchases } from "../lib/hooks";
import { ago, count, dateTime, euro, percent, shortAddress } from "../lib/format";
import { explorerAddress, explorerTx } from "../lib/explorer";
import { Address, Check } from "../components/ui";

const TOTAL = offering.token.totaal;

type Slice = { label: string; value: number; className: string };

function Donut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={slices.map((s) => `${s.label} ${percent(s.value, total)}`).join(", ")}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
      {slices.map((s) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={s.label}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="14"
            className={s.className}
            style={{ stroke: `var(--${s.className})` }}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += len;
        return el;
      })}
      <text x="50" y="49" textAnchor="middle" className="donut-center-big">{count(total)}</text>
      <text x="50" y="58" textAnchor="middle" className="donut-center-small">aandelen in totaal</text>
    </svg>
  );
}

export default function Transparency() {
  const state = useOfferingState(15_000);
  const purchases = useRecentPurchases(12, 20_000);
  useNow();
  const s = state.data;
  const pending = !s;
  const r1 = offering.rondes[0];
  const vault1 = s?.vaults["ronde-1"];
  const vault2 = s?.vaults["ronde-2"];
  const sold = vault1 ? r1.tokens - Number(vault1.amount) : 0;

  const slices: Slice[] = [
    { label: "Oprichter", value: offering.allocaties.oprichter, className: "seg-founder" },
    { label: "Ronde 1 verkocht", value: sold, className: "seg-sold" },
    { label: "Ronde 1 beschikbaar", value: offering.allocaties["ronde-1"] - sold, className: "seg-open" },
    { label: "Ronde 2 reserve", value: offering.allocaties["ronde-2"], className: "seg-reserve" },
  ];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--pill)" }}>Transparantie</p>
          <h1>Vertrouw ons niet. Controleer het.</h1>
          <p>Deze pagina leest alles live van de Solana-blockchain. Elke regel heeft een link, zodat je het ook zonder ons kan nakijken.</p>
        </div>
      </section>
      <div className="container page-body">
        {!deployment ? (
          <p className="notice"><strong>De demo is nog niet geactiveerd.</strong> Zodra de token op het testnet staat, verschijnen hier alle controles.</p>
        ) : (
          <>
            {state.error && <p className="notice notice-bad"><strong>Laden lukte niet.</strong> {state.error}</p>}
            <div className="trans-grid">
              <section className="card donut-wrap" aria-labelledby="h-verdeling">
                <h2 id="h-verdeling" style={{ fontSize: "1.3rem", justifySelf: "start" }}>Verdeling</h2>
                <Donut slices={slices} />
                <ul className="legend" style={{ justifySelf: "start" }}>
                  {slices.map((x) => (
                    <li key={x.label}><i className={`key ${x.className}`} />{x.label}: {count(x.value)} ({percent(x.value, TOTAL)})</li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="h-controles">
                <h2 id="h-controles" style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Controles</h2>
                <ul className="checks">
                  <Check state={pending ? "wait" : s.supply === BigInt(TOTAL) ? "ok" : "bad"} title="Vaste voorraad" link={{ href: explorerAddress(deployment.tokenMint), label: "Token" }}>
                    {s ? `${count(s.supply)} aandelen op de keten, verwacht ${count(TOTAL)}.` : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={pending ? "wait" : s.mintAuthority === null ? "ok" : "bad"} title="Muntrecht ingetrokken" link={{ href: explorerAddress(deployment.tokenMint), label: "Token" }}>
                    {s ? (s.mintAuthority === null ? "Niemand kan nog aandelen bijmaken." : `Muntrecht ligt nog bij ${shortAddress(s.mintAuthority)}.`) : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={pending ? "wait" : s.founder?.frozen ? "ok" : "bad"} title="Oprichter vergrendeld" link={{ href: explorerAddress(deployment.founderTokenAccount), label: "Oprichter" }}>
                    {s?.founder ? `${count(s.founder.amount)} aandelen, ${s.founder.frozen ? "vergrendeld" : "NIET vergrendeld"}.` : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={pending ? "wait" : vault2?.frozen ? "ok" : "bad"} title="Reserve ronde 2 vergrendeld" link={{ href: explorerAddress(deployment.vaults["ronde-2"]), label: "Reserve" }}>
                    {vault2 ? `${count(vault2.amount)} aandelen, enkel te gebruiken voor ronde 2.` : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={pending ? "wait" : "ok"} title="Verkoopkluis ronde 1" link={{ href: explorerAddress(deployment.vaults["ronde-1"]), label: "Kluis" }}>
                    {vault1 ? `${count(vault1.amount)} van ${count(r1.tokens)} nog beschikbaar. Verkocht: ${count(sold)}.` : "Wordt gecontroleerd."}
                  </Check>
                  <Check state={pending ? "wait" : "ok"} title="Escrow" link={{ href: explorerAddress(deployment.escrow), label: "Escrow" }}>
                    {s ? `${euro(s.escrowMicro)} ontvangen. Minimumdoel ronde 1: ${euro((r1.minimumdoelEur ?? 0) * 1_000_000, { whole: true })}.` : "Wordt gecontroleerd."}
                  </Check>
                </ul>
                <p className="muted" style={{ fontSize: "0.88rem", marginTop: "0.75rem" }}>{state.updatedAt ? `Laatst gecontroleerd ${ago(state.updatedAt)}.` : "Bezig met controleren..."}</p>
              </section>
            </div>

            <section className="card" aria-labelledby="h-aankopen">
              <h2 id="h-aankopen" style={{ fontSize: "1.3rem" }}>Laatste aankopen</h2>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead>
                    <tr><th>Datum</th><th>Koper</th><th className="r">Aandelen</th><th className="r">Betaald</th><th>Transactie</th></tr>
                  </thead>
                  <tbody>
                    {!purchases.data && <tr><td colSpan={5} className="empty">Laden...</td></tr>}
                    {purchases.data?.length === 0 && <tr><td colSpan={5} className="empty">Nog geen aankopen.</td></tr>}
                    {purchases.data?.map((p) => (
                      <tr key={p.signature}>
                        <td>{dateTime(p.time)}</td>
                        <td><a className="mono" href={`/portefeuille?adres=${p.buyer}`}>{shortAddress(p.buyer)}</a></td>
                        <td className="r">{count(p.tokens)}</td>
                        <td className="r">{euro(p.paidMicro)}</td>
                        <td><a className="mono" href={explorerTx(p.signature)} target="_blank" rel="noreferrer">{shortAddress(p.signature, 6)}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card" aria-labelledby="h-adressen">
              <h2 id="h-adressen" style={{ fontSize: "1.3rem" }}>Alle adressen</h2>
              <div className="addr-list">
                <div className="addr-row"><span>Aandelentoken (MSCAN)</span><Address value={deployment.tokenMint} /></div>
                <div className="addr-row"><span>Oprichterswallet</span><Address value={deployment.founderWallet} /></div>
                <div className="addr-row"><span>Aandelen van de oprichter</span><Address value={deployment.founderTokenAccount} /></div>
                <div className="addr-row"><span>Verkoopkluis ronde 1</span><Address value={deployment.vaults["ronde-1"]} /></div>
                <div className="addr-row"><span>Reserve ronde 2</span><Address value={deployment.vaults["ronde-2"]} /></div>
                <div className="addr-row"><span>Escrow (betalingen)</span><Address value={deployment.escrow} /></div>
                <div className="addr-row"><span>Serversleutel (betaalt kosten, beheert de kluis)</span><Address value={deployment.authority} /></div>
                {deployment.recoveryKey && <div className="addr-row"><span>Herstelsleutel (offline, enkel voor verloren wallets)</span><Address value={deployment.recoveryKey} /></div>}
                <div className="addr-row"><span>Betaalmunt ({offering.betaalmunt.symbool})</span><Address value={deployment.paymentMint} /></div>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
