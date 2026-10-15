import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { handle as koop } from "../api/koop.js";
import { handle as testgeld } from "../api/testgeld.js";
import { parseSecretKey } from "../server/solana.js";
import bs58 from "bs58";

const post = (body) =>
  new Request("https://example.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const wallet = Keypair.generate().publicKey.toBase58();

test("koop: methode, ongeldige invoer en niet geactiveerd", async () => {
  assert.equal((await koop(new Request("https://example.test/api"), {})).status, 405);
  assert.equal((await koop(new Request("https://example.test/api", { method: "POST", body: "{x" }), {})).status, 400);
  assert.equal((await koop(post({ wallet: "geen-adres", bedrag: 1 }), {})).status, 400);
  const notConfigured = await koop(post({ wallet, bedrag: 1 }), { SOLANA_NETWORK: "bestaat-niet" });
  assert.equal(notConfigured.status, 503);
  const noKey = await koop(post({ wallet, bedrag: 1 }), {}, { deployment: { network: "devnet" } });
  assert.equal(noKey.status, 503);
});

test("koop en testgeld: adressen zonder sleutel (PDA) worden geweigerd", async () => {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("geen-wallet")], SystemProgram.programId);
  assert.equal((await koop(post({ wallet: pda.toBase58(), bedrag: 1 }), {})).status, 400);
  assert.equal((await testgeld(post({ wallet: pda.toBase58() }), {})).status, 400);
});

test("testgeld: methode, ongeldige invoer, mainnet en niet geactiveerd", async () => {
  assert.equal((await testgeld(new Request("https://example.test/api"), {})).status, 405);
  assert.equal((await testgeld(post({ wallet: "x" }), {})).status, 400);
  assert.equal((await testgeld(post({ wallet }), {}, { deployment: { network: "mainnet-beta" } })).status, 404);
  assert.equal((await testgeld(post({ wallet }), {}, { deployment: { network: "devnet" } })).status, 503);
});

test("serversleutel: base58 en JSON-array worden allebei gelezen", () => {
  const kp = Keypair.generate();
  assert.ok(parseSecretKey(bs58.encode(kp.secretKey)).publicKey.equals(kp.publicKey));
  assert.ok(parseSecretKey(JSON.stringify(Array.from(kp.secretKey))).publicKey.equals(kp.publicKey));
  assert.throws(() => parseSecretKey("abc"), /64 bytes/);
  assert.throws(() => parseSecretKey(""), /Geen geheime sleutel/);
});
