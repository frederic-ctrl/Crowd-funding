// Testgeld voor de demo: stuurt tEUR naar een wallet. Werkt nooit op mainnet.
import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToCheckedInstruction,
  unpackAccount,
} from "@solana/spl-token";
import { EUR } from "../shared/genesis.js";

export const FAUCET_AMOUNT = 1000 * EUR;
export const FAUCET_MAX_BALANCE = 1000 * EUR;

export class FaucetError extends Error {}

export async function sendTestEuro({ connection, deployment, cfg, authority, recipient, amountMicro = FAUCET_AMOUNT }) {
  if (deployment.network === "mainnet-beta") throw new FaucetError("Testgeld bestaat niet op mainnet.");
  const paymentMint = new PublicKey(deployment.paymentMint);
  const paymentProgram = new PublicKey(deployment.paymentProgram);
  const ata = getAssociatedTokenAddressSync(paymentMint, recipient, false, paymentProgram);

  const info = await connection.getAccountInfo(ata);
  const balance = info ? Number(unpackAccount(ata, info, paymentProgram).amount) : 0;
  if (balance >= FAUCET_MAX_BALANCE) {
    throw new FaucetError(`Je hebt al ${(balance / EUR).toLocaleString("nl-BE")} ${cfg.betaalmunt.symbool}. Meer testgeld is niet nodig.`);
  }

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, recipient, paymentMint, paymentProgram),
    createMintToCheckedInstruction(paymentMint, ata, authority.publicKey, BigInt(amountMicro), cfg.betaalmunt.decimalen, [], paymentProgram),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });
  return { signature, amountMicro, balanceMicro: balance + amountMicro };
}
