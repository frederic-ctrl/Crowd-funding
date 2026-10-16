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
import { coinsOf, coinById, toCoinMicro, toEurMicro, formatCoin } from "../shared/munten.js";

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
  assert.deepEqual(parseMemo(cfg, m), { kind: "aankoop", productId: "pass", number: 42, name: "@jan", eurMicro: null });
  assert.deepEqual(parseMemo(cfg, memoFor({ kind: "aankoop", product: agency, number: 3 })), { kind: "aankoop", productId: "agency", number: 3, name: "", eurMicro: null });
  assert.deepEqual(parseMemo(cfg, memoFor({ kind: "steun", name: "Fan" })), { kind: "steun", productId: "steun", number: null, name: "Fan", eurMicro: null });
  assert.deepEqual(parseMemo(cfg, memoFor({ kind: "terugbetaling", product: pass, number: 9 })), { kind: "terugbetaling", productId: "pass", number: 9, name: "", eurMicro: null });
  assert.equal(parseMemo(cfg, memoFor({ kind: "opname" })).kind, "opname");
  assert.equal(parseMemo(cfg, "[38] Marketing Scan Genesis Pass #001").number, 1, "memo uit getSignaturesForAddress");
  assert.equal(parseMemo(cfg, "iets anders"), null);
  assert.equal(parseMemo(cfg, "Marketing Scan Genesis Pass"), null, "een aankoop zonder nummer telt niet");
});

test("memo's met de waarde in euro (ook bij betalen in USDC)", () => {
  const m = memoFor({ kind: "aankoop", product: pass, number: 42, name: "An", eurMicro: 99 * EUR });
  assert.equal(m, "Marketing Scan Genesis Pass #042 (EUR 99.00) | An");
  assert.deepEqual(parseMemo(cfg, m), { kind: "aankoop", productId: "pass", number: 42, name: "An", eurMicro: 99 * EUR });
  assert.equal(memoFor({ kind: "steun", eurMicro: 12.5 * EUR }), "Marketing Scan Supporter (EUR 12.50)");
  assert.equal(parseMemo(cfg, "Marketing Scan Supporter (EUR 12.50)").eurMicro, 12.5 * EUR);
  assert.equal(parseMemo(cfg, "Marketing Scan opname (EUR 1234.56)").eurMicro, 1234.56 * EUR);
  assert.equal(parseMemo(cfg, "Marketing Scan terugbetaling Genesis Agency #03 (EUR 799.00)").number, 3);
});

test("betaalmunten: EURC en USDC, op het testnet tEUR en tUSD", () => {
  const munten = { eurc: { mint: "E", program: "P", kas: "KE", founderAccount: "FE" }, usdc: { mint: "U", program: "P", kas: "KU", founderAccount: "FU" } };
  assert.deepEqual(coinsOf({ network: "devnet", munten }, cfg).map((c) => c.symbool), ["tEUR", "tUSD"]);
  assert.deepEqual(coinsOf({ network: "mainnet-beta", munten }, cfg).map((c) => c.symbool), ["EURC", "USDC"]);
  assert.deepEqual(coinsOf({ network: "devnet", munten: { eurc: munten.eurc } }, cfg).map((c) => c.id), ["eurc"], "enkel munten die in de deployment staan");
  assert.equal(coinById({ network: "devnet", munten }, cfg, "usdc").kas, "KU");
  assert.equal(coinById({ network: "devnet", munten }, cfg, "btc"), null);
});

test("omrekenen naar USDC: ECB-koers, naar boven afgerond op een cent", () => {
  const usdc = { valuta: "USD", decimalen: 6, symbool: "USDC" };
  const eurc = { valuta: "EUR", decimalen: 6, symbool: "EURC" };
  assert.equal(toCoinMicro(99 * EUR, eurc, null), 99 * EUR);
  assert.equal(toCoinMicro(99 * EUR, usdc, 1.1208), 110_960_000, "99 x 1,1208 = 110,9592: wordt 110,96");
  assert.equal(toCoinMicro(100 * EUR, usdc, 1.1), 110 * EUR, "geen afronding als het exact is");
  assert.equal(toCoinMicro(1 * EUR, usdc, 1.08001), 1_090_000);
  assert.equal(toCoinMicro(99 * EUR, usdc, null), null, "zonder koers geen prijs in USDC");
  assert.equal(toEurMicro(110_960_000, usdc, 1.1208), 99 * EUR);
  assert.equal(toEurMicro(5 * EUR, eurc, null), 5 * EUR);
  assert.equal(formatCoin(110_960_000, usdc), "110.96 USDC");
  const base = { cfg, product: pass, held: 0, network: "devnet", nextNumber: 1 };
  assert.match(checkPassPurchase({ ...base, balanceMicro: 100 * EUR, coinPriceMicro: 110_960_000, coinLabel: "110.96 USDC" })[0], /kost 110\.96 USDC/);
  assert.deepEqual(checkPassPurchase({ ...base, balanceMicro: 111 * EUR, coinPriceMicro: 110_960_000, coinLabel: "110.96 USDC" }), []);
  assert.match(checkSupport({ cfg, network: "devnet", eurMicro: 5 * EUR, coinMicro: 5_610_000, balanceMicro: 5 * EUR })[0], /niet genoeg saldo/);
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
const dep = {
  network: "devnet",
  authority: "AUTH",
  founderWallet: "FOUNDER",
  supporterMint: "BADGE",
  munten: { eurc: { mint: "TEUR", program: "P", kas: "KAS", founderAccount: "FA" }, usdc: { mint: "TUSD", program: "P", kas: "KASU", founderAccount: "FAU" } },
};
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
  assert.equal(sum.perMunt.eurc.verwachteKasMicro, 99 * EUR);
  assert.equal(sum.perMunt.usdc.verwachteKasMicro, 0);
  assert.equal(a.munt, "eurc");
  assert.equal(a.eurMicro, 99 * EUR, "zonder bedrag in de memo is de waarde in euro gelijk aan het bedrag in EURC");
  assert.deepEqual(sum.muur.map((m) => [m.wallet, m.teruggegeven]), [["CAROL", false], ["BOB", false], ["ALICE", true]]);
});

test("geschiedenis: betalen en terugbetalen in USDC, totalen in euro", () => {
  const usd = 110_960_000;
  const buy = parseGenesisTx(
    tx({
      slot: 20,
      memo: memoFor({ kind: "aankoop", product: pass, number: 3, eurMicro: 99 * EUR }),
      pre: [bal(1, "TUSD", "DAN", 500 * EUR), bal(2, "TUSD", "AUTH", 0)],
      post: [bal(1, "TUSD", "DAN", 500 * EUR - usd), bal(2, "TUSD", "AUTH", usd), bal(3, "PASS3", "DAN", 1)],
    }),
    dep, cfg, "u1", 200,
  );
  assert.deepEqual([buy.kind, buy.munt, buy.amountMicro, buy.eurMicro, buy.wallet], ["aankoop", "usdc", usd, 99 * EUR, "DAN"]);
  const eurBuy = parseGenesisTx(buyPass(4, "EVA", 99, 21), dep, cfg, "u2", 201);
  const refund = parseGenesisTx(
    tx({
      slot: 22,
      memo: memoFor({ kind: "terugbetaling", product: pass, number: 3, eurMicro: 99 * EUR }),
      pre: [bal(1, "TUSD", "DAN", 500 * EUR - usd), bal(2, "TUSD", "AUTH", usd), bal(3, "PASS3", "DAN", 1)],
      post: [bal(1, "TUSD", "DAN", 500 * EUR), bal(2, "TUSD", "AUTH", 0)],
    }),
    dep, cfg, "u3", 202,
  );
  assert.deepEqual([refund.kind, refund.munt, refund.amountMicro, refund.eurMicro], ["terugbetaling", "usdc", usd, 99 * EUR]);
  const sum = summarize(cfg, [buy, eurBuy, refund]);
  assert.equal(sum.opgehaaldMicro, 99 * EUR);
  assert.equal(sum.terugbetaaldMicro, 99 * EUR);
  assert.deepEqual(sum.perMunt.usdc, { binnenMicro: usd, terugbetaaldMicro: usd, opgenomenMicro: 0, verwachteKasMicro: 0 });
  assert.equal(sum.perMunt.eurc.verwachteKasMicro, 99 * EUR);

  const noEur = tx({
    memo: memoFor({ kind: "aankoop", product: pass, number: 5 }),
    pre: [bal(1, "TUSD", "DAN", 500 * EUR), bal(2, "TUSD", "AUTH", 0)],
    post: [bal(1, "TUSD", "DAN", 500 * EUR - usd), bal(2, "TUSD", "AUTH", usd), bal(3, "PASS5", "DAN", 1)],
  });
  assert.equal(parseGenesisTx(noEur, dep, cfg, "u4"), null, "USDC zonder waarde in euro telt niet");
  const twoKas = tx({
    memo: memoFor({ kind: "aankoop", product: pass, number: 6, eurMicro: 99 * EUR }),
    pre: [bal(1, "TUSD", "DAN", 500 * EUR), bal(2, "TUSD", "AUTH", 0), bal(4, "TEUR", "AUTH", 0), bal(5, "TEUR", "DAN", 99 * EUR)],
    post: [bal(1, "TUSD", "DAN", 500 * EUR - usd), bal(2, "TUSD", "AUTH", usd), bal(4, "TEUR", "AUTH", 99 * EUR), bal(5, "TEUR", "DAN", 0), bal(3, "PASS6", "DAN", 1)],
  });
  assert.equal(parseGenesisTx(twoKas, dep, cfg, "u5"), null, "per transactie beweegt precies één kas");
});

test("geschiedenis: enkel transacties van de serversleutel tellen", () => {
  assert.equal(parseGenesisTx({ ...buyPass(1, "EVE", 99), transaction: { message: { accountKeys: [{ pubkey: "EVE", signer: true }], instructions: buyPass(1, "EVE", 99).transaction.message.instructions } } }, dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(tx({ memo: "Marketing Scan Genesis Pass #001", payer: "AUTH", signer: false }), dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(tx({ memo: "Marketing Scan Genesis Pass #001", err: { InstructionError: [] } }), dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(tx({ memo: "hallo" }), dep, cfg, "x"), null);
  assert.equal(parseGenesisTx(null, dep, cfg, "x"), null);
});

test("meldingen in het Engels als de site Engels is", () => {
  const base = { cfg, product: pass, held: 0, network: "devnet", lang: "en" };
  assert.match(checkPassPurchase({ ...base, nextNumber: 51, balanceMicro: 100 * EUR })[0], /Not enough balance: the Genesis Pass costs €149\.00/);
  assert.match(checkPassPurchase({ ...base, product: agency, nextNumber: 1, held: 1 })[0], /one per wallet/);
  assert.match(checkPassPurchase({ ...base, network: "mainnet-beta", nextNumber: 1 })[0], /isn’t open yet/);
  assert.match(checkSupport({ cfg, network: "devnet", balanceMicro: 50 * EUR, eurMicro: parseEuro("0.50"), lang: "en" })[0], /The minimum is €1/);
  assert.match(cleanName("x".repeat(25), "en").fout, /at most 24 characters/);
  assert.match(cleanName("x".repeat(25)).fout, /maximaal 24 tekens/, "zonder taal blijft het Nederlands");
});
