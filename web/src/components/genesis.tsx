// Bouwstenen van Genesis: de pass zoals hij in je wallet staat, de prijsladder en de Genesis-muur.
import type { ReactNode } from "react";
import { AGENCY, PASS, genesis, type Product } from "../config";
import { formatNumber, ladderState, priceForNumber } from "../../../shared/genesis.js";
import { ago, count, euro, shortAddress } from "../lib/format";
import { explorerTx } from "../lib/explorer";
import type { GenesisEvent, GenesisState } from "../lib/api";
import { LogoMark } from "./ui";

export type PassVariant = "pass" | "agency" | "steun";

export function productOf(id: string | null): Product | null {
  return id === "agency" ? AGENCY : id === "pass" ? PASS : null;
}

/** De pass zoals hij in je wallet staat. */
export function PassCard({
  variant,
  number,
  holder,
  status,
  footer,
}: {
  variant: PassVariant;
  number?: number | null;
  holder?: string | null;
  status?: "actief" | "voorbeeld" | "teruggegeven";
  footer?: ReactNode;
}) {
  const product = productOf(variant);
  const label = variant === "steun" ? "Supporter" : product!.naam;
  const big = variant === "steun" ? "♥" : number ? formatNumber(product!, number) : product ? `#${"0".repeat(String(product.max).length)}` : "";
  return (
    <figure className={`pass-card pass-${variant}${status === "teruggegeven" ? " is-void" : ""}`} aria-label={`${label}${number ? ` ${big}` : ""}`}>
      <div className="pass-glow" aria-hidden="true" />
      <div className="pass-lines" aria-hidden="true"><span /><span /><span /></div>
      <div className="pass-top">
        <span className="pass-brand"><LogoMark size={20} /> Marketing Scan</span>
        <span className="pass-chip">{variant === "steun" ? "SUPPORTER" : "GENESIS"}</span>
      </div>
      <div className="pass-number">{big}</div>
      <div className="pass-name">{label}</div>
      <dl className="pass-meta">
        <div><dt>Houder</dt><dd className="mono">{holder ? shortAddress(holder) : "jouw wallet"}</dd></div>
        {variant === "steun" ? (
          <div><dt>Abonnement</dt><dd>geen</dd></div>
        ) : (
          <>
            <div><dt>Geldig</dt><dd>levenslang</dd></div>
            <div><dt>Websites</dt><dd>{product!.websites}</dd></div>
          </>
        )}
      </dl>
      <figcaption className="pass-foot">{footer ?? (status === "teruggegeven" ? "Teruggegeven: geld terugbetaald" : "Soulbound op Solana · niet overdraagbaar")}</figcaption>
      {status === "voorbeeld" && <span className="pass-stamp">volgende</span>}
      {status === "teruggegeven" && <span className="pass-stamp">teruggegeven</span>}
    </figure>
  );
}

/** De achterkant van de pass, voor als hij ronddraait. */
export function PassBack({ variant }: { variant: PassVariant }) {
  const product = productOf(variant);
  const lines =
    variant === "steun"
      ? ["Je bouwt mee aan Marketing Scan", "Je naam op de Genesis-muur", "Geen abonnement, gewoon steun"]
      : [`Levenslang Marketing Scan Pro voor ${product!.websites === 1 ? "1 website" : `${product!.websites} websites`}`, "Elke nieuwe Pro-functie inbegrepen", "14 dagen geld terug, met één klik"];
  return (
    <div className={`pass-card pass-back pass-${variant}`}>
      <div className="pass-glow" aria-hidden="true" />
      <span className="pass-strip" aria-hidden="true" />
      <div className="pass-top">
        <span className="pass-brand"><LogoMark size={20} /> Marketing Scan</span>
        <span className="pass-chip">{variant === "steun" ? "SUPPORTER" : "GENESIS"}</span>
      </div>
      <ul className="pass-perks">
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <div className="pass-foot pass-back-foot">
        <span>Geen investering · niet overdraagbaar</span>
        <span>community.marketingscan.be</span>
      </div>
    </div>
  );
}

/** De prijsladder: hoe vroeger, hoe goedkoper. */
export function Ladder({ product, used, compact = false }: { product: Product; used: number; compact?: boolean }) {
  const tiers = ladderState(product, used) as { van: number; tot: number; prijsMicro: number; verkocht: number; beschikbaar: number; status: "uitverkocht" | "nu" | "later" }[];
  return (
    <ol className={`ladder${compact ? " is-compact" : ""}`} aria-label={`Prijsladder ${product.naam}`}>
      {tiers.map((t) => {
        const size = t.tot - t.van + 1;
        return (
          <li key={t.van} className={`tier tier-${t.status}`}>
            <div className="tier-head">
              <span className="tier-range mono">{formatNumber(product, t.van)} tot {formatNumber(product, t.tot)}</span>
              <b className="tier-price">{euro(t.prijsMicro, { whole: true })}</b>
            </div>
            <div className="tier-bar" role="img" aria-label={`${t.verkocht} van ${size} verkocht`}>
              <span style={{ width: `${(t.verkocht / size) * 100}%` }} />
            </div>
            <div className="tier-foot">
              {t.status === "uitverkocht" ? "uitverkocht" : t.status === "nu" ? <strong>nu: nog {count(t.beschikbaar)} aan deze prijs</strong> : `${count(size)} passes`}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function hue(wallet: string, offset: number) {
  let h = 0;
  for (let i = offset; i < wallet.length; i += 3) h = (h * 31 + wallet.charCodeAt(i)) % 360;
  return h;
}

/** Een herkenbaar kleurbolletje per wallet, zonder externe diensten. */
export function Avatar({ wallet }: { wallet: string }) {
  return <span className="avatar" aria-hidden="true" style={{ background: `linear-gradient(135deg, hsl(${hue(wallet, 0)} 70% 55%), hsl(${hue(wallet, 1)} 75% 45%))` }} />;
}

export function eventLabel(e: GenesisEvent): string {
  if (e.kind === "steun") return `Supporter · ${euro(e.amountMicro)}`;
  const p = productOf(e.productId);
  return p && e.number ? `${p.naam} ${formatNumber(p, e.number)}` : "Genesis";
}

/** De Genesis-muur: iedereen die meedoet, met naam (als ze dat wilden) en een link naar de transactie. */
export function Wall({ entries, empty }: { entries: GenesisEvent[]; empty?: ReactNode }) {
  if (entries.length === 0) return <p className="wall-empty">{empty ?? "Nog niemand op de muur. Word de eerste."}</p>;
  return (
    <ul className="wall">
      {entries.map((e) => (
        <li key={e.signature} className={`wall-item wall-${e.productId}${e.teruggegeven ? " is-void" : ""}`}>
          <Avatar wallet={e.wallet} />
          <div className="wall-body">
            <strong>{e.name || shortAddress(e.wallet)}</strong>
            <span>{eventLabel(e)}{e.teruggegeven ? " · teruggegeven" : ""}</span>
          </div>
          <a className="wall-time" href={explorerTx(e.signature)} target="_blank" rel="noreferrer" title="Bekijk de transactie">
            {e.time ? ago(e.time * 1000) : "bekijk"}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Wat er opgehaald is tegenover het doel. */
export function goalMicro() {
  return genesis.doelEur * 1_000_000;
}

/** Alles wat de site uit de stand van Genesis afleidt: volgende nummers, prijzen, buffer voor terugbetalingen. */
export function view(s: GenesisState | null, now = Date.now()) {
  const product = (p: Product) => {
    const st = s?.producten[p.id];
    const used = st?.hoogsteNummer ?? 0;
    const next = used < p.max ? used + 1 : null;
    return {
      used,
      next,
      price: next ? (priceForNumber(p, next) as number) : null,
      claimed: st ? st.verkocht - st.teruggegeven : 0,
      left: p.max - used,
    };
  };
  const bufferMicro = (s?.muur ?? [])
    .filter((e) => e.kind === "aankoop" && !e.teruggegeven && e.time && e.time * 1000 + genesis.bedenktijdDagen * 86_400_000 > now)
    .reduce((sum, e) => sum + e.amountMicro, 0);
  return { pass: product(PASS), agency: product(AGENCY), bufferMicro };
}
