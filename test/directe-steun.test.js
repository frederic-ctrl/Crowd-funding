import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { validAddress, paymentUri, checkDirectSupport, shownAddresses } from "../shared/directe-steun.js";

const sol = Keypair.generate().publicKey.toBase58();
const cfg = (over = {}) => ({
  actief: true,
  ontvanger: "Test Persoon",
  email: "test@example.com",
  adressen: [
    { netwerk: "Solana", schema: "solana", munten: ["SOL", "USDC", "USDT"], adres: sol },
    { netwerk: "Bitcoin", schema: "bitcoin", munten: ["BTC"], adres: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
  ],
  ...over,
});

test("adressen: Solana-wallets en Bitcoin-adressen, de rest niet", () => {
  assert.equal(validAddress("solana", sol), true);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("x")], SystemProgram.programId);
  assert.equal(validAddress("solana", pda.toBase58()), false, "een programma-adres is geen wallet");
  assert.equal(validAddress("solana", `${sol.slice(0, -1)}0`), false, "0 bestaat niet in base58: een tikfout");
  assert.equal(validAddress("solana", `${sol}x`), false);
  assert.equal(validAddress("solana", "0x52908400098527886E0F7030069857D2E4169EE7"), false);
  assert.equal(validAddress("bitcoin", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"), true);
  assert.equal(validAddress("bitcoin", "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"), true);
  assert.equal(validAddress("bitcoin", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"), true);
  assert.equal(validAddress("bitcoin", sol), false);
  assert.equal(validAddress("bitcoin", ""), false);
  assert.equal(paymentUri("bitcoin", "bc1qx"), "bitcoin:bc1qx");
});

test("configuratie: niet actief is altijd in orde, actief vraagt ontvanger, e-mail en geldige adressen", () => {
  assert.deepEqual(checkDirectSupport({ actief: false }), []);
  assert.deepEqual(checkDirectSupport(cfg()), []);
  assert.equal(shownAddresses(cfg()).length, 2);
  assert.match(checkDirectSupport(cfg({ ontvanger: "" })).join(), /ontvanger/);
  assert.match(checkDirectSupport(cfg({ email: "x" })).join(), /email/);
  const typo = cfg({ adressen: [{ netwerk: "Solana", schema: "solana", munten: ["SOL"], adres: `${sol}x` }] });
  assert.match(checkDirectSupport(typo).join(), /geen geldig adres/);
  assert.deepEqual(shownAddresses(typo), [], "met een fout toont de site niets");
  const onlySol = cfg({ adressen: [{ ...cfg().adressen[0] }, { ...cfg().adressen[1], adres: null }] });
  assert.deepEqual(shownAddresses(onlySol).map((a) => a.netwerk), ["Solana"]);
});

test("de meegeleverde configuratie is geldig", async () => {
  const shipped = JSON.parse((await import("node:fs")).readFileSync(new URL("../shared/directe-steun.json", import.meta.url), "utf8"));
  assert.deepEqual(checkDirectSupport(shipped), []);
});
