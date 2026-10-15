#!/usr/bin/env node
// Zet de aandelentoken en de verkoop op Solana op (localnet of devnet).
//
// Wat het doet:
// 1. Maakt (of leest) de serversleutel en de reservesleutel in .keys/<netwerk>/ (nooit committen).
// 2. Maakt de test-euro (tEUR) aan, een Token-2022-munt met naam en symbool, voor de demo.
// 3. Maakt de aandelentoken MSCAN aan: Token-2022, 0 decimalen, met naam/symbool/link,
//    "standaard bevroren" (aandelen zijn niet vrij overdraagbaar) en een aparte herstelsleutel
//    (permanent delegate) om aandelen van een verloren wallet over te zetten. Die sleutel blijft offline.
// 4. Munt exact 100.000.000 aandelen: 51.000.000 naar de oprichterswallet (bevroren = lock-up),
//    9.000.000 naar de verkoopkluis van ronde 1, 40.000.000 naar de reserve van ronde 2 (bevroren).
// 5. Trekt het muntrecht definitief in: niemand kan er ooit nog aandelen bij maken.
// 6. Maakt de escrow-rekening voor betalingen en schrijft alle adressen naar shared/deployments/<netwerk>.json.
//
// Gebruik: node scripts/solana/setup.mjs --network devnet [--founder <adres>] [--rpc <url>] [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  AccountState,
  AuthorityType,
  TYPE_SIZE,
  LENGTH_SIZE,
  getMintLen,
  getAssociatedTokenAddressSync,
  createInitializeMetadataPointerInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeMintInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createThawAccountInstruction,
  createFreezeAccountInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
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

function explorer(network, rpc, kind, value) {
  const cluster = network === "localnet" ? `cluster=custom&customUrl=${encodeURIComponent(rpc)}` : `cluster=${network}`;
  return `https://explorer.solana.com/${kind}/${value}?${cluster}`;
}

async function send(connection, tx, signers, label) {
  const sig = await sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed" });
  console.log(`  ok  ${label}`);
  return sig;
}

async function createMintWithMetadata(connection, { payer, decimals, freezeAuthority, defaultFrozen, permanentDelegate, name, symbol, uri, extra }) {
  const mint = Keypair.generate();
  const extensions = [ExtensionType.MetadataPointer];
  if (defaultFrozen) extensions.push(ExtensionType.DefaultAccountState);
  if (permanentDelegate) extensions.push(ExtensionType.PermanentDelegate);
  const mintLen = getMintLen(extensions);
  const metadata = { mint: mint.publicKey, name, symbol, uri, additionalMetadata: extra, updateAuthority: payer.publicKey };
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const create = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
  );
  if (defaultFrozen) {
    create.add(createInitializeDefaultAccountStateInstruction(mint.publicKey, AccountState.Frozen, TOKEN_2022_PROGRAM_ID));
  }
  if (permanentDelegate) {
    create.add(createInitializePermanentDelegateInstruction(mint.publicKey, permanentDelegate, TOKEN_2022_PROGRAM_ID));
  }
  create.add(
    createInitializeMintInstruction(mint.publicKey, decimals, payer.publicKey, freezeAuthority, TOKEN_2022_PROGRAM_ID),
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
      ...extra.map(([field, value]) =>
        createUpdateFieldInstruction({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint.publicKey, updateAuthority: payer.publicKey, field, value }),
      ),
    );
    await send(connection, fields, [payer], `${symbol} extra gegevens`);
  }
  return { mint: mint.publicKey, signature };
}

async function allocate(connection, { payer, mint, owner, amount, keepFrozen, label }) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint, TOKEN_2022_PROGRAM_ID),
    createThawAccountInstruction(ata, mint, payer.publicKey, [], TOKEN_2022_PROGRAM_ID),
    createMintToCheckedInstruction(mint, ata, payer.publicKey, BigInt(amount), 0, [], TOKEN_2022_PROGRAM_ID),
  );
  if (keepFrozen) tx.add(createFreezeAccountInstruction(ata, mint, payer.publicKey, [], TOKEN_2022_PROGRAM_ID));
  const signature = await send(connection, tx, [payer], `${label}: ${amount.toLocaleString("nl-BE")} MSCAN${keepFrozen ? " (vergrendeld)" : ""}`);
  return { account: ata, signature };
}

async function main() {
  const network = arg("network", "devnet");
  if (network === "mainnet-beta" && !process.argv.includes("--ik-weet-wat-ik-doe")) {
    throw new Error("Mainnet pas na juridisch groen licht. Gebruik localnet of devnet.");
  }
  const rpc = arg("rpc", RPC[network]);
  if (!rpc) throw new Error(`Onbekend netwerk "${network}".`);
  const founder = new PublicKey(arg("founder", DEFAULT_FOUNDER));
  const keysDir = arg("keys", join(ROOT, ".keys", network));
  const out = arg("out", join(ROOT, "shared", "deployments", `${network}.json`));
  const offering = JSON.parse(readFileSync(join(ROOT, "shared", "aanbod.json"), "utf8"));

  if (existsSync(out) && !process.argv.includes("--force")) {
    throw new Error(`${out} bestaat al. Gebruik --force om alles opnieuw aan te maken.`);
  }

  const connection = new Connection(rpc, "confirmed");
  const authority = loadOrCreateKey(join(keysDir, "authority.json"));
  const reserve = loadOrCreateKey(join(keysDir, "reserve.json"));
  const recovery = loadOrCreateKey(join(keysDir, "herstel.json"));
  console.log(`Netwerk: ${network} (${rpc})`);
  console.log(`Serversleutel: ${authority.publicKey.toBase58()}`);
  console.log(`Oprichterswallet: ${founder.toBase58()}`);

  let balance = (await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL;
  if (balance < MIN_SOL) {
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

  const metadataUri = arg("uri", offering.token.metadataUri);
  const site = metadataUri.replace(/\/token\/.*$/, "");
  const payment = await createMintWithMetadata(connection, {
    payer: authority,
    decimals: offering.betaalmunt.decimalen,
    freezeAuthority: null,
    defaultFrozen: false,
    name: `${offering.betaalmunt.naam} (testnet)`,
    symbol: offering.betaalmunt.symbool,
    uri: `${site}/token/teur.json`,
    extra: [["gebruik", "enkel voor de demo, geen waarde"]],
  });

  const shares = await createMintWithMetadata(connection, {
    payer: authority,
    decimals: offering.token.decimalen,
    freezeAuthority: authority.publicKey,
    defaultFrozen: true,
    permanentDelegate: recovery.publicKey,
    name: network === "mainnet-beta" ? offering.token.naam : `${offering.token.naam} (testnet)`,
    symbol: offering.token.symbool,
    uri: metadataUri,
    extra: [
      ["totaal", String(offering.token.totaal)],
      ["website", site],
    ],
  });

  const founderAlloc = await allocate(connection, {
    payer: authority,
    mint: shares.mint,
    owner: founder,
    amount: offering.allocaties.oprichter,
    keepFrozen: true,
    label: "Oprichter",
  });
  const vault1 = await allocate(connection, {
    payer: authority,
    mint: shares.mint,
    owner: authority.publicKey,
    amount: offering.allocaties["ronde-1"],
    keepFrozen: false,
    label: "Verkoopkluis ronde 1",
  });
  const reserve2 = await allocate(connection, {
    payer: authority,
    mint: shares.mint,
    owner: reserve.publicKey,
    amount: offering.allocaties["ronde-2"],
    keepFrozen: true,
    label: "Reserve ronde 2",
  });

  const revoke = await send(
    connection,
    new Transaction().add(createSetAuthorityInstruction(shares.mint, authority.publicKey, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID)),
    [authority],
    "Muntrecht definitief ingetrokken: het totaal blijft 100.000.000",
  );

  const escrow = getAssociatedTokenAddressSync(payment.mint, authority.publicKey, false, TOKEN_2022_PROGRAM_ID);
  await send(
    connection,
    new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, escrow, authority.publicKey, payment.mint, TOKEN_2022_PROGRAM_ID)),
    [authority],
    "Escrow-rekening voor betalingen",
  );

  const deployment = {
    network,
    rpc,
    createdAt: new Date().toISOString(),
    authority: authority.publicKey.toBase58(),
    founderWallet: founder.toBase58(),
    reserveOwner: reserve.publicKey.toBase58(),
    recoveryKey: recovery.publicKey.toBase58(),
    tokenMint: shares.mint.toBase58(),
    tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    paymentMint: payment.mint.toBase58(),
    paymentProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    escrow: escrow.toBase58(),
    founderTokenAccount: founderAlloc.account.toBase58(),
    vaults: { "ronde-1": vault1.account.toBase58(), "ronde-2": reserve2.account.toBase58() },
    signatures: {
      tokenAangemaakt: shares.signature,
      oprichter: founderAlloc.signature,
      ronde1: vault1.signature,
      ronde2: reserve2.signature,
      muntrechtIngetrokken: revoke,
    },
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`\nKlaar. Adressen bewaard in ${out}`);
  console.log(`Token:      ${explorer(network, rpc, "address", deployment.tokenMint)}`);
  console.log(`Oprichter:  ${explorer(network, rpc, "address", deployment.founderTokenAccount)}`);
  console.log(`\nZet de serversleutel als omgevingsvariabele SALE_AUTHORITY_SECRET (inhoud van ${join(keysDir, "authority.json")}).`);
  console.log(`Bewaar ${join(keysDir, "reserve.json")} offline: die is enkel nodig om ronde 2 te openen.`);
  console.log(`Bewaar ${join(keysDir, "herstel.json")} offline: die is enkel nodig om aandelen van een verloren wallet over te zetten.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
