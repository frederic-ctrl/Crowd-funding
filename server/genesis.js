// Genesis op de blockchain: een genummerde pass kopen, steunen vanaf €1, geld terug binnen de
// bedenktijd en een pass activeren. Elke transactie is atomair: lukt één stap niet, dan gebeurt
// er niets. De server ondertekent als betaler van de kosten; de koper ondertekent daarna zelf in
// de eigen wallet en ziet daar exact wat er gebeurt.
//
// Elke pass is een eigen Token-2022-munt met voorraad 1, naam en nummer in de metadata en de
// extensie NonTransferable (soulbound: niet door te sturen of te verkopen). Het adres van pass n
// wordt afgeleid uit de serversleutel, zodat elk nummer maar één keer kan bestaan: twee kopers
// die tegelijk #042 proberen, kunnen niet allebei slagen. De keten beslist.
import { createHash, createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  AuthorityType,
  TYPE_SIZE,
  LENGTH_SIZE,
  getMintLen,
  getAssociatedTokenAddressSync,
  createInitializeMetadataPointerInstruction,
  createInitializeNonTransferableMintInstruction,
  createInitializeMintInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedInstruction,
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
import {
  EUR,
  findProduct,
  priceForNumber,
  passName,
  formatNumber,
  formatEur,
  cleanName,
  memoFor,
  checkPassPurchase,
  checkSupport,
  refundDeadline,
  activationMessage,
} from "../shared/genesis.js";
import { parseGenesisTx } from "../shared/history.js";
import { msg } from "../shared/messages.js";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export class PurchaseError extends Error {
  constructor(messages) {
    super(messages.join(" "));
    this.messages = messages;
  }
}

const memo = (text) => new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(text, "utf8") });

function assertAuthority(deployment, authority) {
  if (!authority.publicKey.equals(new PublicKey(deployment.authority))) throw new Error("De serversleutel hoort niet bij deze deployment.");
}

function product(cfg, productId, lang = "nl") {
  const p = findProduct(cfg, productId);
  if (!p) throw new PurchaseError([msg(lang).unknownProduct(productId)]);
  return p;
}

// --- Pass-adressen -------------------------------------------------------------------------

const derived = new Map();

/** Het sleutelpaar van pass n. Enkel de server kan het afleiden; het publieke adres staat daarna op de keten. */
export function passKeypair(authority, productId, n) {
  const seed = createHash("sha256")
    .update(authority.secretKey.subarray(0, 32))
    .update(`marketingscan-genesis:${productId}:${n}`)
    .digest();
  return Keypair.fromSeed(seed);
}

/** Publieke adressen van alle passen van een product (index 0 = pass #1). */
export function passMints(authority, p) {
  const key = `${authority.publicKey.toBase58()}:${p.id}:${p.max}`;
  if (!derived.has(key)) derived.set(key, Array.from({ length: p.max }, (_, i) => passKeypair(authority, p.id, i + 1).publicKey));
  return derived.get(key);
}

/** Het laagste vrije nummer en hoeveel er al bestaan. */
export async function nextFreeNumber(connection, authority, p) {
  const mints = passMints(authority, p);
  let used = 0;
  let next = null;
  for (let i = 0; i < mints.length; i += 100) {
    const infos = await connection.getMultipleAccountsInfo(mints.slice(i, i + 100), "confirmed");
    infos.forEach((info, j) => {
      if (info) used += 1;
      else if (next === null) next = i + j + 1;
    });
  }
  return { next, used };
}

/** Welke passen van dit product een wallet bezit: [{ number, mint, account }]. */
export async function passesOf(connection, authority, p, owner) {
  const byMint = new Map(passMints(authority, p).map((m, i) => [m.toBase58(), i + 1]));
  const { value } = await connection.getTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed");
  const out = [];
  for (const { pubkey, account } of value) {
    const acc = unpackAccount(pubkey, account, TOKEN_2022_PROGRAM_ID);
    const number = byMint.get(acc.mint.toBase58());
    if (number && acc.amount > 0n) out.push({ number, mint: acc.mint.toBase58(), account: pubkey.toBase58() });
  }
  return out.sort((a, b) => a.number - b.number);
}

async function paymentBalance(connection, deployment, owner) {
  const paymentMint = new PublicKey(deployment.paymentMint);
  const paymentProgram = new PublicKey(deployment.paymentProgram);
  const account = getAssociatedTokenAddressSync(paymentMint, owner, false, paymentProgram);
  const info = await connection.getAccountInfo(account, "confirmed");
  return { account, balance: info ? Number(unpackAccount(account, info, paymentProgram).amount) : 0 };
}

async function finish(connection, tx, authority, extraSigners = []) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = blockhash;
  tx.partialSign(authority, ...extraSigners);
  return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), lastValidBlockHeight };
}

// --- Kopen -------------------------------------------------------------------------------

/**
 * Bouwt de aankoop van één pass: de munt van het volgende vrije nummer wordt aangemaakt, de pass
 * gaat naar de koper, het muntrecht wordt meteen ingetrokken (voorraad blijft 1) en de betaling gaat naar de kas.
 */
export async function buildPassPurchase({ connection, deployment, cfg, productId, buyer, authority, name = "", now = new Date(), lang = "nl" }) {
  assertAuthority(deployment, authority);
  const p = product(cfg, productId, lang);
  const clean = cleanName(name, lang);
  if (clean.fout) throw new PurchaseError([clean.fout]);

  const [{ next }, held, { account: buyerPayment, balance }] = await Promise.all([
    nextFreeNumber(connection, authority, p),
    passesOf(connection, authority, p, buyer),
    paymentBalance(connection, deployment, buyer),
  ]);
  const errors = checkPassPurchase({ cfg, product: p, nextNumber: next, held: held.length, balanceMicro: balance, network: deployment.network, now, lang });
  if (errors.length > 0) throw new PurchaseError(errors);

  const number = next;
  const price = priceForNumber(p, number);
  const mint = passKeypair(authority, p.id, number);
  const buyerPass = getAssociatedTokenAddressSync(mint.publicKey, buyer, false, TOKEN_2022_PROGRAM_ID);
  const metadata = {
    mint: mint.publicKey,
    name: passName(p, number),
    symbol: p.symbool,
    uri: `${cfg.metadataBasis}/${p.id}.json`,
    additionalMetadata: [],
    updateAuthority: authority.publicKey,
  };
  const mintLen = getMintLen([ExtensionType.MetadataPointer, ExtensionType.NonTransferable]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + TYPE_SIZE + LENGTH_SIZE + pack(metadata).length);
  const paymentMint = new PublicKey(deployment.paymentMint);
  const paymentProgram = new PublicKey(deployment.paymentProgram);

  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: authority.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeMetadataPointerInstruction(mint.publicKey, authority.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeNonTransferableMintInstruction(mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint.publicKey, 0, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: authority.publicKey,
      updateAuthority: authority.publicKey,
    }),
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, buyerPass, buyer, mint.publicKey, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createMintToCheckedInstruction(mint.publicKey, buyerPass, authority.publicKey, 1n, 0, [], TOKEN_2022_PROGRAM_ID),
    createSetAuthorityInstruction(mint.publicKey, authority.publicKey, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID),
    createTransferCheckedInstruction(buyerPayment, paymentMint, new PublicKey(deployment.kas), buyer, BigInt(price), cfg.betaalmunt.decimalen, [], paymentProgram),
    memo(memoFor({ kind: "aankoop", product: p, number, name: clean.naam })),
  );
  const signed = await finish(connection, tx, authority, [mint]);
  return { ...signed, productId: p.id, number, label: formatNumber(p, number), priceMicro: price, mint: mint.publicKey.toBase58() };
}

/** Bouwt een steun vanaf €1: de betaling gaat naar de kas, en de eerste keer krijg je de supporter-badge. */
export async function buildSupport({ connection, deployment, cfg, buyer, eurMicro, authority, name = "", now = new Date(), lang = "nl" }) {
  assertAuthority(deployment, authority);
  const clean = cleanName(name, lang);
  if (clean.fout) throw new PurchaseError([clean.fout]);
  const supporterMint = new PublicKey(deployment.supporterMint);
  const badge = getAssociatedTokenAddressSync(supporterMint, buyer, false, TOKEN_2022_PROGRAM_ID);
  const [{ account: buyerPayment, balance }, badgeInfo] = await Promise.all([
    paymentBalance(connection, deployment, buyer),
    connection.getAccountInfo(badge, "confirmed"),
  ]);
  const errors = checkSupport({ cfg, eurMicro, balanceMicro: balance, network: deployment.network, now, lang });
  if (errors.length > 0) throw new PurchaseError(errors);

  const hasBadge = badgeInfo ? unpackAccount(badge, badgeInfo, TOKEN_2022_PROGRAM_ID).amount > 0n : false;
  const tx = new Transaction();
  if (!hasBadge) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, badge, buyer, supporterMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
      createMintToCheckedInstruction(supporterMint, badge, authority.publicKey, 1n, 0, [], TOKEN_2022_PROGRAM_ID),
    );
  }
  tx.add(
    createTransferCheckedInstruction(buyerPayment, new PublicKey(deployment.paymentMint), new PublicKey(deployment.kas), buyer, BigInt(eurMicro), cfg.betaalmunt.decimalen, [], new PublicKey(deployment.paymentProgram)),
    memo(memoFor({ kind: "steun", name: clean.naam })),
  );
  const signed = await finish(connection, tx, authority);
  return { ...signed, productId: "steun", amountMicro: eurMicro, newBadge: !hasBadge };
}

// --- Geld terug --------------------------------------------------------------------------

/** Zoekt de aankoop van een pass: de oudste transactie van de munt. */
export async function findPassPurchase(connection, deployment, cfg, mint) {
  const sigs = await connection.getSignaturesForAddress(mint, { limit: 1000 }, "confirmed");
  const first = sigs[sigs.length - 1];
  if (!first) return null;
  const tx = await connection.getParsedTransaction(first.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  const event = parseGenesisTx(tx, deployment, cfg, first.signature, first.blockTime ?? tx?.blockTime ?? null);
  return event?.kind === "aankoop" ? event : null;
}

/**
 * Bouwt een terugbetaling binnen de bedenktijd: in één transactie verbrandt de koper de pass en
 * gaat het volledige bedrag van de kas terug naar de koper.
 */
export async function buildRefund({ connection, deployment, cfg, productId, number, buyer, authority, now = new Date(), lang = "nl" }) {
  assertAuthority(deployment, authority);
  const m = msg(lang);
  const p = product(cfg, productId, lang);
  if (!Number.isInteger(number) || number < 1 || number > p.max) throw new PurchaseError([m.unknownNumber()]);
  const mint = passKeypair(authority, p.id, number).publicKey;
  const buyerPass = getAssociatedTokenAddressSync(mint, buyer, false, TOKEN_2022_PROGRAM_ID);
  const kas = new PublicKey(deployment.kas);
  const paymentMint = new PublicKey(deployment.paymentMint);
  const paymentProgram = new PublicKey(deployment.paymentProgram);
  const [mintInfo, passInfo, kasInfo] = await connection.getMultipleAccountsInfo([mint, buyerPass, kas], "confirmed");
  if (!mintInfo) throw new PurchaseError([m.passMissing(passName(p, number))]);
  if (unpackMint(mint, mintInfo, TOKEN_2022_PROGRAM_ID).supply === 0n) throw new PurchaseError([m.alreadyRefunded(passName(p, number))]);
  if (!passInfo || unpackAccount(buyerPass, passInfo, TOKEN_2022_PROGRAM_ID).amount !== 1n) {
    throw new PurchaseError([m.notInWallet(passName(p, number))]);
  }

  const purchase = await findPassPurchase(connection, deployment, cfg, mint);
  if (!purchase || purchase.number !== number || purchase.productId !== p.id || purchase.wallet !== buyer.toBase58() || !purchase.time) {
    throw new PurchaseError([m.purchaseNotFound()]);
  }
  const deadline = refundDeadline(cfg, purchase.time);
  if (now.getTime() > deadline) {
    const date = new Intl.DateTimeFormat(m.dateLocale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(deadline));
    throw new PurchaseError([m.refundOver(cfg.bedenktijdDagen, date)]);
  }
  const kasBalance = kasInfo ? Number(unpackAccount(kas, kasInfo, paymentProgram).amount) : 0;
  if (kasBalance < purchase.amountMicro) throw new Error("De kas heeft te weinig saldo voor deze terugbetaling.");

  const buyerPayment = getAssociatedTokenAddressSync(paymentMint, buyer, false, paymentProgram);
  const tx = new Transaction().add(
    createBurnCheckedInstruction(buyerPass, mint, buyer, 1n, 0, [], TOKEN_2022_PROGRAM_ID),
    createCloseAccountInstruction(buyerPass, authority.publicKey, buyer, [], TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, buyerPayment, buyer, paymentMint, paymentProgram, ASSOCIATED_TOKEN_PROGRAM_ID),
    createTransferCheckedInstruction(kas, paymentMint, buyerPayment, authority.publicKey, BigInt(purchase.amountMicro), cfg.betaalmunt.decimalen, [], paymentProgram),
    memo(memoFor({ kind: "terugbetaling", product: p, number })),
  );
  const signed = await finish(connection, tx, authority);
  return { ...signed, productId: p.id, number, amountMicro: purchase.amountMicro };
}

// --- Opnemen -----------------------------------------------------------------------------

/**
 * Wat de oprichter uit de kas mag opnemen: alles behalve de aankopen die nog binnen de bedenktijd
 * vallen. Zo kan elke terugbetaling altijd meteen uitbetaald worden.
 */
export function withdrawable(cfg, events, kasMicro, now = new Date()) {
  const refunded = new Set(events.filter((e) => e.kind === "terugbetaling").map((e) => `${e.productId}:${e.number}`));
  const buffer = events
    .filter((e) => e.kind === "aankoop" && !refunded.has(`${e.productId}:${e.number}`) && (!e.time || now.getTime() <= refundDeadline(cfg, e.time)))
    .reduce((s, e) => s + e.amountMicro, 0);
  return { bufferMicro: buffer, opneembaarMicro: Math.max(0, kasMicro - buffer) };
}

/** Bouwt een opname van de kas naar de rekening van de oprichter, met memo. Volledig ondertekend door de server. */
export async function buildWithdrawal({ connection, deployment, cfg, authority, amountMicro }) {
  assertAuthority(deployment, authority);
  if (!Number.isInteger(amountMicro) || amountMicro <= 0) throw new PurchaseError([msg("nl").nothingToWithdraw()]);
  const paymentMint = new PublicKey(deployment.paymentMint);
  const paymentProgram = new PublicKey(deployment.paymentProgram);
  const founderPayment = new PublicKey(deployment.founderPaymentAccount);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, founderPayment, new PublicKey(deployment.founderWallet), paymentMint, paymentProgram, ASSOCIATED_TOKEN_PROGRAM_ID),
    createTransferCheckedInstruction(new PublicKey(deployment.kas), paymentMint, founderPayment, authority.publicKey, BigInt(amountMicro), cfg.betaalmunt.decimalen, [], paymentProgram),
    memo(memoFor({ kind: "opname" })),
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(authority);
  return { transaction: tx, lastValidBlockHeight };
}

// --- Activeren ---------------------------------------------------------------------------

const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function activationSecret(authority, env) {
  if (env.GENESIS_ACTIVATION_SECRET) return Buffer.from(env.GENESIS_ACTIVATION_SECRET, "utf8");
  return createHash("sha256").update(authority.secretKey.subarray(0, 32)).update("marketingscan-genesis:activatie").digest();
}

function checksum(secret, p, number) {
  const mac = createHmac("sha256", secret).update(`${p.id}:${number}`).digest();
  let out = "";
  for (let i = 0; i < 8; i++) out += BASE32[mac[i] % 32];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Activatiecode van een pass, bv. MSGEN-042-K7QD-2MXP. Hoort bij de pass, niet bij de wallet. */
export function activationCode(authority, cfg, productId, number, env = process.env) {
  const p = product(cfg, productId);
  return `${p.symbool}-${formatNumber(p, number).slice(1)}-${checksum(activationSecret(authority, env), p, number)}`;
}

/** Leest en controleert een activatiecode. Geeft { productId, number } of null. */
export function readActivationCode(authority, cfg, code, env = process.env) {
  const m = /^([A-Z]+)-(\d+)-([A-Z0-9]{4}-[A-Z0-9]{4})$/.exec(String(code ?? "").trim().toUpperCase());
  if (!m) return null;
  const p = cfg.producten.find((x) => x.symbool === m[1]);
  const number = Number(m[2]);
  if (!p || number < 1 || number > p.max) return null;
  const expected = Buffer.from(checksum(activationSecret(authority, env), p, number));
  const given = Buffer.from(m[3]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { productId: p.id, number } : null;
}

/** Controleert een handtekening van een Solana-wallet (ed25519) over een tekst. */
export function verifyWalletSignature(wallet, message, signature) {
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(new PublicKey(wallet).toBytes()).toString("base64url") }, format: "jwk" });
    return verify(null, Buffer.from(message, "utf8"), key, Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Is pass n van dit product nog geldig (bestaat, niet teruggegeven) en wie heeft hem? */
export async function passStatus(connection, authority, cfg, productId, number) {
  const p = product(cfg, productId);
  const mint = passKeypair(authority, p.id, number).publicKey;
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) return { bestaat: false, geldig: false, mint: mint.toBase58(), wallet: null };
  if (unpackMint(mint, info, TOKEN_2022_PROGRAM_ID).supply !== 1n) return { bestaat: true, geldig: false, mint: mint.toBase58(), wallet: null };
  const { value } = await connection.getTokenLargestAccounts(mint, "confirmed");
  const holder = value.find((a) => a.amount === "1");
  let wallet = null;
  if (holder) {
    const acc = await connection.getAccountInfo(holder.address, "confirmed");
    if (acc) wallet = unpackAccount(holder.address, acc, TOKEN_2022_PROGRAM_ID).owner.toBase58();
  }
  return { bestaat: true, geldig: Boolean(wallet), mint: mint.toBase58(), wallet };
}

/**
 * Activeert een pass: de wallet bewijst met een gratis handtekening dat de pass van haar is,
 * en krijgt de activatiecode voor Marketing Scan Pro.
 */
export async function activate({ connection, authority, cfg, productId, number, wallet, message, signature, now = new Date(), env = process.env, lang = "nl" }) {
  const m = msg(lang);
  const p = product(cfg, productId, lang);
  const time = /Tijdstip: (.+)$/.exec(message ?? "")?.[1];
  if (!time || message !== activationMessage(p, number, wallet, time)) throw new PurchaseError([m.signedTextWrong()]);
  if (Math.abs(now.getTime() - new Date(time).getTime()) > 10 * 60_000) throw new PurchaseError([m.signatureExpired()]);
  if (!verifyWalletSignature(wallet, message, signature)) throw new PurchaseError([m.signatureWrong()]);
  const status = await passStatus(connection, authority, cfg, p.id, number);
  if (!status.geldig || status.wallet !== wallet) throw new PurchaseError([m.notInWallet(passName(p, number))]);
  return { code: activationCode(authority, cfg, p.id, number, env), productId: p.id, number, websites: p.websites };
}

export { EUR, formatEur };
