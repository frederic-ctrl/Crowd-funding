import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, validate, supabaseHeaders } from "../api/waitlist.js";

const env = { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_x" };
const req = (body, method = "POST") =>
  new Request("https://community.marketingscan.be/api/waitlist", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

test("validatie", () => {
  assert.deepEqual(validate({ email: " Jij@Bedrijf.be ", consent: true }), { ok: true, value: { email: "jij@bedrijf.be", lang: "nl" } });
  assert.equal(validate({ email: "geen-mail", consent: true }).error, "invalid_email");
  assert.equal(validate({ email: "a@b.be", consent: false }).error, "consent_required");
  assert.equal(validate({ email: "a@b.be", consent: true, website: "spam" }).silent, true);
});

test("zonder Supabase-configuratie: 503", async () => {
  const res = await handle(req({ email: "a@b.be", consent: true }), {});
  assert.equal(res.status, 503);
});

test("geldige inschrijving wordt bewaard zonder persoonlijke extra's", async () => {
  let seen;
  const fake = async (url, init) => {
    seen = { url, init };
    return new Response(null, { status: 201 });
  };
  const res = await handle(req({ email: "Jij@Bedrijf.be", consent: true, lang: "fr" }), env, fake);
  assert.equal(res.status, 201);
  assert.equal(seen.url, "https://abc.supabase.co/rest/v1/waitlist?on_conflict=email");
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(Object.keys(body).sort(), ["consent_at", "email", "lang", "source"]);
  assert.equal(body.email, "jij@bedrijf.be");
  assert.equal(body.lang, "fr");
  assert.match(seen.init.headers.prefer, /ignore-duplicates/);
});

test("honeypot krijgt een stil ok en schrijft niets weg", async () => {
  let called = false;
  const res = await handle(req({ email: "a@b.be", consent: true, website: "bot" }), env, async () => {
    called = true;
    return new Response(null, { status: 201 });
  });
  assert.equal(res.status, 200);
  assert.equal(called, false);
});

test("ongeldige invoer, verkeerde methode en opslagfout", async () => {
  assert.equal((await handle(req({ email: "x", consent: true }), env)).status, 400);
  assert.equal((await handle(req(null, "GET"), env)).status, 405);
  const bad = new Request("https://x.be/api/waitlist", { method: "POST", body: "{niet json" });
  assert.equal((await handle(bad, env)).status, 400);
  const failing = async () => new Response("boem", { status: 500 });
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await handle(req({ email: "a@b.be", consent: true }), env, failing)).status, 502);
  } finally {
    console.error = original;
  }
});

test("oude JWT-sleutels gaan ook als Bearer mee, nieuwe secret keys niet", () => {
  assert.equal(supabaseHeaders("eyJabc").authorization, "Bearer eyJabc");
  assert.equal(supabaseHeaders("sb_secret_abc").authorization, undefined);
});
