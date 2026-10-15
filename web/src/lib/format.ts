import { EUR } from "../../../shared/offering.js";

const eur2 = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 0 });

export function euro(micro: number | bigint, { whole = false } = {}): string {
  const value = Number(micro) / EUR;
  return whole ? eur0.format(value) : eur2.format(value);
}

/** Prijs per aandeel: toont zoveel decimalen als nodig (€ 0,005 of € 0,0125). */
export function price(micro: number): string {
  const value = micro / EUR;
  const decimals = Math.min(6, Math.max(2, (String(value).split(".")[1] ?? "").length));
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function count(n: number | bigint): string {
  return int.format(Number(n));
}

/** Percentage met genoeg cijfers om ook heel kleine delen te tonen: 0,0002% of 51%. */
export function percent(part: number, total: number): string {
  if (part <= 0) return "0%";
  const pct = (part / total) * 100;
  return `${pct.toLocaleString("nl-BE", { maximumSignificantDigits: pct >= 1 ? 4 : 3 })}%`;
}

export function shortAddress(address: string, chars = 4): string {
  return address.length <= chars * 2 + 1 ? address : `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function dateTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "-";
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(unixSeconds * 1000));
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "zonet";
  if (s < 60) return `${s} s geleden`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min geleden` : `${Math.round(m / 60)} u geleden`;
}
