// Directe steun: een gift in crypto rechtstreeks naar de wallet van de oprichter, los van de
// Genesis-verkoop. Geen pass, geen abonnement, geen terugbetaling. Gedeeld door de site en de
// controle voor elke build (scripts/site-check.mjs), zodat een tikfout in een adres de build laat
// falen in plaats van dat iemand geld naar een verkeerd adres stuurt.
import { PublicKey } from "@solana/web3.js";

const BTC = /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/;

/** Is dit een geldig adres voor dit netwerk? Solana: een wallet (geen programma-adres). Bitcoin: bc1, 1 of 3. */
export function validAddress(schema, address) {
  const a = String(address ?? "").trim();
  if (!a) return false;
  if (schema === "solana") {
    try {
      const key = new PublicKey(a);
      return key.toBase58() === a && PublicKey.isOnCurve(key.toBytes());
    } catch {
      return false;
    }
  }
  if (schema === "bitcoin") return BTC.test(a);
  return false;
}

/** De link in de QR-code: wallets openen die meteen met het juiste adres. */
export function paymentUri(schema, address) {
  return `${schema}:${address}`;
}

/** Fouten in de configuratie (leeg = in orde, of niet actief). */
export function checkDirectSupport(cfg) {
  if (!cfg?.actief) return [];
  const problems = [];
  if (!String(cfg.ontvanger ?? "").trim()) problems.push("ontvanger ontbreekt (wie het geld krijgt)");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cfg.email ?? ""))) problems.push("email ontbreekt of is ongeldig");
  const filled = (cfg.adressen ?? []).filter((a) => a.adres);
  if (filled.length === 0) problems.push("geen enkel adres ingevuld");
  for (const a of filled) {
    if (!validAddress(a.schema, a.adres)) problems.push(`${a.netwerk}: "${a.adres}" is geen geldig adres`);
  }
  return problems;
}

/** De adressen die op de site komen: enkel ingevulde, geldige adressen, en enkel als directe steun actief is. */
export function shownAddresses(cfg) {
  if (!cfg?.actief || checkDirectSupport(cfg).length > 0) return [];
  return (cfg.adressen ?? []).filter((a) => a.adres && validAddress(a.schema, a.adres));
}
