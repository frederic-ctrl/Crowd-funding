#!/usr/bin/env node
// Maakt demo-aankopen op localnet of devnet, zodat de site levendige cijfers toont.
// Elke demo-investeerder krijgt test-euro en koopt via exact dezelfde code als de website.
//
// Gebruik: node scripts/solana/demo-aankopen.mjs --network devnet [--bedragen 1,25,5,12.5,50]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { buildPurchase } from "../../server/purchase.js";
import { sendTestEuro } from "../../server/faucet.js";
import { EUR } from "../../shared/offering.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const network = arg("network", "devnet");
if (network === "mainnet-beta") throw new Error("Geen demo-aankopen op mainnet.");
const deployment = JSON.parse(readFileSync(join(ROOT, "shared", "deployments", `${network}.json`), "utf8"));
const offering = JSON.parse(readFileSync(join(ROOT, "shared", "aanbod.json"), "utf8"));
const keysDir = arg("keys", join(ROOT, ".keys", network));
const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(keysDir, "authority.json"), "utf8"))));
const connection = new Connection(arg("rpc", deployment.rpc), "confirmed");
const amounts = arg("bedragen", "1,25,5,12.5,50").split(",").map(Number);

for (const eur of amounts) {
  const investor = Keypair.generate();
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey, amountMicro: Math.max(50, Math.ceil(eur)) * EUR });
  const res = await buildPurchase({
    connection,
    deployment,
    offering,
    roundId: "ronde-1",
    buyer: investor.publicKey,
    eurMicro: Math.round(eur * 100) * 10_000,
    authority,
  });
  const tx = Transaction.from(Buffer.from(res.transaction, "base64"));
  tx.partialSign(investor);
  const signature = await connection.sendRawTransaction(tx.serialize());
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...bh }, "confirmed");
  console.log(`${investor.publicKey.toBase58()}  ${String(res.tokens).padStart(6)} aandelen voor €${(res.cost / EUR).toFixed(2)}`);
}
