#!/usr/bin/env node
// Maakt demo-aankopen op localnet of devnet, zodat de site levendige cijfers toont.
// Elke demo-koper krijgt testgeld en koopt via exact dezelfde code als de website; om de beurt
// in tEUR en in tUSD (de testversies van EURC en USDC).
//
// Gebruik: node scripts/solana/demo-aankopen.mjs --network devnet [--passen 6] [--agency 1] [--steun 1,5,12.5] [--namen "@an,Bakkerij Piet"]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { buildPassPurchase, buildSupport } from "../../server/genesis.js";
import { sendTestCoin } from "../../server/faucet.js";
import { eurUsd } from "../../server/koers.js";
import { EUR, formatEur } from "../../shared/genesis.js";
import { coinsOf, formatCoin } from "../../shared/munten.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const network = arg("network", "devnet");
if (network === "mainnet-beta") throw new Error("Geen demo-aankopen op mainnet.");
const deployment = JSON.parse(readFileSync(join(ROOT, "shared", "deployments", `${network}.json`), "utf8"));
const cfg = JSON.parse(readFileSync(join(ROOT, "shared", "genesis.json"), "utf8"));
const keysDir = arg("keys", join(ROOT, ".keys", network));
const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(keysDir, "authority.json"), "utf8"))));
const connection = new Connection(arg("rpc", deployment.rpc), "confirmed");
const names = arg("namen", "@lotte_bouwt,Bakkerij Verhoeven,,@solmarketeer,Studio Noord,,@jens.dev").split(",");
let nameIndex = 0;
const nextName = () => names[nameIndex++ % names.length];
const coins = coinsOf(deployment, cfg);
let coinIndex = 0;
const rate = coins.some((c) => c.valuta === "USD") ? (await eurUsd()).eurUsd : null;

async function run(buyer, prepared) {
  const tx = Transaction.from(Buffer.from(prepared.transaction, "base64"));
  tx.partialSign(buyer);
  const signature = await connection.sendRawTransaction(tx.serialize());
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...bh }, "confirmed");
  return signature;
}

async function buyer() {
  const kp = Keypair.generate();
  const coin = coins[coinIndex++ % coins.length];
  await sendTestCoin({ connection, deployment, cfg, authority, recipient: kp.publicKey, munt: coin.id });
  return { kp, munt: coin.id, eurUsd: coin.valuta === "USD" ? rate : null, coin };
}

for (const [productId, count] of [["pass", arg("passen", "6")], ["agency", arg("agency", "1")]]) {
  for (let i = 0; i < Number(count); i++) {
    const { kp, munt, eurUsd: r, coin } = await buyer();
    const res = await buildPassPurchase({ connection, deployment, cfg, productId, buyer: kp.publicKey, authority, name: nextName(), munt, eurUsd: r });
    await run(kp, res);
    console.log(`${kp.publicKey.toBase58()}  ${productId === "pass" ? "Genesis Pass" : "Genesis Agency"} ${res.label} voor € ${formatEur(res.priceMicro)} (${formatCoin(res.amountMicro, coin)})`);
  }
}
for (const eur of arg("steun", "1,5,12.5").split(",").filter(Boolean).map(Number)) {
  const { kp, munt, eurUsd: r, coin } = await buyer();
  const res = await buildSupport({ connection, deployment, cfg, buyer: kp.publicKey, authority, eurMicro: Math.round(eur * 100) * (EUR / 100), name: nextName(), munt, eurUsd: r });
  await run(kp, res);
  console.log(`${kp.publicKey.toBase58()}  steun van € ${formatEur(res.eurMicro)} (${formatCoin(res.amountMicro, coin)})`);
}
