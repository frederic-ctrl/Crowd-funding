#!/usr/bin/env node
// Neemt geld op uit de kas naar de wallet van de oprichter. Enkel wat buiten de bedenktijd valt:
// aankopen van de laatste 14 dagen blijven in de kas, zodat elke terugbetaling meteen kan.
// Zonder --uitvoeren toont het script enkel het overzicht. Elke opname staat publiek op de blockchain.
//
// Gebruik: node scripts/solana/opnemen.mjs --network devnet [--uitvoeren]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { unpackAccount } from "@solana/spl-token";
import { buildWithdrawal, withdrawable } from "../../server/genesis.js";
import { fetchEvents } from "../../shared/history.js";
import { formatEur } from "../../shared/genesis.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const network = arg("network", "devnet");
const deployment = JSON.parse(readFileSync(join(ROOT, "shared", "deployments", `${network}.json`), "utf8"));
const cfg = JSON.parse(readFileSync(join(ROOT, "shared", "genesis.json"), "utf8"));
const connection = new Connection(arg("rpc", deployment.rpc), "confirmed");

const events = await fetchEvents(connection, deployment, cfg);
const kas = new PublicKey(deployment.kas);
const info = await connection.getAccountInfo(kas, "confirmed");
const kasMicro = info ? Number(unpackAccount(kas, info, new PublicKey(deployment.paymentProgram)).amount) : 0;
const { bufferMicro, opneembaarMicro } = withdrawable(cfg, events, kasMicro);

console.log(`Kas:                         € ${formatEur(kasMicro)}`);
console.log(`Buffer voor terugbetalingen: € ${formatEur(bufferMicro)}`);
console.log(`Op te nemen:                 € ${formatEur(opneembaarMicro)} naar ${deployment.founderWallet}`);

if (!process.argv.includes("--uitvoeren")) {
  console.log("\nDroogtest. Voeg --uitvoeren toe om echt op te nemen.");
  process.exit(0);
}
if (opneembaarMicro === 0) {
  console.log("\nEr valt nu niets op te nemen.");
  process.exit(0);
}
const keysDir = arg("keys", join(ROOT, ".keys", network));
const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(keysDir, "authority.json"), "utf8"))));
const { transaction } = await buildWithdrawal({ connection, deployment, cfg, authority, amountMicro: opneembaarMicro });
const signature = await connection.sendRawTransaction(transaction.serialize());
const bh = await connection.getLatestBlockhash();
await connection.confirmTransaction({ signature, ...bh }, "confirmed");
console.log(`\nOpgenomen. Publiek na te kijken: ${signature}`);
