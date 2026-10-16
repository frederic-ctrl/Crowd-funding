// Rekenregels van Marketing Scan Genesis. Gedeeld door de website, de server en de scripts,
// zodat iedereen exact hetzelfde rekent. Bedragen in euro staan in basiseenheden van
// 6 decimalen (1 euro = 1.000.000), zoals tEUR, EURC en USDC op Solana.

import { msg } from "./messages.js";

export const EUR = 1_000_000;
export const DAY_MS = 86_400_000;

/** Tekst of getal ("1", "2,50", "1.000") naar basiseenheden, afgerond op hele centen. NaN als het geen bedrag is. */
export function parseEuro(input) {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) * 10_000 : NaN;
  let s = String(input ?? "").replace(/[\s€]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return NaN;
  return Math.round(Number(s) * 100) * 10_000;
}

export function formatEur(micro) {
  return (micro / EUR).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function findProduct(cfg, id) {
  return cfg.producten.find((p) => p.id === id) ?? null;
}

/** Prijs in basiseenheden van pass nummer n (1 = de eerste), of null als het nummer niet bestaat. */
export function priceForNumber(product, n) {
  if (!Number.isInteger(n) || n < 1 || n > product.max) return null;
  const tier = product.prijsladder.find((t) => n <= t.tot);
  return tier ? tier.prijsEur * EUR : null;
}

/** "#042" voor een pass uit 250, "#07" voor een pass uit 25. */
export function formatNumber(product, n) {
  return `#${String(n).padStart(String(product.max).length, "0")}`;
}

export function passName(product, n) {
  return `${product.tokenNaam} ${formatNumber(product, n)}`;
}

/** Hoeveel de volledige reeks opbrengt als alles verkocht is. */
export function maxRevenueMicro(product) {
  let from = 0;
  let total = 0;
  for (const t of product.prijsladder) {
    total += (t.tot - from) * t.prijsEur * EUR;
    from = t.tot;
  }
  return total;
}

/** De prijsladder met per trede: verkocht, nog beschikbaar en of dit de huidige trede is. */
export function ladderState(product, used) {
  let from = 0;
  return product.prijsladder.map((t) => {
    const size = t.tot - from;
    const sold = Math.max(0, Math.min(size, used - from));
    const state = sold >= size ? "uitverkocht" : used >= from ? "nu" : "later";
    const tier = { van: from + 1, tot: t.tot, prijsMicro: t.prijsEur * EUR, verkocht: sold, beschikbaar: size - sold, status: state };
    from = t.tot;
    return tier;
  });
}

/** Publieke naam op de muur: optioneel, kort en zonder vreemde tekens. Geeft { naam } of { fout }. */
export function cleanName(input, lang = "nl") {
  const naam = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!naam) return { naam: "" };
  if (naam.length > 24) return { fout: msg(lang).nameTooLong() };
  if (!/^[\p{L}\p{N} @._'-]+$/u.test(naam)) return { fout: msg(lang).nameChars() };
  return { naam };
}

// Elke transactie krijgt een vaste, leesbare memo. Zo kan iedereen de geschiedenis nalezen.
const MEMO = /^Marketing Scan (Genesis Pass|Genesis Agency|Supporter|terugbetaling Genesis Pass|terugbetaling Genesis Agency|opname)(?: #(\d+))?(?: \| (.*))?$/;

export function memoFor({ kind, product, number, name }) {
  const base = kind === "steun" ? "Marketing Scan Supporter" : kind === "opname" ? "Marketing Scan opname" : `Marketing Scan ${kind === "terugbetaling" ? "terugbetaling " : ""}${product.naam}`;
  const nr = number ? ` ${formatNumber(product, number)}` : "";
  return `${base}${nr}${name ? ` | ${name}` : ""}`;
}

/** Leest een memo terug. Geeft null als het geen Genesis-memo is. */
export function parseMemo(cfg, text) {
  const m = MEMO.exec(String(text ?? "").replace(/^\[\d+\] /, ""));
  if (!m) return null;
  const [, what, nr, name = ""] = m;
  if (what === "Supporter") return { kind: "steun", productId: "steun", number: null, name };
  if (what === "opname") return { kind: "opname", productId: null, number: null, name };
  const refund = what.startsWith("terugbetaling ");
  const product = cfg.producten.find((p) => p.naam === what.replace("terugbetaling ", ""));
  if (!product || !nr) return null;
  return { kind: refund ? "terugbetaling" : "aankoop", productId: product.id, number: Number(nr), name };
}

/** Is de verkoop open? Op het testnet altijd (demo). Op mainnet enkel met verkoopActief en binnen de periode. */
export function saleIsOpen(cfg, network, now = new Date()) {
  if (cfg.sluit && now > new Date(cfg.sluit)) return false;
  if (network !== "mainnet-beta") return true;
  if (cfg.verkoopActief !== true) return false;
  if (cfg.opent && now < new Date(cfg.opent)) return false;
  return true;
}

function closedMessage(cfg, now, lang) {
  return cfg.sluit && now > new Date(cfg.sluit) ? msg(lang).saleOver() : msg(lang).saleNotOpen();
}

/**
 * Controleert de aankoop van een pass. Geeft fouten in gewone taal terug (leeg = in orde).
 * @param {{ cfg: object, product: object, nextNumber: number | null, held: number, balanceMicro?: number, network: string, now?: Date, lang?: "en" | "nl" }} p
 */
export function checkPassPurchase({ cfg, product, nextNumber, held, balanceMicro, network, now = new Date(), lang = "nl" }) {
  if (!saleIsOpen(cfg, network, now)) return [closedMessage(cfg, now, lang)];
  const m = msg(lang);
  const errors = [];
  const price = nextNumber ? priceForNumber(product, nextNumber) : null;
  if (price === null) return [m.soldOut(product.naam)];
  if (held >= product.maxPerWallet) {
    errors.push(product.maxPerWallet === 1 ? m.onePerWallet(product.naam) : m.maxPerWallet(held, product.naam, product.maxPerWallet));
  }
  if (balanceMicro !== undefined && balanceMicro < price) {
    errors.push(m.notEnoughForPass(product.naam, lang === "en" ? (price / EUR).toFixed(2) : formatEur(price)));
  }
  return errors;
}

/** Controleert een steun vanaf €1. */
export function checkSupport({ cfg, eurMicro, balanceMicro, network, now = new Date(), lang = "nl" }) {
  if (!saleIsOpen(cfg, network, now)) return [closedMessage(cfg, now, lang)];
  const m = msg(lang);
  const s = cfg.steun;
  if (!Number.isFinite(eurMicro) || eurMicro <= 0) return [m.enterAmount()];
  const errors = [];
  if (eurMicro < s.minimumEur * EUR) errors.push(m.minimum(s.minimumEur));
  if (eurMicro > s.maximumEur * EUR) errors.push(m.maximum(s.maximumEur));
  if (balanceMicro !== undefined && eurMicro > balanceMicro) errors.push(m.notEnoughForSupport());
  return errors;
}

/** Tot wanneer je geld terug kan vragen (ms sinds 1970), op basis van het tijdstip van aankoop (seconden). */
export function refundDeadline(cfg, purchaseTimeSec) {
  return purchaseTimeSec * 1000 + cfg.bedenktijdDagen * DAY_MS;
}

/** De tekst die je in je wallet ondertekent om je pass te activeren. Kost niets en verstuurt geen transactie. */
export function activationMessage(product, number, wallet, isoTime) {
  return `Marketing Scan Genesis\nIk activeer ${passName(product, number)} met wallet ${wallet}.\nTijdstip: ${isoTime}`;
}
