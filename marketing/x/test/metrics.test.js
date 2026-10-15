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
