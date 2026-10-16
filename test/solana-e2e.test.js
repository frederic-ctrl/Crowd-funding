// Volledige test op een echte Solana-keten (lokale validator). Draait enkel als
// SOLANA_E2E_DEPLOYMENT naar een deployment-bestand wijst en SOLANA_E2E_AUTHORITY naar de serversleutel:
//   SOLANA_E2E_DEPLOYMENT=shared/deployments/localnet.json SOLANA_E2E_AUTHORITY=.keys/localnet/authority.json node --test test/solana-e2e.test.js
// De test rekent relatief vanaf de huidige stand, zodat hij ook op een keten met eerdere aankopen werkt.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
  getNonTransferable,
  getTokenMetadata,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
  buildPassPurchase,
  buildSupport,
  buildRefund,
  buildWithdrawal,
  withdrawable,
  nextFreeNumber,
  activate,
  readActivationCode,
  passStatus,
  PurchaseError,
} from "../server/genesis.js";
import { sendTestEuro, FaucetError } from "../server/faucet.js";
import { EUR, findProduct, activationMessage, DAY_MS } from "../shared/genesis.js";
import { fetchEvents, summarize } from "../shared/history.js";

const deploymentPath = process.env.SOLANA_E2E_DEPLOYMENT;
const authorityPath = process.env.SOLANA_E2E_AUTHORITY;
const skip = !deploymentPath || !authorityPath ? "SOLANA_E2E_DEPLOYMENT en SOLANA_E2E_AUTHORITY niet gezet" : false;

let deployment, cfg, connection, authority, pass, agency, start, kasStart, eventsStart;
const people = {};

before(async () => {
  if (skip) return;
  deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  cfg = JSON.parse(readFileSync(new URL("../shared/genesis.json", import.meta.url), "utf8"));
  connection = new Connection(deployment.rpc, "confirmed");
  authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(authorityPath, "utf8"))));
  pass = findProduct(cfg, "pass");
  agency = findProduct(cfg, "agency");
  start = { pass: (await nextFreeNumber(connection, authority, pass)).next, agency: (await nextFreeNumber(connection, authority, agency)).next };
  kasStart = await eur(new PublicKey(deployment.kas));
  eventsStart = summarize(cfg, await fetchEvents(connection, deployment, cfg));
  // Een kleinere prijsladder voor de test: de volgende 2 nummers aan €99, daarna €149.
  cfg = { ...cfg, producten: cfg.producten.map((p) => (p.id === "pass" ? { ...p, prijsladder: [{ tot: start.pass + 1, prijsEur: 99 }, { tot: p.max, prijsEur: 149 }] } : p)) };
  pass = findProduct(cfg, "pass");
});

async function eur(account) {
  try {
    return Number((await getAccount(connection, account, "confirmed", new PublicKey(deployment.paymentProgram))).amount);
  } catch {
    return 0;
  }
}
const paymentOf = (owner) => getAssociatedTokenAddressSync(new PublicKey(deployment.paymentMint), owner, false, new PublicKey(deployment.paymentProgram));

async function send(signer, prepared) {
  const tx = Transaction.from(Buffer.from(prepared.transaction, "base64"));
  tx.partialSign(signer); // zoals de wallet van de koper doet
  const signature = await connection.sendRawTransaction(tx.serialize());
  const bh = await connection.getLatestBlockhash();
  const res = await connection.confirmTransaction({ signature, ...bh }, "confirmed");
  if (res.value.err) throw new Error(`transactie mislukt: ${JSON.stringify(res.value.err)}`);
  return signature;
}

async function funded(name) {
  const kp = Keypair.generate(); // heeft geen SOL: de server betaalt de kosten
  await sendTestEuro({ connection, deployment, cfg, authority, recipient: kp.publicKey });
  people[name] = kp;
  return kp;
}

const buyPass = (kp, productId = "pass", name = "") => buildPassPurchase({ connection, deployment, cfg, productId, buyer: kp.publicKey, authority, name });

test("setup: supporter-badge is niet overdraagbaar, de kas is van de server", { skip }, async () => {
  const badge = await getMint(connection, new PublicKey(deployment.supporterMint), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.ok(getNonTransferable(badge), "badge is soulbound");
  assert.equal(badge.decimals, 0);
  assert.equal(badge.freezeAuthority, null, "niemand kan badges bevriezen");
  const kas = await getAccount(connection, new PublicKey(deployment.kas), "confirmed", new PublicKey(deployment.paymentProgram));
  assert.equal(kas.owner.toBase58(), deployment.authority);
});

test("een Genesis Pass kopen: eigen munt, voorraad 1, genummerd, soulbound, betaling in de kas", { skip }, async () => {
  const alice = await funded("alice");
  const res = await buyPass(alice, "pass", "@alice");
  assert.equal(res.number, start.pass);
  assert.equal(res.priceMicro, 99 * EUR);
  await send(alice, res);
  people.aliceMint = res.mint;

  const mint = new PublicKey(res.mint);
  const info = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(info.supply, 1n);
  assert.equal(info.decimals, 0);
  assert.equal(info.mintAuthority, null, "er kan nooit een tweede exemplaar bijkomen");
  assert.equal(info.freezeAuthority, null, "niemand kan de pass bevriezen");
  assert.ok(getNonTransferable(info), "de pass is soulbound");
  const meta = await getTokenMetadata(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(meta.name, `Marketing Scan Genesis ${res.label}`);
  assert.equal(meta.symbol, "MSGEN");

  const held = await getAccount(connection, getAssociatedTokenAddressSync(mint, alice.publicKey, false, TOKEN_2022_PROGRAM_ID), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(held.amount, 1n);
  assert.equal(await eur(new PublicKey(deployment.kas)), kasStart + 99 * EUR);
  assert.equal(await eur(paymentOf(alice.publicKey)), 901 * EUR);
  assert.equal(await connection.getBalance(alice.publicKey), 0, "de koper had geen SOL nodig");
});

test("de prijs volgt het nummer: na de eerste trede wordt het duurder", { skip }, async () => {
  const bob = await funded("bob");
  const res = await buyPass(bob);
  assert.equal(res.number, start.pass + 1);
  assert.equal(res.priceMicro, 99 * EUR);
  await send(bob, res);
  const carol = await funded("carol");
  const next = await buyPass(carol);
  assert.equal(next.number, start.pass + 2);
  assert.equal(next.priceMicro, 149 * EUR);
  await send(carol, next);
});

test("twee kopers tegelijk voor hetzelfde nummer: de keten laat er maar één toe", { skip }, async () => {
  const dave = await funded("dave");
  const erin = await funded("erin");
  const a = await buyPass(dave);
  const b = await buyPass(erin);
  assert.equal(a.number, b.number, "allebei kregen ze hetzelfde vrije nummer voorgesteld");
  await send(dave, a);
  await assert.rejects(send(erin, b), "de tweede aankoop van hetzelfde nummer faalt, en er wordt niets betaald");
  assert.equal(await eur(paymentOf(erin.publicKey)), 1000 * EUR, "Erin betaalde niets");
  const retry = await buyPass(erin);
  assert.equal(retry.number, a.number + 1);
  await send(erin, retry);
});

test("een pass kan niet doorgestuurd worden", { skip }, async () => {
  const alice = people.alice;
  const other = Keypair.generate();
  const mint = new PublicKey(people.aliceMint);
  const passAccount = getAssociatedTokenAddressSync(mint, alice.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const to = getAssociatedTokenAddressSync(mint, other.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, to, other.publicKey, mint, TOKEN_2022_PROGRAM_ID),
    createTransferCheckedInstruction(passAccount, mint, to, alice.publicKey, 1n, 0, [], TOKEN_2022_PROGRAM_ID),
  );
  tx.feePayer = authority.publicKey;
  await assert.rejects(sendAndConfirmTransaction(connection, tx, [authority, alice]));
});

test("regels: maximum per wallet en saldo", { skip }, async () => {
  const strict = { ...cfg, producten: cfg.producten.map((p) => ({ ...p, maxPerWallet: 1 })) };
  await assert.rejects(
    buildPassPurchase({ connection, deployment, cfg: strict, productId: "pass", buyer: people.alice.publicKey, authority }),
    (e) => e instanceof PurchaseError && /één per wallet/.test(e.message),
  );
  const broke = Keypair.generate();
  await assert.rejects(buyPass(broke), (e) => e instanceof PurchaseError && /niet genoeg saldo/.test(e.message));
  await assert.rejects(buyPass(people.alice, "pass", "<b>"), (e) => e instanceof PurchaseError && /publieke naam/.test(e.message));
  await assert.rejects(buyPass(people.alice, "bestaat-niet"), (e) => e instanceof PurchaseError);
});

test("Genesis Agency: €799, eigen reeks van 25", { skip }, async () => {
  const studio = await funded("studio");
  const res = await buyPass(studio, "agency", "Studio Noord");
  assert.equal(res.number, start.agency);
  assert.equal(res.priceMicro, 799 * EUR);
  await send(studio, res);
  const meta = await getTokenMetadata(connection, new PublicKey(res.mint), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(meta.name, `Marketing Scan Genesis Agency ${res.label}`);
  assert.equal(res.label.length, 3, "#01 tot #25");
});

test("steun vanaf €1: badge de eerste keer, daarna enkel de betaling", { skip }, async () => {
  const fan = await funded("fan");
  const first = await buildSupport({ connection, deployment, cfg, buyer: fan.publicKey, eurMicro: EUR, authority });
  assert.equal(first.newBadge, true);
  await send(fan, first);
  const second = await buildSupport({ connection, deployment, cfg, buyer: fan.publicKey, eurMicro: 2.5 * EUR, authority, name: "Fan van het eerste uur" });
  assert.equal(second.newBadge, false);
  await send(fan, second);
  const badge = await getAccount(connection, getAssociatedTokenAddressSync(new PublicKey(deployment.supporterMint), fan.publicKey, false, TOKEN_2022_PROGRAM_ID), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.equal(badge.amount, 1n);
  assert.equal(await eur(paymentOf(fan.publicKey)), 996.5 * EUR);
  await assert.rejects(
    buildSupport({ connection, deployment, cfg, buyer: fan.publicKey, eurMicro: 0.5 * EUR, authority }),
    (e) => e instanceof PurchaseError && /minimum is €1/.test(e.message),
  );
});

test("geld terug binnen 14 dagen: pass verbrand en bedrag terug, in één transactie", { skip }, async () => {
  const bob = people.bob;
  const number = start.pass + 1;
  const kasBefore = await eur(new PublicKey(deployment.kas));
  const res = await buildRefund({ connection, deployment, cfg, productId: "pass", number, buyer: bob.publicKey, authority });
  assert.equal(res.amountMicro, 99 * EUR);
  await send(bob, res);
  assert.equal(await eur(paymentOf(bob.publicKey)), 1000 * EUR, "Bob kreeg alles terug");
  assert.equal(await eur(new PublicKey(deployment.kas)), kasBefore - 99 * EUR);
  const status = await passStatus(connection, authority, cfg, "pass", number);
  assert.equal(status.geldig, false);

  await assert.rejects(buildRefund({ connection, deployment, cfg, productId: "pass", number, buyer: bob.publicKey, authority }), /al teruggegeven/);
  await assert.rejects(
    buildRefund({ connection, deployment, cfg, productId: "pass", number: start.pass + 2, buyer: people.alice.publicKey, authority }),
    /staat niet in deze wallet/,
  );
  await assert.rejects(
    buildRefund({ connection, deployment, cfg, productId: "pass", number: start.pass + 2, buyer: people.carol.publicKey, authority, now: new Date(Date.now() + 15 * DAY_MS) }),
    /bedenktijd van 14 dagen liep af/,
  );
});

function signMessage(kp, message) {
  const key = createPrivateKey({
    key: { kty: "OKP", crv: "Ed25519", d: Buffer.from(kp.secretKey.subarray(0, 32)).toString("base64url"), x: Buffer.from(kp.publicKey.toBytes()).toString("base64url") },
    format: "jwk",
  });
  return new Uint8Array(sign(null, Buffer.from(message, "utf8"), key));
}

test("activeren met een gratis handtekening geeft een code die Marketing Scan kan nakijken", { skip }, async () => {
  const alice = people.alice;
  const wallet = alice.publicKey.toBase58();
  const now = new Date();
  const message = activationMessage(pass, start.pass, wallet, now.toISOString());
  const res = await activate({ connection, authority, cfg, productId: "pass", number: start.pass, wallet, message, signature: signMessage(alice, message), env: {} });
  assert.match(res.code, /^MSGEN-\d{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.deepEqual(readActivationCode(authority, cfg, res.code, {}), { productId: "pass", number: start.pass });
  assert.equal(readActivationCode(authority, cfg, res.code.replace(/.$/, (c) => (c === "A" ? "B" : "A")), {}), null, "een aangepaste code is ongeldig");

  await assert.rejects(activate({ connection, authority, cfg, productId: "pass", number: start.pass, wallet, message, signature: signMessage(people.bob, message), env: {} }), /handtekening klopt niet/);
  const old = activationMessage(pass, start.pass, wallet, new Date(Date.now() - 3600_000).toISOString());
  await assert.rejects(activate({ connection, authority, cfg, productId: "pass", number: start.pass, wallet, message: old, signature: signMessage(alice, old), env: {} }), /verlopen/);
  const bobs = activationMessage(pass, start.pass + 1, people.bob.publicKey.toBase58(), now.toISOString());
  await assert.rejects(
    activate({ connection, authority, cfg, productId: "pass", number: start.pass + 1, wallet: people.bob.publicKey.toBase58(), message: bobs, signature: signMessage(people.bob, bobs), env: {} }),
    /staat niet in deze wallet/,
    "een teruggegeven pass activeert niet meer",
  );
});

test("de geschiedenis op de keten klopt met de kas", { skip }, async () => {
  const sum = summarize(cfg, await fetchEvents(connection, deployment, cfg));
  assert.equal(sum.producten.pass.verkocht - eventsStart.producten.pass.verkocht, 5);
  assert.equal(sum.producten.pass.teruggegeven - eventsStart.producten.pass.teruggegeven, 1);
  assert.equal(sum.producten.agency.verkocht - eventsStart.producten.agency.verkocht, 1);
  assert.equal(sum.steun.totaalMicro - eventsStart.steun.totaalMicro, 3.5 * EUR);
  assert.equal(sum.verwachteKasMicro, await eur(new PublicKey(deployment.kas)), "kas = alles binnen - terug - opgenomen");
  const alice = sum.muur.find((m) => m.wallet === people.alice.publicKey.toBase58());
  assert.equal(alice.name, "@alice");
});

test("opnemen: aankopen binnen de bedenktijd blijven in de kas", { skip }, async () => {
  const events = await fetchEvents(connection, deployment, cfg);
  const kas = await eur(new PublicKey(deployment.kas));
  const now = withdrawable(cfg, events, kas);
  assert.ok(now.bufferMicro >= (99 + 149 + 149 + 149 + 799) * EUR, "de recente aankopen zitten in de buffer");
  assert.equal(now.bufferMicro + now.opneembaarMicro, kas);
  const later = withdrawable(cfg, events, kas, new Date(Date.now() + 15 * DAY_MS));
  assert.equal(later.opneembaarMicro, kas, "na de bedenktijd mag alles eruit");

  if (now.opneembaarMicro > 0) {
    const founderBefore = await eur(new PublicKey(deployment.founderPaymentAccount));
    const { transaction } = await buildWithdrawal({ connection, deployment, cfg, authority, amountMicro: now.opneembaarMicro });
    await sendAndConfirmTransaction(connection, transaction, [authority], { commitment: "confirmed" });
    assert.equal(await eur(new PublicKey(deployment.founderPaymentAccount)), founderBefore + now.opneembaarMicro);
    const sum = summarize(cfg, await fetchEvents(connection, deployment, cfg));
    assert.equal(sum.verwachteKasMicro, await eur(new PublicKey(deployment.kas)));
  }
});

test("testgeld: maximaal tot 1.000 tEUR saldo", { skip }, async () => {
  const fresh = Keypair.generate();
  await sendTestEuro({ connection, deployment, cfg, authority, recipient: fresh.publicKey });
  await assert.rejects(sendTestEuro({ connection, deployment, cfg, authority, recipient: fresh.publicKey }), (e) => e instanceof FaucetError);
});

test("een gewijzigde transactie wordt geweigerd", { skip }, async () => {
  const mallory = await funded("mallory");
  const res = await buyPass(mallory);
  const tx = Transaction.from(Buffer.from(res.transaction, "base64"));
  // Mallory probeert minder te betalen: de handtekening van de server klopt dan niet meer.
  const payment = tx.instructions.find((ix) => ix.programId.equals(new PublicKey(deployment.paymentProgram)) && ix.data[0] === 12);
  payment.data = Buffer.from(payment.data);
  payment.data.writeBigUInt64LE(1n, 1);
  tx.partialSign(mallory);
  assert.throws(() => tx.serialize());
});
