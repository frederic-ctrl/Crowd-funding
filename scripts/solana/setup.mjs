#!/usr/bin/env node
// Zet Marketing Scan Genesis op Solana op (localnet of devnet).
//
// Wat het doet:
// 1. Maakt (of leest) de serversleutel in .keys/<netwerk>/authority.json (nooit committen).
// 2. Maakt de test-euro (tEUR) aan, een Token-2022-munt zonder waarde, voor de demo.
//    Op mainnet geef je met --payment-mint de echte euro-stablecoin op (bv. EURC).
// 3. Maakt de supporter-badge aan: Token-2022, 0 decimalen, NonTransferable (niet door te sturen).
// 4. Maakt de kas aan (betalingen) en de rekening van de oprichter voor opnames.
// 5. Schrijft alle adressen naar shared/deployments/<netwerk>.json.
//
// De passen zelf bestaan nog niet: elke pass wordt pas aangemaakt bij de aankoop, met een eigen
// munt, een vast nummer en voorraad 1 (zie server/genesis.js).
//
// Gebruik: node scripts/solana/setup.mjs --network devnet [--founder <adres>] [--rpc <url>] [--payment-mint <adres>] [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  TYPE_SIZE,
  LENGTH_SIZE,
  getMintLen,
  getAssociatedTokenAddressSync,
  createInitializeMetadataPointerInstruction,
  createInitializeNonTransferableMintInstruction,
  createInitializeMintInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { createInitializeInstruction, createUpdateFieldInstruction, pack } from "@solana/spl-token-metadata";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_FOUNDER = "JPmYxhBGqt9GMe6kfozUce3EyQRAoQZD1hbLGWJR8T6";
const RPC = { localnet: "http://127.0.0.1:8899", devnet: "https://api.devnet.solana.com", "mainnet-beta": "https://api.mainnet-beta.solana.com" };
const MIN_SOL = 0.3;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function loadOrCreateKey(path) {
  if (existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  const kp = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

function explorer(network, rpc, value) {
  const cluster = network === "localnet" ? `cluster=custom&customUrl=${encodeURIComponent(rpc)}` : `cluster=${network}`;
  return `https://explorer.solana.com/address/${value}?${cluster}`;
}

async function send(connection, tx, signers, label) {
  const sig = await sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed" });
  console.log(`  ok  ${label}`);
  return sig;
}

async function createMintWithMetadata(connection, { payer, decimals, nonTransferable, name, symbol, uri, extra }) {
  const mint = Keypair.generate();
  const extensions = [ExtensionType.MetadataPointer];
  if (nonTransferable) extensions.push(ExtensionType.NonTransferable);
  const mintLen = getMintLen(extensions);
  const metadata = { mint: mint.publicKey, name, symbol, uri, additionalMetadata: extra, updateAuthority: payer.publicKey };
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + TYPE_SIZE + LENGTH_SIZE + pack(metadata).length);

  const create = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeMetadataPointerInstruction(mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
  );
  if (nonTransferable) create.add(createInitializeNonTransferableMintInstruction(mint.publicKey, TOKEN_2022_PROGRAM_ID));
  create.add(
    createInitializeMintInstruction(mint.publicKey, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      name,
      symbol,
      uri,
      mintAuthority: payer.publicKey,
      updateAuthority: payer.publicKey,
    }),
  );
  const signature = await send(connection, create, [payer, mint], `${symbol} aangemaakt (${mint.publicKey.toBase58()})`);

  if (extra.length > 0) {
    const fields = new Transaction().add(
      ...extra.map(([field, value]) => createUpdateFieldInstruction({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint.publicKey, updateAuthority: payer.publicKey, field, value })),
    );
    await send(connection, fields, [payer], `${symbol} extra gegevens`);
  }
  return { mint: mint.publicKey, signature };
}

async function main() {
  const network = arg("network", "devnet");
  if (network === "mainnet-beta" && !process.argv.includes("--ik-weet-wat-ik-doe")) {
    throw new Error("Mainnet pas na het advies van de boekhouder en de juridische check. Gebruik localnet of devnet.");
  }
  const rpc = arg("rpc", RPC[network]);
  if (!rpc) throw new Error(`Onbekend netwerk "${network}".`);
  const founder = new PublicKey(arg("founder", DEFAULT_FOUNDER));
  const keysDir = arg("keys", join(ROOT, ".keys", network));
  const out = arg("out", join(ROOT, "shared", "deployments", `${network}.json`));
  const cfg = JSON.parse(readFileSync(join(ROOT, "shared", "genesis.json"), "utf8"));

  if (existsSync(out) && !process.argv.includes("--force")) {
    throw new Error(`${out} bestaat al. Gebruik --force om alles opnieuw aan te maken.`);
  }

  const connection = new Connection(rpc, "confirmed");
  const authority = loadOrCreateKey(join(keysDir, "authority.json"));
  console.log(`Netwerk: ${network} (${rpc})`);
  console.log(`Serversleutel: ${authority.publicKey.toBase58()}`);
  console.log(`Oprichterswallet: ${founder.toBase58()}`);

  let balance = (await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL;
  if (balance < MIN_SOL && network !== "mainnet-beta") {
    try {
      const sig = await connection.requestAirdrop(authority.publicKey, 2 * LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      balance = (await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL;
    } catch (err) {
      console.log(`Airdrop lukte niet: ${err.message.split("\n")[0]}`);
    }
  }
  if (balance < MIN_SOL) {
    console.log(`\nDe serversleutel heeft ${balance} SOL en heeft er minstens ${MIN_SOL} nodig.`);
    console.log(`Stuur ${network}-SOL naar ${authority.publicKey.toBase58()} (bv. via https://faucet.solana.com) en start opnieuw.`);
    process.exit(2);
  }
  console.log(`Saldo serversleutel: ${balance} SOL\n`);

  const base = arg("uri", cfg.metadataBasis);
  const site = base.replace(/\/(genesis|token)$/, "");

  let paymentMint;
  let paymentProgram;
  const signatures = {};
  const given = arg("payment-mint");
  if (given) {
    paymentMint = new PublicKey(given);
    const info = await connection.getAccountInfo(paymentMint);
    if (!info) throw new Error(`Betaalmunt ${given} niet gevonden op ${network}.`);
    paymentProgram = info.owner;
    console.log(`  ok  Bestaande betaalmunt ${given}`);
  } else {
    if (network === "mainnet-beta") throw new Error("Geef op mainnet de echte betaalmunt op met --payment-mint.");
    const payment = await createMintWithMetadata(connection, {
      payer: authority,
      decimals: cfg.betaalmunt.decimalen,
      nonTransferable: false,
      name: `${cfg.betaalmunt.naam} (testnet)`,
      symbol: cfg.betaalmunt.symbool,
      uri: `${site}/token/teur.json`,
      extra: [["gebruik", "enkel voor de demo, geen waarde"]],
    });
    paymentMint = payment.mint;
    paymentProgram = TOKEN_2022_PROGRAM_ID;
    signatures.betaalmunt = payment.signature;
  }

  const supporter = await createMintWithMetadata(connection, {
    payer: authority,
    decimals: 0,
    nonTransferable: true,
    name: network === "mainnet-beta" ? cfg.steun.tokenNaam : `${cfg.steun.tokenNaam} (testnet)`,
    symbol: cfg.steun.symbool,
    uri: `${base}/steun.json`,
    extra: [["website", site]],
  });
  signatures.supporterBadge = supporter.signature;

  const kas = getAssociatedTokenAddressSync(paymentMint, authority.publicKey, false, paymentProgram);
  const founderPayment = getAssociatedTokenAddressSync(paymentMint, founder, false, paymentProgram);
  signatures.kas = await send(
    connection,
    new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, kas, authority.publicKey, paymentMint, paymentProgram),
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, founderPayment, founder, paymentMint, paymentProgram),
    ),
    [authority],
    "Kas en rekening van de oprichter",
  );

  const deployment = {
    network,
    rpc,
    createdAt: new Date().toISOString(),
    authority: authority.publicKey.toBase58(),
    founderWallet: founder.toBase58(),
    paymentMint: paymentMint.toBase58(),
    paymentProgram: paymentProgram.toBase58(),
    kas: kas.toBase58(),
    founderPaymentAccount: founderPayment.toBase58(),
    supporterMint: supporter.mint.toBase58(),
    passProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    signatures,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`\nKlaar. Adressen bewaard in ${out}`);
  console.log(`Kas:              ${explorer(network, rpc, deployment.kas)}`);
  console.log(`Supporter-badge:  ${explorer(network, rpc, deployment.supporterMint)}`);
  console.log(`\nZet de serversleutel als omgevingsvariabele SALE_AUTHORITY_SECRET (inhoud van ${join(keysDir, "authority.json")}).`);
  console.log("Die sleutel maakt de passen aan en beheert de kas: bewaar hem enkel in Vercel en in je wachtwoordbeheerder.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
