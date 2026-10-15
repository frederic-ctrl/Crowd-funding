// Bouwt een atomaire aankooptransactie: de investeerder betaalt en krijgt de aandelen in
// dezelfde transactie. Lukt één stap niet, dan gebeurt er niets. De server ondertekent als
// betaler van de kosten en als beheerder van de verkoopkluis; de investeerder ondertekent
// daarna zelf in de eigen wallet en ziet daar exact wat er gebeurt.
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountState,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createThawAccountInstruction,
  createFreezeAccountInstruction,
  createTransferCheckedInstruction,
  unpackAccount,
} from "@solana/spl-token";
import { EUR, findRound, quote, checkPurchase } from "../shared/offering.js";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export class PurchaseError extends Error {
  constructor(messages) {
    super(messages.join(" "));
    this.messages = messages;
  }
}

function formatEur(micro) {
  return (micro / EUR).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readTokenAccount(address, info, programId) {
  if (!info) return null;
  return unpackAccount(address, info, programId);
}

/**
 * @param {{ connection: import("@solana/web3.js").Connection, deployment: object, offering: object,
 *   roundId: string, buyer: PublicKey, eurMicro: number, authority: import("@solana/web3.js").Keypair, now?: Date }} p
 */
export async function buildPurchase({ connection, deployment, offering, roundId, buyer, eurMicro, authority, now = new Date() }) {
  const round = findRound(offering, roundId);
  if (!round) throw new PurchaseError([`Onbekende ronde "${roundId}".`]);
  if (!authority.publicKey.equals(new PublicKey(deployment.authority))) {
    throw new Error("De serversleutel hoort niet bij deze deployment.");
  }

  const tokenMint = new PublicKey(deployment.tokenMint);
  const paymentMint = new PublicKey(deployment.paymentMint);
  const paymentProgram = new PublicKey(deployment.paymentProgram);
  const vault = new PublicKey(deployment.vaults[roundId]);
  const escrow = new PublicKey(deployment.escrow);
  const buyerShares = getAssociatedTokenAddressSync(tokenMint, buyer, false, TOKEN_2022_PROGRAM_ID);
  const buyerPayment = getAssociatedTokenAddressSync(paymentMint, buyer, false, paymentProgram);

  const [vaultInfo, sharesInfo, paymentInfo] = await connection.getMultipleAccountsInfo([vault, buyerShares, buyerPayment]);
  const vaultAccount = readTokenAccount(vault, vaultInfo, TOKEN_2022_PROGRAM_ID);
  if (!vaultAccount) throw new Error(`Verkoopkluis van ${round.naam} niet gevonden.`);
  const sharesAccount = readTokenAccount(buyerShares, sharesInfo, TOKEN_2022_PROGRAM_ID);
  const paymentAccount = readTokenAccount(buyerPayment, paymentInfo, paymentProgram);

  const heldTokens = sharesAccount ? Number(sharesAccount.amount) : 0;
  const balanceMicro = paymentAccount ? Number(paymentAccount.amount) : 0;
  const errors = checkPurchase({
    round,
    eurMicro,
    heldTokens,
    vaultRemaining: Number(vaultAccount.amount),
    balanceMicro,
    now,
  });
  if (errors.length > 0) throw new PurchaseError(errors);

  const { tokens, cost } = quote(round, eurMicro);
  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      authority.publicKey,
      buyerShares,
      buyer,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );
  // Nieuwe en bestaande aandelenaccounts zijn bevroren (niet overdraagbaar). Even ontdooien om te ontvangen.
  const frozen = !sharesAccount || sharesAccount.isFrozen;
  if (frozen) tx.add(createThawAccountInstruction(buyerShares, tokenMint, authority.publicKey, [], TOKEN_2022_PROGRAM_ID));
  tx.add(
    createTransferCheckedInstruction(buyerPayment, paymentMint, escrow, buyer, BigInt(cost), offering.betaalmunt.decimalen, [], paymentProgram),
    createTransferCheckedInstruction(vault, tokenMint, buyerShares, authority.publicKey, BigInt(tokens), offering.token.decimalen, [], TOKEN_2022_PROGRAM_ID),
    createFreezeAccountInstruction(buyerShares, tokenMint, authority.publicKey, [], TOKEN_2022_PROGRAM_ID),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`${offering.project} ${round.naam}: ${tokens} ${offering.token.symbool} voor ${formatEur(cost)} ${offering.betaalmunt.symbool}`, "utf8"),
    }),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = blockhash;
  tx.partialSign(authority);

  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    tokens,
    cost,
    roundId,
    lastValidBlockHeight,
    state: frozen ? AccountState.Frozen : AccountState.Initialized,
  };
}
