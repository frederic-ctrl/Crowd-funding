#!/usr/bin/env node
// Neemt geld op uit de kassen (EURC en USDC) naar de wallet van de oprichter. Enkel wat buiten de
// bedenktijd valt: aankopen van de laatste 14 dagen blijven in hun kas, zodat elke terugbetaling
// meteen kan. Zonder --uitvoeren toont het script enkel het overzicht. Elke opname staat publiek
// op de blockchain, met de waarde in euro in de memo (USDC aan de ECB-koers van de dag).
//
// Gebruik: node scripts/solana/opnemen.mjs --network devnet [--munt eurc|usdc] [--uitvoeren]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { unpackAccount } from "@solana/spl-token";
import { buildWithdrawal, withdrawable } from "../../server/genesis.js";
import { eurUsd } from "../../server/koers.js";
import { fetchEvents } from "../../shared/history.js";
import { coinsOf, formatCoin } from "../../shared/munten.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const network = arg("network", "devnet");
const deployment = JSON.parse(readFileSync(join(ROOT, "shared", "deployments", `${network}.json`), "utf8"));
const cfg = JSON.parse(readFileSync(join(ROOT, "shared", "genesis.json"), "utf8"));
const connection = new Connection(arg("rpc", deployment.rpc), "confirmed");
const only = arg("munt");
const execute = process.argv.includes("--uitvoeren");

const events = await fetchEvents(connection, deployment, cfg);
let authority = null;
if (execute) {
  const keysDir = arg("keys", join(ROOT, ".keys", network));
  authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(keysDir, "authority.json"), "utf8"))));
}

for (const coin of coinsOf(deployment, cfg).filter((c) => !only || c.id === only)) {
  const kas = new PublicKey(coin.kas);
  const info = await connection.getAccountInfo(kas, "confirmed");
  const kasMicro = info ? Number(unpackAccount(kas, info, new PublicKey(coin.program)).amount) : 0;
  const { bufferMicro, opneembaarMicro } = withdrawable(cfg, events, coin.id, kasMicro);
  console.log(`\n${coin.symbool}`);
  console.log(`  Kas:                         ${formatCoin(kasMicro, coin)}`);
  console.log(`  Buffer voor terugbetalingen: ${formatCoin(bufferMicro, coin)}`);
  console.log(`  Op te nemen:                 ${formatCoin(opneembaarMicro, coin)} naar ${deployment.founderWallet}`);
  if (!execute || opneembaarMicro === 0) continue;
  const rate = coin.valuta === "USD" ? (await eurUsd()).eurUsd : null;
  const { transaction } = await buildWithdrawal({ connection, deployment, cfg, authority, munt: coin.id, amountMicro: opneembaarMicro, eurUsd: rate });
  const signature = await connection.sendRawTransaction(transaction.serialize());
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...bh }, "confirmed");
  console.log(`  Opgenomen. Publiek na te kijken: ${signature}`);
}
if (!execute) console.log("\nDroogtest. Voeg --uitvoeren toe om echt op te nemen.");
