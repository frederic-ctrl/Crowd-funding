import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EUR, parseEuro, quote, percentOfCompany, valuationMicro, roundIsOpen, checkPurchase, findRound } from "../shared/offering.js";

const offering = JSON.parse(readFileSync(new URL("../shared/aanbod.json", import.meta.url), "utf8"));
const r1 = findRound(offering, "ronde-1");
const r2 = findRound(offering, "ronde-2");
const open = new Date("2026-11-01T12:00:00Z");

test("de allocaties tellen op tot 100% en de rondes kloppen met de allocaties", () => {
  const a = offering.allocaties;
  assert.equal(a.oprichter + a["ronde-1"] + a["ronde-2"], offering.token.totaal);
  assert.equal(r1.tokens, a["ronde-1"]);
  assert.equal(r2.tokens, a["ronde-2"]);
});

test("ronde 1: 9% voor €45.000, ronde 2: 40% voor €500.000", () => {
  assert.equal(percentOfCompany(r1.tokens, offering.token.totaal), 9);
  assert.equal((r1.tokens * r1.prijsPerTokenMicro) / EUR, 45_000);
  assert.equal(percentOfCompany(r2.tokens, offering.token.totaal), 40);
  assert.equal((r2.tokens * r2.prijsPerTokenMicro) / EUR, 500_000);
  assert.equal(valuationMicro(r1.prijsPerTokenMicro, offering.token.totaal) / EUR, 500_000);
  assert.equal(valuationMicro(r2.prijsPerTokenMicro, offering.token.totaal) / EUR, 1_250_000);
});

test("bedragen inlezen, ook met komma en duizendtalpunt", () => {
  assert.equal(parseEuro("1"), EUR);
  assert.equal(parseEuro("2,50"), 2.5 * EUR);
  assert.equal(parseEuro("1.000"), 1000 * EUR);
  assert.equal(parseEuro("1.234,56"), 1234.56 * EUR);
  assert.equal(parseEuro("0,999"), EUR);
  assert.equal(parseEuro(1.5), 1.5 * EUR);
  assert.ok(Number.isNaN(parseEuro("abc")));
  assert.ok(Number.isNaN(parseEuro("")));
});

test("€1 geeft 200 aandelen in ronde 1 en 80 in ronde 2", () => {
  assert.deepEqual(quote(r1, EUR), { tokens: 200, cost: EUR, rest: 0 });
  assert.deepEqual(quote(r2, EUR), { tokens: 80, cost: EUR, rest: 0 });
  assert.deepEqual(quote(r1, parseEuro("1,01")), { tokens: 202, cost: 1.01 * EUR, rest: 0 });
});

test("ronde open of dicht", () => {
  assert.equal(roundIsOpen(r1, open), true);
  assert.equal(roundIsOpen(r1, new Date("2026-09-01T00:00:00Z")), false);
  assert.equal(roundIsOpen(r1, new Date("2027-02-01T00:00:00Z")), false);
  assert.equal(roundIsOpen(r2, open), false);
});

test("aankoopregels", () => {
  const base = { round: r1, heldTokens: 0, vaultRemaining: r1.tokens, now: open };
  assert.deepEqual(checkPurchase({ ...base, eurMicro: EUR, balanceMicro: 50 * EUR }), []);
  assert.match(checkPurchase({ ...base, eurMicro: 0.5 * EUR })[0], /minimum is €1/);
  assert.match(checkPurchase({ ...base, eurMicro: 5001 * EUR }).join(" "), /maximum is €5\.000 per persoon/);
  assert.match(checkPurchase({ ...base, heldTokens: 999_800, eurMicro: 2 * EUR }).join(" "), /nog €1,00 inleggen/);
  assert.match(checkPurchase({ ...base, vaultRemaining: 100, eurMicro: EUR }).join(" "), /nog maar 100 aandelen/);
  assert.match(checkPurchase({ ...base, eurMicro: 10 * EUR, balanceMicro: 5 * EUR }).join(" "), /niet genoeg saldo/);
  assert.match(checkPurchase({ ...base, round: r2, eurMicro: EUR })[0], /Ronde 2 is niet open/);
});
