// Directe steun: een gift in crypto rechtstreeks naar de wallet van de oprichter, los van de
// Genesis-verkoop. Geen pass, geen abonnement, geen terugbetaling. Gedeeld door de site en de
// controle voor elke build (scripts/site-check.mjs), zodat een tikfout in een adres de build laat
// falen in plaats van dat iemand geld naar een verkeerd adres stuurt.
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";

// --- Bitcoin -------------------------------------------------------------------------------
// bc1 (bech32 en bech32m, BIP-173/350) en de oude adressen 1... en 3... (base58check).

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function validBech32Btc(address) {
  const a = address.toLowerCase();
  if (a !== address && address.toUpperCase() !== address) return false;
  const pos = a.lastIndexOf("1");
  if (a.slice(0, pos) !== "bc" || a.length > 90) return false;
  const data = [...a.slice(pos + 1)].map((c) => BECH32.indexOf(c));
  if (data.length < 7 || data.some((d) => d < 0)) return false;
  const hrp = [..."bc"].map((c) => c.charCodeAt(0));
  const check = polymod([...hrp.map((c) => c >> 5), 0, ...hrp.map((c) => c & 31), ...data]);
  const version = data[0];
  // Versie 0 (bc1q) gebruikt bech32, versie 1 en hoger (bc1p, taproot) bech32m.
  if (check !== (version === 0 ? 1 : 0x2bc830a3)) return false;
  // Lengte van het programma: 20 of 32 bytes bij versie 0, 2 tot 40 bytes bij hogere versies.
  const bits = (data.length - 7) * 5;
  const bytes = Math.floor(bits / 8);
  if (version > 16) return false;
  if (version === 0) return bytes === 20 || bytes === 32;
  return bytes >= 2 && bytes <= 40;
}

function validBase58Btc(address) {
  try {
    const raw = bs58.decode(address);
    if (raw.length !== 25 || (raw[0] !== 0x00 && raw[0] !== 0x05)) return false;
    const sum = sha256(sha256(raw.subarray(0, 21)));
    return sum.subarray(0, 4).every((b, i) => b === raw[21 + i]);
  } catch {
    return false;
  }
}

// --- Ethereum en Polygon (EVM) -------------------------------------------------------------
// 0x + 40 hexadecimale tekens. Met hoofdletters moet de EIP-55-controlesom kloppen.

function validEvm(address) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  const hex = address.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
  const hash = keccak_256(new TextEncoder().encode(hex.toLowerCase()));
  for (let i = 0; i < 40; i++) {
    const nibble = (hash[i >> 1] >> (i % 2 === 0 ? 4 : 0)) & 0xf;
    const c = hex[i];
    if (/[a-f]/.test(c) && nibble >= 8) return false;
    if (/[A-F]/.test(c) && nibble < 8) return false;
  }
  return true;
}

/**
 * Is dit een geldig adres voor dit netwerk? Solana: een wallet (geen programma-adres). Bitcoin:
 * bc1, 1 of 3 met een kloppende controlesom. Ethereum en Polygon: 0x-adres met EIP-55-controlesom.
 */
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
  if (schema === "bitcoin") return /^bc1/i.test(a) ? validBech32Btc(a) : validBase58Btc(a);
  if (schema === "ethereum" || schema === "polygon") return validEvm(a);
  return false;
}

/**
 * De link in de QR-code: wallets openen die meteen met het juiste adres en netwerk.
 * Polygon gebruikt het Ethereum-schema met keten 137 (EIP-681).
 */
export function paymentUri(schema, address) {
  if (schema === "polygon") return `ethereum:${address}@137`;
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
