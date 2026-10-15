#!/usr/bin/env node
// Betaalt iedereen terug als een ronde haar minimumdoel niet haalt.
// Per koper, in één transactie: de volledige inleg gaat van de escrow terug naar de koper,
// en de aandelen gaan terug naar de verkoopkluis (met de offline herstelsleutel).
// Zonder --uitvoeren toont het script enkel het overzicht. Elke terugbetaling is publiek zichtbaar.
//
// Gebruik: node scripts/solana/terugbetalen.mjs --network devnet [--ronde ronde-1] [--uitvoeren]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  createThawAccountInstruction,
  createFreezeAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { allPurchases, totalsPerBuyer } from "../../server/history.js";
import { MEMO_PROGRAM_ID } from "../../server/purchase.js";
import { EUR } from "../../shared/offering.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const readKey = (path) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));

const network = arg("network", "devnet");
const roundId = arg("ronde", "ronde-1");
const execute = process.argv.includes("--uitvoeren");
const deployment = JSON.parse(readFileSync(join(ROOT, "shared", "deployments", `${network}.json`), "utf8"));
const offering = JSON.parse(readFileSync(join(ROOT, "shared", "aanbod.json"), "utf8"));
const keysDir = arg("keys", join(ROOT, ".keys", network));
const connection = new Connection(arg("rpc", deployment.rpc), "confirmed");

const tokenMint = new PublicKey(deployment.tokenMint);
const paymentMint = new PublicKey(deployment.paymentMint);
const paymentProgram = new PublicKey(deployment.paymentProgram);
const escrow = new PublicKey(deployment.escrow);
const vault = new PublicKey(deployment.vaults[roundId]);

const buyers = totalsPerBuyer(await allPurchases(connection, deployment));
const total = buyers.reduce((s, b) => s + b.paidMicro, 0);
console.log(`${buyers.length} kopers, samen €${(total / EUR).toFixed(2)} terug te betalen.\n`);

if (!execute) {
  for (const b of buyers) console.log(`  ${b.buyer}  €${(b.paidMicro / EUR).toFixed(2)}  ${b.tokens} aandelen`);
  console.log("\nDroogtest. Voeg --uitvoeren toe om echt terug te betalen.");
  process.exit(0);
}

const authority = readKey(join(keysDir, "authority.json"));
const recovery = readKey(join(keysDir, "herstel.json"));

for (const b of buyers) {
  const buyer = new PublicKey(b.buyer);
  const buyerShares = getAssociatedTokenAddressSync(tokenMint, buyer, false, TOKEN_2022_PROGRAM_ID);
  const buyerPayment = getAssociatedTokenAddressSync(paymentMint, buyer, false, paymentProgram);
  const shares = await getAccount(connection, buyerShares, "confirmed", TOKEN_2022_PROGRAM_ID);
  const toReturn = shares.amount < BigInt(b.tokens) ? shares.amount : BigInt(b.tokens);

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, buyerPayment, buyer, paymentMint, paymentProgram),
    createTransferCheckedInstruction(escrow, paymentMint, buyerPayment, authority.publicKey, BigInt(b.paidMicro), offering.betaalmunt.decimalen, [], paymentProgram),
  );
  if (shares.isFrozen) tx.add(createThawAccountInstruction(buyerShares, tokenMint, authority.publicKey, [], TOKEN_2022_PROGRAM_ID));
  tx.add(
    createTransferCheckedInstruction(buyerShares, tokenMint, vault, recovery.publicKey, toReturn, offering.token.decimalen, [], TOKEN_2022_PROGRAM_ID),
    createFreezeAccountInstruction(buyerShares, tokenMint, authority.publicKey, [], TOKEN_2022_PROGRAM_ID),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`${offering.project}: terugbetaling ${roundId}, minimumdoel niet gehaald`, "utf8"),
    }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [authority, recovery], { commitment: "confirmed" });
  console.log(`  terugbetaald: ${b.buyer}  €${(b.paidMicro / EUR).toFixed(2)}  (${sig})`);
}
console.log("\nKlaar. Alle terugbetalingen staan publiek op de blockchain.");
