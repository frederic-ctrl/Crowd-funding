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
import { sendTestCoin, FaucetError } from "../server/faucet.js";
import { EUR, findProduct, activationMessage, DAY_MS } from "../shared/genesis.js";
import { fetchEvents, summarize } from "../shared/history.js";
import { coinById, toCoinMicro } from "../shared/munten.js";

const deploymentPath = process.env.SOLANA_E2E_DEPLOYMENT;
const authorityPath = process.env.SOLANA_E2E_AUTHORITY;
const skip = !deploymentPath || !authorityPath ? "SOLANA_E2E_DEPLOYMENT en SOLANA_E2E_AUTHORITY niet gezet" : false;

let deployment, cfg, connection, authority, pass, agency, start, kasStart, eventsStart, eurc, usdc;
const people = {};
const RATE = 1.1208; // vaste koers euro-dollar voor de test

before(async () => {
  if (skip) return;
  deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  cfg = JSON.parse(readFileSync(new URL("../shared/genesis.json", import.meta.url), "utf8"));
  connection = new Connection(deployment.rpc, "confirmed");
  authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(authorityPath, "utf8"))));
  pass = findProduct(cfg, "pass");
  agency = findProduct(cfg, "agency");
  eurc = coinById(deployment, cfg, "eurc");
  usdc = coinById(deployment, cfg, "usdc");
  start = { pass: (await nextFreeNumber(connection, authority, pass)).next, agency: (await nextFreeNumber(connection, authority, agency)).next };
  kasStart = { eurc: await eur(new PublicKey(eurc.kas), eurc), usdc: await eur(new PublicKey(usdc.kas), usdc) };
  eventsStart = summarize(cfg, await fetchEvents(connection, deployment, cfg));
  // Een kleinere prijsladder voor de test: de volgende 2 nummers aan €99, daarna €149.
  cfg = { ...cfg, producten: cfg.producten.map((p) => (p.id === "pass" ? { ...p, prijsladder: [{ tot: start.pass + 1, prijsEur: 99 }, { tot: p.max, prijsEur: 149 }] } : p)) };
  pass = findProduct(cfg, "pass");
});

/** Saldo van een token-account van een betaalmunt (standaard tEUR). */
async function eur(account, coin = eurc) {
  try {
    return Number((await getAccount(connection, account, "confirmed", new PublicKey(coin.program))).amount);
  } catch {
    return 0;
  }
}
const paymentOf = (owner, coin = eurc) => getAssociatedTokenAddressSync(new PublicKey(coin.mint), owner, false, new PublicKey(coin.program));

async function send(signer, prepared) {
  const tx = Transaction.from(Buffer.from(prepared.transaction, "base64"));
  tx.partialSign(signer); // zoals de wallet van de koper doet
  const signature = await connection.sendRawTransaction(tx.serialize());
  const bh = await connection.getLatestBlockhash();
  const res = await connection.confirmTransaction({ signature, ...bh }, "confirmed");
  if (res.value.err) throw new Error(`transactie mislukt: ${JSON.stringify(res.value.err)}`);
  return signature;
}

async function funded(name, munt = "eurc") {
  const kp = Keypair.generate(); // heeft geen SOL: de server betaalt de kosten
  await sendTestCoin({ connection, deployment, cfg, authority, recipient: kp.publicKey, munt });
  people[name] = kp;
  return kp;
}

const buyPass = (kp, productId = "pass", name = "", munt = "eurc") =>
  buildPassPurchase({ connection, deployment, cfg, productId, buyer: kp.publicKey, authority, name, munt, eurUsd: munt === "usdc" ? RATE : null });

test("setup: supporter-badge is niet overdraagbaar, elke kas is van de server", { skip }, async () => {
  const badge = await getMint(connection, new PublicKey(deployment.supporterMint), "confirmed", TOKEN_2022_PROGRAM_ID);
  assert.ok(getNonTransferable(badge), "badge is soulbound");
  assert.equal(badge.decimals, 0);
  assert.equal(badge.freezeAuthority, null, "niemand kan badges bevriezen");
  for (const coin of [eurc, usdc]) {
    const kas = await getAccount(connection, new PublicKey(coin.kas), "confirmed", new PublicKey(coin.program));
    assert.equal(kas.owner.toBase58(), deployment.authority);
    assert.equal(kas.mint.toBase58(), coin.mint);
  }
  assert.deepEqual([eurc.symbool, usdc.symbool], ["tEUR", "tUSD"]);
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
  assert.equal(await eur(new PublicKey(eurc.kas)), kasStart.eurc + 99 * EUR);
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
  const kasBefore = await eur(new PublicKey(eurc.kas));
  const res = await buildRefund({ connection, deployment, cfg, productId: "pass", number, buyer: bob.publicKey, authority });
  assert.equal(res.amountMicro, 99 * EUR);
  assert.equal(res.munt, "eurc");
  await send(bob, res);
  assert.equal(await eur(paymentOf(bob.publicKey)), 1000 * EUR, "Bob kreeg alles terug");
  assert.equal(await eur(new PublicKey(eurc.kas)), kasBefore - 99 * EUR);
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

test("betalen in USDC: europrijs aan de koers van de dag, geld terug in USDC", { skip }, async () => {
  const frank = await funded("frank", "usdc");
  const res = await buyPass(frank, "pass", "Frank", "usdc");
  const expected = toCoinMicro(149 * EUR, usdc, RATE);
  assert.equal(res.priceMicro, 149 * EUR, "de prijs blijft in euro");
  assert.equal(res.amountMicro, expected);
  assert.equal(expected, 167 * EUR, "149 x 1,1208 = 166,9992: wordt 167,00 tUSD");
  assert.equal(res.symbool, "tUSD");
  await send(frank, res);
  assert.equal(await eur(paymentOf(frank.publicKey, usdc), usdc), 1000 * EUR - expected);
  assert.equal(await eur(new PublicKey(usdc.kas), usdc), kasStart.usdc + expected);
  assert.equal(await eur(paymentOf(frank.publicKey)), 0, "geen tEUR gebruikt");

  const broke = await funded("broke", "usdc");
  await sendTestCoin({ connection, deployment, cfg, authority, recipient: broke.publicKey, munt: "eurc" });
  const rich = { ...cfg, producten: cfg.producten.map((p) => (p.id === "agency" ? { ...p, prijsladder: [{ tot: p.max, prijsEur: 900 }] } : p)) };
  await assert.rejects(
    buildPassPurchase({ connection, deployment, cfg: rich, productId: "agency", buyer: broke.publicKey, authority, munt: "usdc", eurUsd: RATE }),
    (e) => e instanceof PurchaseError && /kost 1008\.72 tUSD/.test(e.message),
    "900 euro is 1.008,72 tUSD: meer dan de 1.000 tUSD in de wallet",
  );
  await assert.rejects(
    buildPassPurchase({ connection, deployment, cfg, productId: "pass", buyer: broke.publicKey, authority, munt: "usdc", eurUsd: null }),
    (e) => e instanceof PurchaseError && /wisselkoers/.test(e.message),
  );
  await assert.rejects(buyPass(broke, "pass", "", "btc"), (e) => e instanceof PurchaseError && /betaalmunt/.test(e.message));

  const steun = await buildSupport({ connection, deployment, cfg, buyer: frank.publicKey, eurMicro: 2 * EUR, authority, munt: "usdc", eurUsd: RATE });
  assert.equal(steun.amountMicro, 2_250_000, "2 x 1,1208 = 2,2416: wordt 2,25 tUSD");
  assert.equal(steun.eurMicro, 2 * EUR);
  await send(frank, steun);

  const refund = await buildRefund({ connection, deployment, cfg, productId: "pass", number: res.number, buyer: frank.publicKey, authority });
  assert.equal(refund.munt, "usdc");
  assert.equal(refund.amountMicro, expected, "exact hetzelfde bedrag terug, in dezelfde munt");
  assert.equal(refund.eurMicro, 149 * EUR);
  await send(frank, refund);
  assert.equal(await eur(paymentOf(frank.publicKey, usdc), usdc), 1000 * EUR - 2_250_000);
  assert.equal(await eur(new PublicKey(usdc.kas), usdc), kasStart.usdc + 2_250_000);
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

test("de geschiedenis op de keten klopt met elke kas", { skip }, async () => {
  const events = await fetchEvents(connection, deployment, cfg);
  const sum = summarize(cfg, events);
  assert.equal(sum.producten.pass.verkocht - eventsStart.producten.pass.verkocht, 6);
  assert.equal(sum.producten.pass.teruggegeven - eventsStart.producten.pass.teruggegeven, 2);
  assert.equal(sum.producten.agency.verkocht - eventsStart.producten.agency.verkocht, 1);
  assert.equal(sum.steun.totaalMicro - eventsStart.steun.totaalMicro, 5.5 * EUR, "steun in euro, ook wat in tUSD betaald werd");
  assert.equal(sum.opgehaaldMicro - eventsStart.opgehaaldMicro, (99 + 149 + 149 + 149 + 799 + 5.5) * EUR);
  for (const coin of [eurc, usdc]) {
    assert.equal(sum.perMunt[coin.id].verwachteKasMicro, await eur(new PublicKey(coin.kas), coin), `kas ${coin.symbool} = alles binnen - terug - opgenomen`);
  }
  const alice = sum.muur.find((m) => m.wallet === people.alice.publicKey.toBase58());
  assert.equal(alice.name, "@alice");
  const frank = events.filter((e) => e.wallet === people.frank.publicKey.toBase58());
  assert.deepEqual(frank.map((e) => [e.kind, e.munt]), [["aankoop", "usdc"], ["steun", "usdc"], ["terugbetaling", "usdc"]]);
});

test("opnemen: aankopen binnen de bedenktijd blijven in hun kas", { skip }, async () => {
  const events = await fetchEvents(connection, deployment, cfg);
  const kas = await eur(new PublicKey(eurc.kas));
  const now = withdrawable(cfg, events, "eurc", kas);
  assert.ok(now.bufferMicro >= (99 + 149 + 149 + 149 + 799) * EUR, "de recente aankopen zitten in de buffer");
  assert.equal(now.bufferMicro + now.opneembaarMicro, kas);
  const later = withdrawable(cfg, events, "eurc", kas, new Date(Date.now() + 15 * DAY_MS));
  assert.equal(later.opneembaarMicro, kas, "na de bedenktijd mag alles eruit");

  for (const coin of [eurc, usdc]) {
    const inKas = await eur(new PublicKey(coin.kas), coin);
    const { opneembaarMicro } = withdrawable(cfg, events, coin.id, inKas);
    if (opneembaarMicro === 0) continue;
    const founderBefore = await eur(new PublicKey(coin.founderAccount), coin);
    const { transaction } = await buildWithdrawal({ connection, deployment, cfg, authority, munt: coin.id, amountMicro: opneembaarMicro, eurUsd: RATE });
    await sendAndConfirmTransaction(connection, transaction, [authority], { commitment: "confirmed" });
    assert.equal(await eur(new PublicKey(coin.founderAccount), coin), founderBefore + opneembaarMicro);
  }
  const sum = summarize(cfg, await fetchEvents(connection, deployment, cfg));
  for (const coin of [eurc, usdc]) assert.equal(sum.perMunt[coin.id].verwachteKasMicro, await eur(new PublicKey(coin.kas), coin));
  await assert.rejects(buildWithdrawal({ connection, deployment, cfg, authority, munt: "usdc", amountMicro: 1, eurUsd: null }), /wisselkoers/);
});

test("testgeld: maximaal tot 1.000 tEUR of tUSD saldo", { skip }, async () => {
  for (const munt of ["eurc", "usdc"]) {
    const fresh = Keypair.generate();
    const res = await sendTestCoin({ connection, deployment, cfg, authority, recipient: fresh.publicKey, munt });
    assert.equal(res.symbool, munt === "eurc" ? "tEUR" : "tUSD");
    await assert.rejects(sendTestCoin({ connection, deployment, cfg, authority, recipient: fresh.publicKey, munt }), (e) => e instanceof FaucetError);
  }
});

test("een gewijzigde transactie wordt geweigerd", { skip }, async () => {
  const mallory = await funded("mallory");
  const res = await buyPass(mallory);
  const tx = Transaction.from(Buffer.from(res.transaction, "base64"));
  // Mallory probeert minder te betalen: de handtekening van de server klopt dan niet meer.
  const payment = tx.instructions.find((ix) => ix.programId.equals(new PublicKey(eurc.program)) && ix.data[0] === 12);
  payment.data = Buffer.from(payment.data);
  payment.data.writeBigUInt64LE(1n, 1);
  tx.partialSign(mallory);
  assert.throws(() => tx.serialize());
});
