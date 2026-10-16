// Testgeld voor de demo: stuurt tEUR of tUSD naar een wallet. Werkt nooit op mainnet.
import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToCheckedInstruction,
  unpackAccount,
} from "@solana/spl-token";
import { EUR } from "../shared/genesis.js";
import { coinById } from "../shared/munten.js";
import { msg } from "../shared/messages.js";

export const FAUCET_AMOUNT = 1000 * EUR;
export const FAUCET_MAX_BALANCE = 1000 * EUR;

export class FaucetError extends Error {}

export async function sendTestCoin({ connection, deployment, cfg, authority, recipient, munt = "eurc", amountMicro = FAUCET_AMOUNT, lang = "nl" }) {
  const m = msg(lang);
  if (deployment.network === "mainnet-beta") throw new FaucetError(m.faucetMainnet());
  const c = coinById(deployment, cfg, munt);
  if (!c) throw new FaucetError(m.unknownCoin(munt));
  const paymentMint = new PublicKey(c.mint);
  const paymentProgram = new PublicKey(c.program);
  const ata = getAssociatedTokenAddressSync(paymentMint, recipient, false, paymentProgram);

  const info = await connection.getAccountInfo(ata);
  const balance = info ? Number(unpackAccount(ata, info, paymentProgram).amount) : 0;
  if (balance >= FAUCET_MAX_BALANCE) {
    throw new FaucetError(m.faucetEnough((balance / EUR).toLocaleString(m.dateLocale), c.symbool));
  }

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, recipient, paymentMint, paymentProgram),
    createMintToCheckedInstruction(paymentMint, ata, authority.publicKey, BigInt(amountMicro), c.decimalen, [], paymentProgram),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });
  return { signature, munt: c.id, symbool: c.symbool, amountMicro, balanceMicro: balance + amountMicro };
}
