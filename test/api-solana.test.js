import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { handle as koop } from "../api/koop.js";
import { handle as testgeld } from "../api/testgeld.js";
import { handle as terugbetaling } from "../api/terugbetaling.js";
import { handle as activeer } from "../api/activeer.js";
import { handle as genesis } from "../api/genesis.js";
import { parseSecretKey } from "../server/solana.js";
import { activationCode, readActivationCode, verifyWalletSignature, passKeypair } from "../server/genesis.js";
import { createPrivateKey, sign } from "node:crypto";
import bs58 from "bs58";

const cfg = JSON.parse((await import("node:fs")).readFileSync(new URL("../shared/genesis.json", import.meta.url), "utf8"));
const post = (body) =>
  new Request("https://example.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const wallet = Keypair.generate().publicKey.toBase58();

test("koop, terugbetaling en activeer: methode, ongeldige invoer en niet geactiveerd", async () => {
  for (const handle of [koop, terugbetaling]) {
    assert.equal((await handle(new Request("https://example.test/api"), {})).status, 405);
    assert.equal((await handle(new Request("https://example.test/api", { method: "POST", body: "{x" }), {})).status, 400);
    assert.equal((await handle(post({ wallet: "geen-adres" }), {})).status, 400);
    assert.equal((await handle(post({ wallet }), { SOLANA_NETWORK: "bestaat-niet" })).status, 503);
    assert.equal((await handle(post({ wallet }), {}, { deployment: { network: "devnet" } })).status, 503, "zonder serversleutel");
  }
  assert.equal((await activeer(post({ wallet: "x" }), {})).status, 400);
  assert.equal((await activeer(new Request("https://example.test/api?code=X"), { SOLANA_NETWORK: "bestaat-niet" })).status, 503);
});

test("adressen zonder sleutel (PDA) worden geweigerd", async () => {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("geen-wallet")], SystemProgram.programId);
  assert.equal((await koop(post({ wallet: pda.toBase58() }), {})).status, 400);
  assert.equal((await testgeld(post({ wallet: pda.toBase58() }), {})).status, 400);
  assert.equal((await terugbetaling(post({ wallet: pda.toBase58() }), {})).status, 400);
});

test("testgeld: methode, ongeldige invoer, mainnet en niet geactiveerd", async () => {
  assert.equal((await testgeld(new Request("https://example.test/api"), {})).status, 405);
  assert.equal((await testgeld(post({ wallet: "x" }), {})).status, 400);
  assert.equal((await testgeld(post({ wallet }), {}, { deployment: { network: "mainnet-beta" } })).status, 404);
  assert.equal((await testgeld(post({ wallet }), {}, { deployment: { network: "devnet" } })).status, 503);
});

test("stand: enkel GET, en 503 zolang Genesis niet geactiveerd is", async () => {
  assert.equal((await genesis(post({}), {})).status, 405);
  assert.equal((await genesis(new Request("https://example.test/api/genesis"), { SOLANA_NETWORK: "bestaat-niet" })).status, 503);
});

const authorityKp = Keypair.generate();
const fakeDeployment = {
  network: "devnet",
  authority: authorityKp.publicKey.toBase58(),
  founderWallet: wallet,
  supporterMint: Keypair.generate().publicKey.toBase58(),
  munten: Object.fromEntries(
    ["eurc", "usdc"].map((id) => [id, { mint: Keypair.generate().publicKey.toBase58(), program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", kas: Keypair.generate().publicKey.toBase58(), founderAccount: Keypair.generate().publicKey.toBase58() }]),
  ),
};

test("koop in USDC: zonder koers een duidelijke 503, onbekende munt een 400", async () => {
  const deps = { deployment: fakeDeployment, authority: authorityKp, connection: {}, rate: async () => { throw new Error("ECB onbereikbaar"); } };
  const down = await koop(post({ wallet, product: "pass", munt: "usdc", lang: "en" }), {}, deps);
  assert.equal(down.status, 503);
  assert.match((await down.json()).fout, /exchange rate/);
  const unknown = await koop(post({ wallet, product: "pass", munt: "btc" }), {}, deps);
  assert.equal(unknown.status, 400);
  assert.match((await unknown.json()).fout, /betaalmunt "btc"/);
});

test("stand: saldo per kas en de koers euro-dollar", async () => {
  const connection = {
    getSignaturesForAddress: async () => [],
    getParsedTransactions: async () => [],
    getMultipleAccountsInfo: async (keys) => keys.map(() => null),
  };
  const res = await genesis(new Request("https://example.test/api/genesis"), {}, { deployment: fakeDeployment, connection, fresh: true, rate: async () => ({ eurUsd: 1.1208, datum: "2026-10-15" }) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.kassen, { eurc: 0, usdc: 0 });
  assert.deepEqual(body.koers, { eurUsd: 1.1208, datum: "2026-10-15" });
  assert.equal(body.perMunt.usdc.verwachteKasMicro, 0);
  const noRate = await genesis(new Request("https://example.test/api/genesis"), {}, { deployment: fakeDeployment, connection, fresh: true, rate: async () => { throw new Error("x"); } });
  assert.equal((await noRate.json()).koers, null, "zonder koers werkt de stand gewoon");
});

test("activatiecodes: vast formaat, niet te raden, gebonden aan de serversleutel", () => {
  const authority = Keypair.generate();
  const code = activationCode(authority, cfg, "pass", 42, {});
  assert.match(code, /^MSGEN-042-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.deepEqual(readActivationCode(authority, cfg, code.toLowerCase(), {}), { productId: "pass", number: 42 });
  assert.equal(readActivationCode(Keypair.generate(), cfg, code, {}), null, "andere sleutel, andere codes");
  assert.equal(readActivationCode(authority, cfg, "MSGEN-043-" + code.slice(10), {}), null);
  assert.equal(readActivationCode(authority, cfg, "MSGEN-999-AAAA-AAAA", {}), null);
  assert.equal(readActivationCode(authority, cfg, "onzin", {}), null);
  const withSecret = activationCode(authority, cfg, "pass", 42, { GENESIS_ACTIVATION_SECRET: "geheim" });
  assert.notEqual(withSecret, code);
  assert.match(activationCode(authority, cfg, "agency", 7, {}), /^MSGENA-07-/);
});

test("pass-adressen: vast per nummer, verschillend per nummer en product", () => {
  const authority = Keypair.generate();
  assert.ok(passKeypair(authority, "pass", 1).publicKey.equals(passKeypair(authority, "pass", 1).publicKey));
  assert.ok(!passKeypair(authority, "pass", 1).publicKey.equals(passKeypair(authority, "pass", 2).publicKey));
  assert.ok(!passKeypair(authority, "pass", 1).publicKey.equals(passKeypair(authority, "agency", 1).publicKey));
});

test("wallethandtekeningen (ed25519) worden correct nagekeken", () => {
  const kp = Keypair.generate();
  const key = createPrivateKey({ key: { kty: "OKP", crv: "Ed25519", d: Buffer.from(kp.secretKey.subarray(0, 32)).toString("base64url"), x: Buffer.from(kp.publicKey.toBytes()).toString("base64url") }, format: "jwk" });
  const sig = sign(null, Buffer.from("hallo"), key);
  assert.equal(verifyWalletSignature(kp.publicKey.toBase58(), "hallo", sig), true);
  assert.equal(verifyWalletSignature(kp.publicKey.toBase58(), "hallo!", sig), false);
  assert.equal(verifyWalletSignature(Keypair.generate().publicKey.toBase58(), "hallo", sig), false);
  assert.equal(verifyWalletSignature("onzin", "hallo", sig), false);
});

test("serversleutel: base58 en JSON-array worden allebei gelezen", () => {
  const kp = Keypair.generate();
  assert.ok(parseSecretKey(bs58.encode(kp.secretKey)).publicKey.equals(kp.publicKey));
  assert.ok(parseSecretKey(JSON.stringify(Array.from(kp.secretKey))).publicKey.equals(kp.publicKey));
  assert.throws(() => parseSecretKey("abc"), /64 bytes/);
  assert.throws(() => parseSecretKey(""), /Geen geheime sleutel/);
});
