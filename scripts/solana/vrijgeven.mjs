#!/usr/bin/env node
// Geeft het geld in de escrow vrij aan de treasury, enkel als het minimumdoel van de ronde gehaald is.
// Gebruik: node scripts/solana/vrijgeven.mjs --network devnet --naar <treasury-adres> [--ronde ronde-1] [--uitvoeren]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "../../server/purchase.js";
import { EUR, findRound } from "../../shared/offering.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const network = arg("network", "devnet");
const roundId = arg("ronde", "ronde-1");
const to = arg("naar");
if (!to) throw new Error("Geef de treasury op met --naar <adres> (bij voorkeur een multisig).");
const deployment = JSON.parse(readFileSync(join(ROOT, "shared", "deployments", `${network}.json`), "utf8"));
const offering = JSON.parse(readFileSync(join(ROOT, "shared", "aanbod.json"), "utf8"));
const round = findRound(offering, roundId);
const connection = new Connection(arg("rpc", deployment.rpc), "confirmed");
const paymentMint = new PublicKey(deployment.paymentMint);
const paymentProgram = new PublicKey(deployment.paymentProgram);
const escrow = new PublicKey(deployment.escrow);

const balance = Number((await getAccount(connection, escrow, "confirmed", paymentProgram)).amount);
const goal = (round.minimumdoelEur ?? 0) * EUR;
console.log(`Escrow: €${(balance / EUR).toFixed(2)}. Minimumdoel ${round.naam}: €${(goal / EUR).toFixed(2)}.`);
if (balance < goal) {
  console.log("Het minimumdoel is niet gehaald. Vrijgeven kan niet: betaal terug met scripts/solana/terugbetalen.mjs.");
  process.exit(1);
}
if (!process.argv.includes("--uitvoeren")) {
  console.log(`Droogtest. Met --uitvoeren gaat €${(balance / EUR).toFixed(2)} naar ${to}.`);
  process.exit(0);
}

const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(arg("keys", join(ROOT, ".keys", network)), "authority.json"), "utf8"))));
const treasury = new PublicKey(to);
const target = getAssociatedTokenAddressSync(paymentMint, treasury, true, paymentProgram);
const tx = new Transaction().add(
  createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, target, treasury, paymentMint, paymentProgram),
  createTransferCheckedInstruction(escrow, paymentMint, target, authority.publicKey, BigInt(balance), offering.betaalmunt.decimalen, [], paymentProgram),
  new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(`${offering.project}: ${round.naam} minimumdoel gehaald, escrow vrijgegeven`, "utf8") }),
);
const sig = await sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });
console.log(`Vrijgegeven: €${(balance / EUR).toFixed(2)} naar ${to} (${sig}).`);
