import { EUR } from "../../../shared/genesis.js";

// Getallen en bedragen volgen de taal van de site: €1,684.50 in het Engels, € 1.684,50 in het Nederlands.
let locale = "en-IE";

export function setLocale(lang: "en" | "nl") {
  locale = lang === "nl" ? "nl-BE" : "en-IE";
}

export function currentLocale() {
  return locale;
}

export function euro(micro: number | bigint, { whole = false } = {}): string {
  const value = Number(micro) / EUR;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(value);
}

/** Bedrag in een betaalmunt, zoals een wallet het toont: "110.96 USDC" of "99.00 EURC". */
export function coinAmount(micro: number, coin: { symbool: string; decimalen: number }): string {
  const value = micro / 10 ** coin.decimalen;
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${coin.symbool}`;
}

export function count(n: number | bigint): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(n));
}

export function shortAddress(address: string, chars = 4): string {
  return address.length <= chars * 2 + 1 ? address : `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function dateTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "-";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(unixSeconds * 1000));
}

export function dateLong(ms: number): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (s < 60) return rtf.format(-s, "second");
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 48) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}
