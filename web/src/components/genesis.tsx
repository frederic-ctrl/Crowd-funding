// Bouwstenen van Genesis: de pass (voor- en achterkant), de prijsladder en de Genesis-muur.
import { AGENCY, PASS, genesis, type Product } from "../config";
import { formatNumber, ladderState, priceForNumber } from "../../../shared/genesis.js";
import { euro, shortAddress } from "../lib/format";
import { explorerTx } from "../lib/explorer";
import type { GenesisEvent, GenesisState } from "../lib/api";
import { useLang, type Lang } from "../i18n";
import { LogoMark } from "./ui";

export type PassVariant = "pass" | "agency" | "steun";

export function productOf(id: string | null): Product | null {
  return id === "agency" ? AGENCY : id === "pass" ? PASS : null;
}

const KIND: Record<PassVariant, string> = { pass: "GENESIS", agency: "AGENCY", steun: "SUPPORTER" };

const CARD = {
  en: { holder: "Holder", yours: "Your wallet", plan: "Lifetime Pro", site: (n: number) => (n === 1 ? "1 website" : `${n} websites`), refunded: "Refunded", thanks: "Thank you", builder: "Builder" },
  nl: { holder: "Houder", yours: "Jouw wallet", plan: "Levenslang Pro", site: (n: number) => (n === 1 ? "1 website" : `${n} websites`), refunded: "Teruggegeven", thanks: "Bedankt", builder: "Bouwt mee" },
};

/** De pass zoals hij in je wallet staat: een strakke kaart in zwart titanium (Pass), zilver (Agency) of blauw (Supporter). */
export function PassCard({ variant, number, holder, status }: { variant: PassVariant; number?: number | null; holder?: string | null; status?: "actief" | "teruggegeven" }) {
  const { lang } = useLang();
  const t = CARD[lang];
  const product = productOf(variant);
  const big = variant === "steun" ? "Supporter" : number ? formatNumber(product!, number) : `#${"0".repeat(String(product!.max).length)}`;
  return (
    <figure className={`pass-card pass-${variant}${status === "teruggegeven" ? " is-void" : ""}`} aria-label={variant === "steun" ? "Marketing Scan Supporter" : `${product!.naam} ${number ? big : ""}`}>
      <div className="pass-top">
        <span className="pass-brand"><LogoMark /> Marketing Scan</span>
        <span className="pass-kind">{KIND[variant]}</span>
      </div>
      <div className="pass-mid">
        <span className="pass-number" style={variant === "steun" ? { fontSize: "11cqw" } : undefined}>{big}</span>
        {variant !== "steun" && <span className="pass-name">{product!.naam}</span>}
      </div>
      <div className="pass-bottom">
        <div>
          {t.holder}
          <b className="mono">{holder ? shortAddress(holder) : t.yours}</b>
        </div>
        <div>
          {status === "teruggegeven" ? t.refunded : variant === "steun" ? t.thanks : t.plan}
          <b>{variant === "steun" ? t.builder : t.site(product!.websites)}</b>
        </div>
      </div>
    </figure>
  );
}

const BACK = {
  en: {
    pass: (n: number) => [`Marketing Scan Pro for ${n === 1 ? "1 website" : `${n} websites`}`, "Every future Pro feature included", "14-day refund, one click"],
    steun: ["You help build Marketing Scan", "Your name on the Genesis wall", "No subscription"],
    fine: "Not an investment · Non-transferable",
  },
  nl: {
    pass: (n: number) => [`Marketing Scan Pro voor ${n === 1 ? "1 website" : `${n} websites`}`, "Elke nieuwe Pro-functie inbegrepen", "14 dagen geld terug, één klik"],
    steun: ["Je bouwt mee aan Marketing Scan", "Je naam op de Genesis-muur", "Geen abonnement"],
    fine: "Geen investering · Niet overdraagbaar",
  },
};

export function PassBack({ variant }: { variant: PassVariant }) {
  const { lang } = useLang();
  const t = BACK[lang];
  const product = productOf(variant);
  const lines = variant === "steun" ? t.steun : t.pass(product!.websites);
  return (
    <div className={`pass-card pass-back pass-${variant}`}>
      <div className="pass-top">
        <span className="pass-brand"><LogoMark /> Marketing Scan</span>
        <span className="pass-kind">{KIND[variant]}</span>
      </div>
      <div className="pass-mid">
        <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
      <div className="pass-bottom">
        <div>{t.fine}</div>
        <div>community.marketingscan.be</div>
      </div>
    </div>
  );
}

type Rung = { van: number; tot: number; prijsMicro: number; verkocht: number; beschikbaar: number; status: "uitverkocht" | "nu" | "later" };

/** De prijsladder als oplopende staven: hoe vroeger, hoe goedkoper. */
export function Ladder({ product, used }: { product: Product; used: number }) {
  const rungs = ladderState(product, used) as Rung[];
  const prices = rungs.map((r) => r.prijsMicro);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return (
    <div className="ladder" role="list">
      {rungs.map((r) => {
        const size = r.tot - r.van + 1;
        const h = hi === lo ? 180 : 96 + ((r.prijsMicro - lo) / (hi - lo)) * 164;
        return (
          <div key={r.van} role="listitem" className={`rung${r.status === "nu" ? " now" : r.status === "uitverkocht" ? " sold" : ""}`}>
            <span className="rung-price">{euro(r.prijsMicro, { whole: true })}</span>
            <div className="rung-bar" style={{ ["--h" as string]: `${h}px`, ["--fill" as string]: `${(r.verkocht / size) * 100}%` }} aria-hidden="true">
              <i />
            </div>
            <span className="rung-range">{formatNumber(product, r.van)}–{formatNumber(product, r.tot).slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

function hue(wallet: string, offset: number) {
  let h = 0;
  for (let i = offset; i < wallet.length; i += 3) h = (h * 31 + wallet.charCodeAt(i)) % 360;
  return h;
}

/** Een herkenbaar kleurbolletje per wallet, zonder externe diensten. */
export function Avatar({ wallet }: { wallet: string }) {
  return <span className="avatar" aria-hidden="true" style={{ background: `linear-gradient(135deg, hsl(${hue(wallet, 0)} 72% 58%), hsl(${hue(wallet, 1)} 76% 44%))` }} />;
}

export function eventLabel(e: GenesisEvent, lang: Lang = "en"): string {
  if (e.kind === "steun") return `Supporter · ${euro(e.amountMicro)}`;
  const p = productOf(e.productId);
  if (!p || !e.number) return "Genesis";
  return `${p.naam} ${formatNumber(p, e.number)}${e.teruggegeven ? (lang === "nl" ? " (teruggegeven)" : " (refunded)") : ""}`;
}

/** De Genesis-muur: iedereen die meedoet, met de naam die die zelf koos, of het walletadres. */
export function Wall({ entries }: { entries: GenesisEvent[] }) {
  const { lang } = useLang();
  return (
    <ul className="wall">
      {entries.map((e) => {
        const p = productOf(e.productId);
        return (
          <li key={e.signature} className={`chip${e.teruggegeven ? " void" : ""}`}>
            <a href={explorerTx(e.signature)} target="_blank" rel="noreferrer" title={eventLabel(e, lang)}>
              <Avatar wallet={e.wallet} />
              <strong>{e.name || shortAddress(e.wallet)}</strong>
              <small>{e.kind === "steun" ? "Supporter" : p && e.number ? formatNumber(p, e.number) : ""}</small>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

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
