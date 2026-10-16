import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EUR,
  parseEuro,
  findProduct,
  priceForNumber,
  formatNumber,
  passName,
  maxRevenueMicro,
  ladderState,
  cleanName,
  memoFor,
  parseMemo,
  saleIsOpen,
  checkPassPurchase,
  checkSupport,
  refundDeadline,
} from "../shared/genesis.js";
import { parseGenesisTx, summarize } from "../shared/history.js";

const cfg = JSON.parse(readFileSync(new URL("../shared/genesis.json", import.meta.url), "utf8"));
const pass = findProduct(cfg, "pass");
const agency = findProduct(cfg, "agency");

test("de volledige pass-reeks brengt bijna €50.000 op, het doel", () => {
  assert.equal(maxRevenueMicro(pass) / EUR, 49_750);
  assert.equal(maxRevenueMicro(agency) / EUR, 19_975);
  assert.equal(cfg.doelEur, 50_000);
  assert.equal(pass.prijsladder.at(-1).tot, pass.max);
  assert.equal(agency.prijsladder.at(-1).tot, agency.max);
});

test("de prijs hangt af van je nummer: vroeger is goedkoper", () => {
  assert.equal(priceForNumber(pass, 1), 99 * EUR);
  assert.equal(priceForNumber(pass, 50), 99 * EUR);
  assert.equal(priceForNumber(pass, 51), 149 * EUR);
  assert.equal(priceForNumber(pass, 250), 299 * EUR);
  assert.equal(priceForNumber(pass, 251), null);
  assert.equal(priceForNumber(pass, 0), null);
  assert.equal(priceForNumber(agency, 25), 799 * EUR);
});

test("nummers en namen", () => {
  assert.equal(formatNumber(pass, 42), "#042");
  assert.equal(formatNumber(agency, 7), "#07");
  assert.equal(passName(pass, 1), "Marketing Scan Genesis #001");
  assert.equal(passName(agency, 25), "Marketing Scan Genesis Agency #25");
});

test("prijsladder toont wat verkocht is en welke trede nu geldt", () => {
  const l = ladderState(pass, 60);
  assert.deepEqual(l.map((t) => t.status), ["uitverkocht", "nu", "later", "later", "later"]);
  assert.equal(l[1].verkocht, 10);
  assert.equal(l[1].beschikbaar, 40);
  assert.equal(ladderState(pass, 0)[0].status, "nu");
  assert.equal(ladderState(pass, 250).every((t) => t.status === "uitverkocht"), true);
});

test("publieke naam: optioneel, kort, zonder vreemde tekens", () => {
  assert.deepEqual(cleanName("  @jan_dev  "), { naam: "@jan_dev" });
  assert.deepEqual(cleanName(""), { naam: "" });
  assert.deepEqual(cleanName("Zoë's Bakkerij"), { naam: "Zoë's Bakkerij" });
  assert.ok(cleanName("x".repeat(25)).fout);
  assert.ok(cleanName("<script>").fout);
  assert.ok(cleanName("a | b").fout, "het scheidingsteken van de memo mag niet in een naam");
});

test("memo's gaan heen en terug", () => {
  const m = memoFor({ kind: "aankoop", product: pass, number: 42, name: "@jan" });
  assert.equal(m, "Marketing Scan Genesis Pass #042 | @jan");
  assert.deepEqual(parseMemo(cfg, m), { kind: "aankoop", productId: "pass", number: 42, name: "@jan" });
  assert.deepEqual(parseMemo(cfg, memoFor({ kind: "aankoop", product: agency, number: 3 })), { kind: "aankoop", productId: "agency", number: 3, name: "" });
  assert.deepEqual(parseMemo(cfg, memoFor({ kind: "steun", name: "Fan" })), { kind: "steun", productId: "steun", number: null, name: "Fan" });
  assert.deepEqual(parseMemo(cfg, memoFor({ kind: "terugbetaling", product: pass, number: 9 })), { kind: "terugbetaling", productId: "pass", number: 9, name: "" });
  assert.equal(parseMemo(cfg, memoFor({ kind: "opname" })).kind, "opname");
  assert.equal(parseMemo(cfg, "[38] Marketing Scan Genesis Pass #001").number, 1, "memo uit getSignaturesForAddress");
  assert.equal(parseMemo(cfg, "iets anders"), null);
  assert.equal(parseMemo(cfg, "Marketing Scan Genesis Pass"), null, "een aankoop zonder nummer telt niet");
});

test("verkoop: op het testnet altijd open, op mainnet enkel met verkoopActief", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  assert.equal(saleIsOpen(cfg, "devnet", now), true);
  assert.equal(saleIsOpen(cfg, "mainnet-beta", now), false);
  assert.equal(saleIsOpen({ ...cfg, verkoopActief: true }, "mainnet-beta", now), true);
  assert.equal(saleIsOpen({ ...cfg, verkoopActief: true, opent: "2026-12-01T00:00:00Z" }, "mainnet-beta", now), false);
  assert.equal(saleIsOpen({ ...cfg, sluit: "2026-10-01T00:00:00Z" }, "devnet", now), false);
});

test("aankoop van een pass: uitverkocht, maximum per wallet en saldo", () => {
  const base = { cfg, product: pass, held: 0, network: "devnet" };
  assert.deepEqual(checkPassPurchase({ ...base, nextNumber: 1, balanceMicro: 99 * EUR }), []);
  assert.match(checkPassPurchase({ ...base, nextNumber: null })[0], /uitverkocht/);
  assert.match(checkPassPurchase({ ...base, nextNumber: 251 })[0], /uitverkocht/);
  assert.match(checkPassPurchase({ ...base, nextNumber: 1, held: 3 })[0], /maximum is 3 per wallet/);
  assert.match(checkPassPurchase({ ...base, product: agency, nextNumber: 1, held: 1 })[0], /één per wallet/);
  assert.match(checkPassPurchase({ ...base, nextNumber: 51, balanceMicro: 100 * EUR })[0], /kost € 149,00/);
  assert.match(checkPassPurchase({ ...base, network: "mainnet-beta", nextNumber: 1 })[0], /nog niet open/);
});

test("steun vanaf €1", () => {
  const base = { cfg, network: "devnet", balanceMicro: 50 * EUR };
  assert.deepEqual(checkSupport({ ...base, eurMicro: parseEuro("1") }), []);
  assert.match(checkSupport({ ...base, eurMicro: parseEuro("0,50") })[0], /minimum is €1/);
  assert.match(checkSupport({ ...base, eurMicro: parseEuro("1.001"), balanceMicro: 2000 * EUR })[0], /maximum is €1\.000/);
  assert.match(checkSupport({ ...base, eurMicro: parseEuro("60") })[0], /niet genoeg saldo/);
  assert.match(checkSupport({ ...base, eurMicro: NaN })[0], /Vul een bedrag in/);
});

test("bedenktijd van 14 dagen", () => {
  assert.equal(refundDeadline(cfg, 1_000) - 1_000_000, 14 * 86_400_000);
});

test("bedragen inlezen, ook met komma en duizendtalpunt", () => {
  assert.equal(parseEuro("1"), EUR);
  assert.equal(parseEuro("2,50"), 2.5 * EUR);
  assert.equal(parseEuro("1.000"), 1000 * EUR);
  assert.equal(parseEuro("€ 1.234,56"), 1234.56 * EUR);
  assert.equal(parseEuro("0,999"), EUR);
  assert.ok(Number.isNaN(parseEuro("abc")));
  assert.ok(Number.isNaN(parseEuro("-5")));
});

// Geschiedenis: nagebootste geparste transacties zoals getParsedTransactions ze teruggeeft.
const dep = { authority: "AUTH", founderWallet: "FOUNDER", paymentMint: "TEUR", supporterMint: "BADGE", kas: "KAS" };
const bal = (accountIndex, mint, owner, amount) => ({ accountIndex, mint, owner, uiTokenAmount: { amount: String(amount) } });
function tx({ memo, pre = [], post = [], payer = "AUTH", signer = true, err = null, slot = 1 }) {
  return {
    slot,
    meta: { err, preTokenBalances: pre, postTokenBalances: post },
    transaction: {
      message: {
        accountKeys: [{ pubkey: payer, signer }],
        instructions: memo ? [{ programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", parsed: memo }] : [],
      },
    },
  };
}
const buyPass = (n, owner, eur, slot) =>
  tx({
    slot,
    memo: memoFor({ kind: "aankoop", product: pass, number: n }),
    pre: [bal(1, "TEUR", owner, 1000 * EUR), bal(2, "TEUR", "AUTH", 0)],
    post: [bal(1, "TEUR", owner, 1000 * EUR - eur * EUR), bal(2, "TEUR", "AUTH", eur * EUR), bal(3, `PASS${n}`, owner, 1)],
  });

test("geschiedenis: aankoop, steun, terugbetaling en opname", () => {
  const a = parseGenesisTx(buyPass(1, "ALICE", 99, 10), dep, cfg, "s1", 100);
  assert.deepEqual(
    { kind: a.kind, productId: a.productId, number: a.number, wallet: a.wallet, mint: a.mint, amountMicro: a.amountMicro },
    { kind: "aankoop", productId: "pass", number: 1, wallet: "ALICE", mint: "PASS1", amountMicro: 99 * EUR },
  );

  const steun = parseGenesisTx(
    tx({ slot: 11, memo: "Marketing Scan Supporter | Bob", pre: [bal(1, "TEUR", "BOB", 10 * EUR), bal(2, "TEUR", "AUTH", 99 * EUR)], post: [bal(1, "TEUR", "BOB", 5 * EUR), bal(2, "TEUR", "AUTH", 104 * EUR), bal(3, "BADGE", "BOB", 1)] }),
    dep, cfg, "s2", 101,
  );
  assert.equal(steun.kind, "steun");
  assert.equal(steun.wallet, "BOB");
  assert.equal(steun.amountMicro, 5 * EUR);
  assert.equal(steun.name, "Bob");

  // De pass-account wordt gesloten: die staat dan enkel in preTokenBalances.
  const terug = parseGenesisTx(
    tx({ slot: 12, memo: memoFor({ kind: "terugbetaling", product: pass, number: 1 }), pre: [bal(1, "TEUR", "ALICE", 901 * EUR), bal(2, "TEUR", "AUTH", 104 * EUR), bal(3, "PASS1", "ALICE", 1)], post: [bal(1, "TEUR", "ALICE", 1000 * EUR), bal(2, "TEUR", "AUTH", 5 * EUR)] }),
    dep, cfg, "s3", 102,
  );
  assert.equal(terug.kind, "terugbetaling");
  assert.equal(terug.amountMicro, 99 * EUR);
  assert.equal(terug.mint, "PASS1");

  const opname = parseGenesisTx(
    tx({ slot: 13, memo: "Marketing Scan opname", pre: [bal(2, "TEUR", "AUTH", 5 * EUR), bal(4, "TEUR", "FOUNDER", 0)], post: [bal(2, "TEUR", "AUTH", 0), bal(4, "TEUR", "FOUNDER", 5 * EUR)] }),
    dep, cfg, "s4", 103,
  );
  assert.equal(opname.kind, "opname");
  assert.equal(opname.amountMicro, 5 * EUR);

  const b = parseGenesisTx(buyPass(2, "CAROL", 99, 14), dep, cfg, "s5", 104);
  const sum = summarize(cfg, [a, steun, terug, opname, b]);
  assert.equal(sum.producten.pass.verkocht, 2);
  assert.equal(sum.producten.pass.teruggegeven, 1);
  assert.equal(sum.producten.pass.hoogsteNummer, 2);
  assert.equal(sum.steun.totaalMicro, 5 * EUR);
  assert.equal(sum.opgehaaldMicro, (99 + 5 + 99 - 99) * EUR);
  assert.equal(sum.verwachteKasMicro, 99 * EUR);
  assert.deepEqual(sum.muur.map((m) => [m.wallet, m.teruggegeven]), [["CAROL", false], ["BOB", false], ["ALICE", true]]);
});

test("geschiedenis: enkel transacties van de serversleutel tellen", () => {
  assert.equal(parseGenesisTx({ ...buyPass(1, "EVE", 99), transaction: { message: { accountKeys: [{ pubkey: "EVE", signer: true }], instructions: buyPass(1, "EVE", 99).transaction.message.instructions } } }, dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(tx({ memo: "Marketing Scan Genesis Pass #001", payer: "AUTH", signer: false }), dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(tx({ memo: "Marketing Scan Genesis Pass #001", err: { InstructionError: [] } }), dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(tx({ memo: "hallo" }), dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(null, dep, cfg, "x"), null);
});
