#!/usr/bin/env node
// Zet Marketing Scan Genesis op Solana op (localnet, devnet of mainnet).
//
// Wat het doet:
// 1. Maakt (of leest) de serversleutel in .keys/<netwerk>/authority.json (nooit committen).
// 2. Betaalmunten (zie betaalmunten in shared/genesis.json): op het testnet maakt het tEUR en tUSD
//    aan, Token-2022-munten zonder waarde, voor de demo. Op mainnet gebruikt het de echte EURC en
//    USDC van Circle (of de munten die je opgeeft met --eurc-mint en --usdc-mint).
// 3. Maakt de supporter-badge aan: Token-2022, 0 decimalen, NonTransferable (niet door te sturen).
// 4. Maakt per munt een kas aan (betalingen) en een rekening van de oprichter voor opnames.
// 5. Schrijft alle adressen naar shared/deployments/<netwerk>.json.
//
// Bestaat de deployment al, dan vult het script enkel aan wat ontbreekt (bv. een nieuwe munt) en
// blijft al de rest, ook de passen, ongemoeid. Met --force begint het helemaal opnieuw.
//
// De passen zelf bestaan nog niet: elke pass wordt pas aangemaakt bij de aankoop, met een eigen
// munt, een vast nummer en voorraad 1 (zie server/genesis.js).
//
// Gebruik: node scripts/solana/setup.mjs --network devnet [--founder <adres>] [--rpc <url>] [--eurc-mint <adres>] [--usdc-mint <adres>] [--force]
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
  unpackMint,
} from "@solana/spl-token";
import { createInitializeInstruction, createUpdateFieldInstruction, pack } from "@solana/spl-token-metadata";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_FOUNDER = "JPmYxhBGqt9GMe6kfozUce3EyQRAoQZD1hbLGWJR8T6";
const RPC = { localnet: "http://127.0.0.1:8899", devnet: "https://api.devnet.solana.com", "mainnet-beta": "https://api.mainnet-beta.solana.com" };
const MIN_SOL = 0.3;
// De echte stablecoins van Circle op Solana mainnet (SPL Token, 6 decimalen).
const MAINNET_MINTS = { eurc: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" };

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

/** Oude deployments hadden één betaalmunt (paymentMint, kas, ...): die wordt munten.eurc. */
function upgrade(dep) {
  if (dep.munten || !dep.paymentMint) return dep;
  const { paymentMint, paymentProgram, kas, founderPaymentAccount, ...rest } = dep;
  const signatures = { ...rest.signatures };
  if (signatures.betaalmunt) signatures.munt_eurc = signatures.betaalmunt;
  if (signatures.kas) signatures.kas_eurc = signatures.kas;
  delete signatures.betaalmunt;
  delete signatures.kas;
  return { ...rest, munten: { eurc: { mint: paymentMint, program: paymentProgram, kas, founderAccount: founderPaymentAccount } }, signatures };
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

  const existing = existsSync(out) && !process.argv.includes("--force") ? upgrade(JSON.parse(readFileSync(out, "utf8"))) : null;
  if (existing && existing.network !== network) throw new Error(`${out} hoort bij ${existing.network}, niet bij ${network}.`);

  const connection = new Connection(rpc, "confirmed");
  const authority = loadOrCreateKey(join(keysDir, "authority.json"));
  if (existing && existing.authority !== authority.publicKey.toBase58()) {
    throw new Error(`De serversleutel in ${keysDir} hoort niet bij ${out}. Gebruik de juiste --keys, of --force om opnieuw te beginnen.`);
  }
  if (existing && existing.founderWallet !== founder.toBase58() && process.argv.includes("--founder")) {
    throw new Error(`De oprichterswallet van ${out} is ${existing.founderWallet}. Die verander je enkel met --force.`);
  }
  console.log(existing ? `Bestaande deployment aanvullen: ${out}` : "Nieuwe deployment");
  console.log(`Netwerk: ${network} (${rpc})`);
  console.log(`Serversleutel: ${authority.publicKey.toBase58()}`);
  const founderWallet = existing ? new PublicKey(existing.founderWallet) : founder;
  console.log(`Oprichterswallet: ${founderWallet.toBase58()}`);

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

  const signatures = { ...(existing?.signatures ?? {}) };
  const munten = { ...(existing?.munten ?? {}) };
  for (const c of cfg.betaalmunten) {
    const symbol = network === "mainnet-beta" ? c.symbool : c.testSymbool;
    if (munten[c.id]) {
      console.log(`  ok  ${symbol} bestaat al (${munten[c.id].mint})`);
      continue;
    }
    let mint;
    let program;
    const given = arg(`${c.id}-mint`, network === "mainnet-beta" ? MAINNET_MINTS[c.id] : undefined);
    if (given) {
      mint = new PublicKey(given);
      const info = await connection.getAccountInfo(mint);
      if (!info) throw new Error(`${symbol} (${given}) niet gevonden op ${network}.`);
      program = info.owner;
      const decimals = unpackMint(mint, info, program).decimals;
      if (decimals !== c.decimalen) throw new Error(`${symbol} heeft ${decimals} decimalen, verwacht ${c.decimalen}.`);
      console.log(`  ok  Bestaande munt ${symbol} (${given})`);
    } else {
      const created = await createMintWithMetadata(connection, {
        payer: authority,
        decimals: c.decimalen,
        nonTransferable: false,
        name: `${c.testNaam} (testnet)`,
        symbol,
        uri: `${site}/token/${symbol.toLowerCase()}.json`,
        extra: [["gebruik", "enkel voor de demo, geen waarde"]],
      });
      mint = created.mint;
      program = TOKEN_2022_PROGRAM_ID;
      signatures[`munt_${c.id}`] = created.signature;
    }
    const kas = getAssociatedTokenAddressSync(mint, authority.publicKey, false, program);
    const founderAccount = getAssociatedTokenAddressSync(mint, founderWallet, false, program);
    signatures[`kas_${c.id}`] = await send(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, kas, authority.publicKey, mint, program),
        createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, founderAccount, founderWallet, mint, program),
      ),
      [authority],
      `Kas ${symbol} en rekening van de oprichter`,
    );
    munten[c.id] = { mint: mint.toBase58(), program: program.toBase58(), kas: kas.toBase58(), founderAccount: founderAccount.toBase58() };
  }

  let supporterMint = existing?.supporterMint;
  if (supporterMint) {
    console.log(`  ok  Supporter-badge bestaat al (${supporterMint})`);
  } else {
    const supporter = await createMintWithMetadata(connection, {
      payer: authority,
      decimals: 0,
      nonTransferable: true,
      name: network === "mainnet-beta" ? cfg.steun.tokenNaam : `${cfg.steun.tokenNaam} (testnet)`,
      symbol: cfg.steun.symbool,
      uri: `${base}/steun.json`,
      extra: [["website", site]],
    });
    supporterMint = supporter.mint.toBase58();
    signatures.supporterBadge = supporter.signature;
  }

  const deployment = {
    network,
    rpc,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    authority: authority.publicKey.toBase58(),
    founderWallet: founderWallet.toBase58(),
    supporterMint,
    passProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    munten,
    signatures,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`\nKlaar. Adressen bewaard in ${out}`);
  for (const [id, m] of Object.entries(deployment.munten)) console.log(`Kas ${id.toUpperCase()}:         ${explorer(network, rpc, m.kas)}`);
  console.log(`Supporter-badge:  ${explorer(network, rpc, deployment.supporterMint)}`);
  console.log(`\nZet de serversleutel als omgevingsvariabele SALE_AUTHORITY_SECRET (inhoud van ${join(keysDir, "authority.json")}).`);
  console.log("Die sleutel maakt de passen aan en beheert de kas: bewaar hem enkel in Vercel en in je wachtwoordbeheerder.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
