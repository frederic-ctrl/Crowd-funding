import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eurUsd, resetRateCache, RateError } from "../server/koers.js";

beforeEach(() => resetRateCache());

const ecb = (rate, date = "2026-10-15") => async () => Response.json({ amount: 1, base: "EUR", date, rates: { USD: rate } });

test("koers van de ECB, 15 minuten bewaard", async () => {
  let calls = 0;
  const fetchImpl = async (...a) => {
    calls += 1;
    return ecb(1.1208)(...a);
  };
  assert.deepEqual(await eurUsd({ env: {}, fetchImpl, now: 0 }), { eurUsd: 1.1208, datum: "2026-10-15", bron: "ECB" });
  await eurUsd({ env: {}, fetchImpl, now: 10 * 60_000 });
  assert.equal(calls, 1);
  await eurUsd({ env: {}, fetchImpl, now: 16 * 60_000 });
  assert.equal(calls, 2);
});

test("vaste koers via EUR_USD_KOERS", async () => {
  assert.equal((await eurUsd({ env: { EUR_USD_KOERS: "1.1" }, fetchImpl: () => assert.fail("geen netwerk") })).eurUsd, 1.1);
});

test("onzin of geen antwoord: fout, tenzij er een koers van vandaag bewaard is", async () => {
  await assert.rejects(eurUsd({ env: {}, fetchImpl: ecb(42) }), RateError);
  await assert.rejects(eurUsd({ env: {}, fetchImpl: async () => new Response("", { status: 500 }) }), RateError);
  await eurUsd({ env: {}, fetchImpl: ecb(1.12), now: 0 });
  const down = async () => {
    throw new Error("offline");
  };
  assert.equal((await eurUsd({ env: {}, fetchImpl: down, now: 60 * 60_000 })).eurUsd, 1.12);
  await assert.rejects(eurUsd({ env: {}, fetchImpl: down, now: 25 * 3600_000 }), RateError);
});
