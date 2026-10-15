// Volledige test op een echte Solana-keten (lokale validator). Draait enkel als
// SOLANA_E2E_DEPLOYMENT naar een deployment-bestand wijst en SOLANA_E2E_AUTHORITY naar de serversleutel:
//   SOLANA_E2E_DEPLOYMENT=shared/deployments/localnet.json SOLANA_E2E_AUTHORITY=.keys/localnet/authority.json node --test test/solana-e2e.test.js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
  createTransferCheckedInstruction,
  getPermanentDelegate,
} from "@solana/spl-token";
import { buildPurchase, PurchaseError } from "../server/purchase.js";
import { sendTestEuro, FaucetError } from "../server/faucet.js";
import { EUR } from "../shared/offering.js";

const deploymentPath = process.env.SOLANA_E2E_DEPLOYMENT;
const authorityPath = process.env.SOLANA_E2E_AUTHORITY;
const skip = !deploymentPath || !authorityPath ? "SOLANA_E2E_DEPLOYMENT en SOLANA_E2E_AUTHORITY niet gezet" : false;

let deployment, offering, connection, authority, tokenMint, paymentMint;

before(() => {
  if (skip) return;
  deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  offering = JSON.parse(readFileSync(new URL("../shared/aanbod.json", import.meta.url), "utf8"));
  connection = new Connection(deployment.rpc, "confirmed");
  authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(authorityPath, "utf8"))));
  tokenMint = new PublicKey(deployment.tokenMint);
  paymentMint = new PublicKey(deployment.paymentMint);
});

async function buy(buyer, eur, roundId = "ronde-1") {
  const res = await buildPurchase({
    connection,
    deployment,
    offering,
    roundId,
    buyer: buyer.publicKey,
    eurMicro: Math.round(eur * 100) * 10_000,
    authority,
  });
  const tx = Transaction.from(Buffer.from(res.transaction, "base64"));
  tx.partialSign(buyer); // zoals de wallet van de investeerder doet
  const signature = await connection.sendRawTransaction(tx.serialize());
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...bh }, "confirmed");
  return { ...res, signature };
}

const sharesOf = (owner) =>
  getAccount(connection, getAssociatedTokenAddressSync(tokenMint, owner, false, TOKEN_2022_PROGRAM_ID), "confirmed", TOKEN_2022_PROGRAM_ID);
const eurOf = async (account) => Number((await getAccount(connection, account, "confirmed", TOKEN_2022_PROGRAM_ID)).amount);

test("de token staat correct op de keten", { skip }, async () => {
  const mint = await getMint(connection, tokenMint, "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(mint.supply, 100_000_000n);
  assert.equal(mint.mintAuthority, null, "muntrecht moet ingetrokken zijn");
  assert.equal(mint.decimals, 0);
  const founder = await getAccount(connection, new PublicKey(deployment.founderTokenAccount), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(founder.amount, 51_000_000n);
  assert.equal(founder.isFrozen, true, "oprichtersaandelen zijn vergrendeld");
  assert.equal(founder.owner.toBase58(), deployment.founderWallet);
  const delegate = getPermanentDelegate(mint);
  assert.equal(delegate?.delegate.toBase58(), deployment.recoveryKey, "herstelsleutel is de permanent delegate");
  const reserve = await getAccount(connection, new PublicKey(deployment.vaults["ronde-2"]), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(reserve.amount, 40_000_000n);
  assert.equal(reserve.isFrozen, true);
});

test("€1 testgeld halen en €1 investeren geeft 200 aandelen, atomair en vergrendeld", { skip }, async () => {
  const investor = Keypair.generate(); // heeft geen SOL: de server betaalt de kosten
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey });
  const escrowBefore = await eurOf(new PublicKey(deployment.escrow));
  const vaultBefore = Number((await getAccount(connection, new PublicKey(deployment.vaults["ronde-1"]), "confirmed", TOKEN_2022_PROGRAM_ID)).amount);

  const res = await buy(investor, 1);
  assert.equal(res.tokens, 200);
  assert.equal(res.cost, 1 * EUR);

  const shares = await sharesOf(investor.publicKey);
  assert.equal(shares.amount, 200n);
  assert.equal(shares.isFrozen, true);
  assert.equal(await eurOf(new PublicKey(deployment.escrow)), escrowBefore + EUR);
  const vaultAfter = Number((await getAccount(connection, new PublicKey(deployment.vaults["ronde-1"]), "confirmed", TOKEN_2022_PROGRAM_ID)).amount);
  assert.equal(vaultAfter, vaultBefore - 200);
  const payment = getAssociatedTokenAddressSync(paymentMint, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);
  assert.equal(await eurOf(payment), 49 * EUR);
});

test("tweede aankoop telt op, onafgeronde centen blijven bij de investeerder", { skip }, async () => {
  const investor = Keypair.generate();
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey });
  await buy(investor, 2.5);
  const res = await buy(investor, 0.999); // wordt €1,00 na afronding op centen
  assert.equal(res.tokens, 200);
  assert.equal((await sharesOf(investor.publicKey)).amount, 700n);
});

test("aandelen kunnen niet vrij doorgestuurd worden", { skip }, async () => {
  const investor = Keypair.generate();
  const other = Keypair.generate();
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey });
  await buy(investor, 1);
  const from = getAssociatedTokenAddressSync(tokenMint, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const to = getAssociatedTokenAddressSync(tokenMint, other.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(createTransferCheckedInstruction(from, tokenMint, to, investor.publicKey, 1n, 0, [], TOKEN_2022_PROGRAM_ID));
  tx.feePayer = authority.publicKey;
  await assert.rejects(sendAndConfirmTransaction(connection, tx, [authority, investor]));
});

test("regels: minimum, saldo, maximum per persoon en gesloten ronde", { skip }, async () => {
  const investor = Keypair.generate();
  await assert.rejects(buy(investor, 0.5), (e) => e instanceof PurchaseError && /minimum is €1/.test(e.message));
  await assert.rejects(buy(investor, 1), (e) => e instanceof PurchaseError && /niet genoeg saldo/.test(e.message));
  await assert.rejects(buy(investor, 6000), (e) => e instanceof PurchaseError && /maximum is €5\.000 per persoon/.test(e.message));
  await assert.rejects(buy(investor, 1, "ronde-2"), (e) => e instanceof PurchaseError && /Ronde 2 is niet open/.test(e.message));
});

test("testgeld: maximaal tot 100 tEUR saldo", { skip }, async () => {
  const investor = Keypair.generate();
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey });
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey });
  await assert.rejects(
    sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey }),
    (e) => e instanceof FaucetError,
  );
});

test("een gewijzigde transactie wordt geweigerd door de keten", { skip }, async () => {
  const investor = Keypair.generate();
  await sendTestEuro({ connection, deployment, offering, authority, recipient: investor.publicKey });
  const res = await buildPurchase({ connection, deployment, offering, roundId: "ronde-1", buyer: investor.publicKey, eurMicro: EUR, authority });
  const tx = Transaction.from(Buffer.from(res.transaction, "base64"));
  // De investeerder probeert meer aandelen te krijgen dan betaald: de serverhandtekening klopt dan niet meer.
  const transfer = tx.instructions[3];
  transfer.data = Buffer.from(transfer.data);
  transfer.data.writeBigUInt64LE(1_000_000n, 1);
  tx.partialSign(investor);
  assert.throws(() => tx.serialize());
});
