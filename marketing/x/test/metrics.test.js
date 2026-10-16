import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWaitlistCount } from "../src/metrics.js";

test("zonder Supabase-configuratie geen telling", async () => {
  assert.equal(await fetchWaitlistCount({}), null);
});

test("leest het totaal uit Content-Range", async () => {
  let seen;
  const fake = async (url, init) => {
    seen = { url, init };
    return new Response(null, { status: 206, headers: { "content-range": "0-0/1234" } });
  };
  const count = await fetchWaitlistCount({ SUPABASE_URL: "https://abc.supabase.co/", SUPABASE_SECRET_KEY: "sb_secret_x" }, fake);
  assert.equal(count, 1234);
  assert.equal(seen.url, "https://abc.supabase.co/rest/v1/waitlist?select=id&unsubscribed_at=is.null&limit=1");
  assert.equal(seen.init.headers.apikey, "sb_secret_x");
  assert.equal(seen.init.headers.authorization, undefined);
});

test("fout van Supabase wordt doorgegeven", async () => {
  const fake = async () => new Response("nee", { status: 401 });
  await assert.rejects(fetchWaitlistCount({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SECRET_KEY: "eyJx" }, fake), /401/);
});

import { applyGenesisState, fetchGenesisState } from "../src/metrics.js";

const state = (netwerk) => ({
  netwerk,
  producten: { pass: { verkocht: 12, teruggegeven: 2, hoogsteNummer: 12 }, agency: { verkocht: 3, teruggegeven: 0, hoogsteNummer: 3 } },
  steun: { aantal: 9, totaalMicro: 45_000_000, wallets: 7 },
  opgehaaldMicro: 1_234_567_890,
});

test("cijfers van mainnet: passes min teruggegeven, supporters per wallet, opgehaald in euro", () => {
  const data = { wekelijkseGebruikers: 10, wachtlijst: 4, stand: { en: "x", nl: "y" } };
  const out = applyGenesisState(data, state("mainnet-beta"), "2026-10-17");
  assert.deepEqual(out, { ...data, bijgewerkt: "2026-10-17", passesGeclaimd: 10, agencyGeclaimd: 3, supporters: 7, opgehaaldEur: 1234.57 });
});

test("demo-aankopen op het testnet tellen niet mee", () => {
  const out = applyGenesisState({}, state("devnet"), "2026-10-17");
  assert.deepEqual(out, { bijgewerkt: "2026-10-17", passesGeclaimd: 0, agencyGeclaimd: 0, supporters: 0, opgehaaldEur: 0 });
});

test("stand ophalen bij de site", async () => {
  let seen;
  const fake = async (url) => {
    seen = url;
    return Response.json({ netwerk: "devnet" });
  };
  assert.deepEqual(await fetchGenesisState("https://funding.marketingscan.be/", fake), { netwerk: "devnet" });
  assert.equal(seen, "https://funding.marketingscan.be/api/genesis?lang=en");
  await assert.rejects(fetchGenesisState("https://x.be", async () => new Response("", { status: 502 })), /502/);
});
