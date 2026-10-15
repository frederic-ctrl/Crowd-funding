// Alles wat de site toont over aandelen en geld komt rechtstreeks van de blockchain.
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, unpackAccount, unpackMint } from "@solana/spl-token";
import type { Deployment } from "../config";

export type TokenAccountState = { address: string; amount: bigint; frozen: boolean; owner: string } | null;

export type OfferingState = {
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  founder: TokenAccountState;
  vaults: Record<string, TokenAccountState>;
  escrowMicro: bigint;
  investors: number | null;
  fetchedAt: number;
};

export type Purchase = {
  signature: string;
  time: number | null;
  buyer: string;
  tokens: number;
  paidMicro: number;
};

export type Holding = {
  owner: string;
  shareAccount: string;
  tokens: bigint;
  frozen: boolean;
  exists: boolean;
  paymentMicro: bigint;
};

function readAccount(address: PublicKey, info: Parameters<typeof unpackAccount>[1] | null): TokenAccountState {
  if (!info) return null;
  const acc = unpackAccount(address, info, TOKEN_2022_PROGRAM_ID);
  return { address: address.toBase58(), amount: acc.amount, frozen: acc.isFrozen, owner: acc.owner.toBase58() };
}

export async function fetchOfferingState(connection: Connection, dep: Deployment): Promise<OfferingState> {
  const roundIds = Object.keys(dep.vaults);
  const keys = [dep.tokenMint, dep.founderTokenAccount, dep.escrow, ...roundIds.map((id) => dep.vaults[id])].map((k) => new PublicKey(k));
  const infos = await connection.getMultipleAccountsInfo(keys, "confirmed");
  if (!infos[0]) throw new Error("Token niet gevonden op dit netwerk.");
  const mint = unpackMint(keys[0], infos[0], TOKEN_2022_PROGRAM_ID);
  const escrow = readAccount(keys[2], infos[2]);
  const vaults: Record<string, TokenAccountState> = {};
  roundIds.forEach((id, i) => (vaults[id] = readAccount(keys[3 + i], infos[3 + i])));

  return {
    supply: mint.supply,
    mintAuthority: mint.mintAuthority?.toBase58() ?? null,
    freezeAuthority: mint.freezeAuthority?.toBase58() ?? null,
    founder: readAccount(keys[1], infos[1]),
    vaults,
    escrowMicro: escrow?.amount ?? 0n,
    investors: await countInvestors(connection, dep).catch(() => null),
    fetchedAt: Date.now(),
  };
}

/** Aantal wallets met aandelen, zonder de oprichter, de kluis en de reserve. */
async function countInvestors(connection: Connection, dep: Deployment): Promise<number> {
  const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: dep.tokenMint } }],
    dataSlice: { offset: 32, length: 40 },
  });
  const excluded = new Set([dep.founderWallet, dep.authority, dep.reserveOwner]);
  let n = 0;
  for (const { account } of accounts) {
    const data = account.data;
    const owner = new PublicKey(data.subarray(0, 32)).toBase58();
    const amount = new DataView(data.buffer, data.byteOffset + 32, 8).getBigUint64(0, true);
    if (amount > 0n && !excluded.has(owner)) n += 1;
  }
  return n;
}

export async function fetchHolding(connection: Connection, dep: Deployment, owner: PublicKey): Promise<Holding> {
  const shareAccount = getAssociatedTokenAddressSync(new PublicKey(dep.tokenMint), owner, true, TOKEN_2022_PROGRAM_ID);
  const paymentAccount = getAssociatedTokenAddressSync(new PublicKey(dep.paymentMint), owner, true, new PublicKey(dep.paymentProgram));
  const [shareInfo, paymentInfo] = await connection.getMultipleAccountsInfo([shareAccount, paymentAccount], "confirmed");
  const shares = readAccount(shareAccount, shareInfo);
  const payment = paymentInfo ? unpackAccount(paymentAccount, paymentInfo, new PublicKey(dep.paymentProgram)) : null;
  return {
    owner: owner.toBase58(),
    shareAccount: shareAccount.toBase58(),
    tokens: shares?.amount ?? 0n,
    frozen: shares?.frozen ?? true,
    exists: Boolean(shares),
    paymentMicro: payment?.amount ?? 0n,
  };
}

function tokenDelta(tx: ParsedTransactionWithMeta, mint: string, predicate: (owner: string) => boolean) {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  let owner = "";
  let delta = 0;
  for (const p of post) {
    if (p.mint !== mint || !p.owner || !predicate(p.owner)) continue;
    const before = pre.find((b) => b.accountIndex === p.accountIndex);
    const d = Number(p.uiTokenAmount.amount) - Number(before?.uiTokenAmount.amount ?? 0);
    if (d !== 0) {
      owner = p.owner;
      delta += d;
    }
  }
  return { owner, delta };
}

function parsePurchase(tx: ParsedTransactionWithMeta | null, dep: Deployment, signature: string, time: number | null): Purchase | null {
  if (!tx || tx.meta?.err) return null;
  const shares = tokenDelta(tx, dep.tokenMint, (o) => o !== dep.authority && o !== dep.reserveOwner);
  const paid = tokenDelta(tx, dep.paymentMint, (o) => o === dep.authority);
  if (!shares.owner || shares.delta <= 0 || paid.delta <= 0) return null;
  return { signature, time, buyer: shares.owner, tokens: shares.delta, paidMicro: paid.delta };
}

async function purchasesFor(connection: Connection, dep: Deployment, address: PublicKey, limit: number): Promise<Purchase[]> {
  const sigs = await connection.getSignaturesForAddress(address, { limit }, "confirmed");
  if (sigs.length === 0) return [];
  const txs = await connection.getParsedTransactions(
    sigs.map((s) => s.signature),
    { maxSupportedTransactionVersion: 0, commitment: "confirmed" },
  );
  return txs
    .map((tx, i) => parsePurchase(tx, dep, sigs[i].signature, sigs[i].blockTime ?? null))
    .filter((p): p is Purchase => p !== null);
}

/** Laatste aankopen, gelezen uit de geschiedenis van de escrow-rekening. */
export function fetchRecentPurchases(connection: Connection, dep: Deployment, limit = 10): Promise<Purchase[]> {
  return purchasesFor(connection, dep, new PublicKey(dep.escrow), limit);
}

/** Aankopen van één wallet, gelezen uit de geschiedenis van het aandelenaccount van die wallet. */
export function fetchPurchasesOf(connection: Connection, dep: Deployment, shareAccount: string, limit = 25): Promise<Purchase[]> {
  return purchasesFor(connection, dep, new PublicKey(shareAccount), limit);
}

/** Wacht tot een transactie bevestigd is, zonder websockets (werkt overal, ook achter strikte netwerken). */
export async function confirmSignature(connection: Connection, signature: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error("De transactie werd geweigerd door het netwerk.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("De bevestiging duurt langer dan verwacht. Kijk zo meteen opnieuw in je portefeuille.");
}
