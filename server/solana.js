// Gedeelde serverhulpen: verbinding, deployment-adressen en de serversleutel.
import { readFileSync, existsSync } from "node:fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const DEPLOYMENTS = new URL("../shared/deployments/", import.meta.url);

export function deploymentPath(network) {
  return new URL(`${network}.json`, DEPLOYMENTS);
}

/** Adressen van de kas, de betaalmunt en de supporter-badge voor een netwerk (aangemaakt door scripts/solana/setup.mjs). */
export function loadDeployment(network = process.env.SOLANA_NETWORK || "devnet") {
  const path = deploymentPath(network);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadGenesis() {
  return JSON.parse(readFileSync(new URL("../shared/genesis.json", import.meta.url), "utf8"));
}

export function connectionFor(deployment, rpcOverride = process.env.SOLANA_RPC_URL) {
  return new Connection(rpcOverride || deployment.rpc, "confirmed");
}

/** Leest een geheime sleutel: base58 (zoals Phantom exporteert) of een JSON-array (solana-keygen). */
export function parseSecretKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Geen geheime sleutel opgegeven.");
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  if (bytes.length !== 64) throw new Error("Een geheime sleutel moet 64 bytes zijn.");
  return Keypair.fromSecretKey(bytes);
}

/** De serversleutel: betaalt transactiekosten, maakt passen aan en beheert de kas. */
export function loadAuthority(env = process.env) {
  if (!env.SALE_AUTHORITY_SECRET) throw new Error("SALE_AUTHORITY_SECRET ontbreekt.");
  return parseSecretKey(env.SALE_AUTHORITY_SECRET);
}

export function json(status, body, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });
}

/** Leest een walletadres uit een aanvraag. Enkel adressen met een sleutel (geen programma-adressen). */
export function walletFrom(value) {
  try {
    const key = new PublicKey(String(value ?? ""));
    return PublicKey.isOnCurve(key.toBytes()) ? key : null;
  } catch {
    return null;
  }
}
