#!/usr/bin/env node
// Browsertest van Genesis via de echte website, met een testwallet die zich gedraagt als Phantom
// (Wallet Standard: transacties en berichten ondertekenen). Vereist: Playwright met Chromium, een
// draaiende site (npm run preview) en een netwerk met een deployment (bv. een lokale validator).
//
// Doorloopt: pass claimen (tEUR), activeren, steunen, een pass in tUSD, de overzichtspagina's
// (ook op gsm) en geld terug. Zet EUR_USD_KOERS op de server voor een vaste koers.
// Een lokale validator gooit standaard oude blokken weg; start hem voor lange sessies met
// --limit-ledger-size 50000000, anders ziet de controle in de browser niet de volledige geschiedenis.
// Gebruik: SITE_URL=http://127.0.0.1:4173 SHOTS=./shots node scripts/e2e/ui-koop.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createPrivateKey, sign } from "node:crypto";
import { Keypair, Transaction } from "@solana/web3.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SITE = process.env.SITE_URL ?? "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS ?? "shots";
mkdirSync(SHOTS, { recursive: true });

const buyer = Keypair.generate();
const privateKey = createPrivateKey({
  key: { kty: "OKP", crv: "Ed25519", d: Buffer.from(buyer.secretKey.subarray(0, 32)).toString("base64url"), x: Buffer.from(buyer.publicKey.toBytes()).toString("base64url") },
  format: "jwk",
});

function walletScript(address, publicKeyBytes) {
  return `(() => {
    const account = { address: ${JSON.stringify(address)}, publicKey: new Uint8Array(${JSON.stringify(publicKeyBytes)}), chains: ["solana:devnet", "solana:localnet", "solana:testnet", "solana:mainnet"], features: ["solana:signTransaction", "solana:signMessage"] };
    const listeners = {};
    const emit = () => (listeners.change || []).forEach((l) => l({ accounts: wallet.accounts }));
    const b64 = (bytes) => { let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };
    const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const wallet = {
      version: "1.0.0",
      name: "Testwallet",
      icon: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" rx="2" fill="#f5693c"/></svg>'),
      chains: account.chains,
      accounts: [],
      features: {
        "standard:connect": { version: "1.0.0", connect: async () => { wallet.accounts = [account]; emit(); return { accounts: wallet.accounts }; } },
        "standard:disconnect": { version: "1.0.0", disconnect: async () => { wallet.accounts = []; emit(); } },
        "standard:events": { version: "1.0.0", on: (event, listener) => { (listeners[event] ||= []).push(listener); return () => { listeners[event] = listeners[event].filter((l) => l !== listener); }; } },
        "solana:signTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: async (...inputs) => Promise.all(inputs.map(async (input) => ({ signedTransaction: unb64(await window.__testSign(b64(input.transaction))) }))),
        },
        "solana:signMessage": {
          version: "1.0.0",
          signMessage: async (...inputs) => Promise.all(inputs.map(async (input) => ({ signedMessage: input.message, signature: unb64(await window.__testSignMessage(b64(input.message))) }))),
        },
      },
    };
    const callback = ({ register }) => register(wallet);
    window.addEventListener("wallet-standard:app-ready", ({ detail }) => callback(detail));
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: callback }));
  })();`;
}

// Google Fonts via Node ophalen (de browser in een testomgeving heeft soms geen proxy).
async function viaNode(route) {
  try {
    const r = await fetch(route.request().url(), { headers: { "user-agent": "Mozilla/5.0 Chrome/120" } });
    const headers = {};
    r.headers.forEach((v, k) => { if (!["content-encoding", "content-length", "transfer-encoding"].includes(k)) headers[k] = v; });
    headers["access-control-allow-origin"] = "*";
    await route.fulfill({ status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) });
  } catch {
    await route.abort();
  }
}

// Schermafbeelding van de volledige pagina, bovenaan begonnen (anders schuift de vaste menubalk mee).
async function shot(page, file) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(SHOTS, file), fullPage: true });
}

async function noOverflow(page, name, problems) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) problems.push(`${name}: horizontale scroll van ${overflow}px`);
}

const browser = await chromium.launch();
const problems = [];
let page;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, viaNode);
  await ctx.exposeFunction("__testSign", (b64) => {
    const tx = Transaction.from(Buffer.from(b64, "base64"));
    tx.partialSign(buyer);
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  });
  await ctx.exposeFunction("__testSignMessage", (b64) => sign(null, Buffer.from(b64, "base64"), privateKey).toString("base64"));
  await ctx.addInitScript(walletScript(buyer.publicKey.toBase58(), Array.from(buyer.publicKey.toBytes())));
  page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });

  // 1. Een Genesis Pass claimen
  await page.goto(`${SITE}/genesis`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign in with wallet" }).click();
  await page.getByRole("button", { name: /Testwallet/ }).click();
  await page.getByText("Signed in", { exact: true }).waitFor({ timeout: 15000 });
  console.log("ingelogd als", buyer.publicKey.toBase58());

  await page.getByRole("button", { name: /Get 1,000 tEUR/ }).click();
  await page.getByText(/You received/).waitFor({ timeout: 30000 });
  console.log("testgeld ontvangen");

  await page.fill("#naam", "@testkoper");
  await page.check("#a-terms");
  await page.check("#a-nature");
  await page.check("#a-demo");
  const claim = page.getByRole("button", { name: /Claim Genesis Pass #\d{3} for €99/ });
  await claim.waitFor({ timeout: 20000 });
  await shot(page, "genesis-claim.png");
  await claim.click();
  await page.getByText(/Welcome to Genesis, #\d{3}/).waitFor({ timeout: 60000 });
  await shot(page, "genesis-geclaimd.png");
  console.log("pass geclaimd:", await page.locator(".claimed-copy h2").innerText());

  // 2. Activeren met een gratis handtekening
  await page.getByRole("link", { name: "Activate my pass" }).click();
  await page.getByText("In your wallet", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Activate in Marketing Scan" }).click();
  const code = page.locator(".code-row code");
  await code.waitFor({ timeout: 30000 });
  const codeText = await code.innerText();
  if (!/^MSGEN-\d{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codeText)) problems.push(`onverwachte activatiecode: ${codeText}`);
  await shot(page, "mijn-pass.png");
  console.log("geactiveerd:", codeText);

  // 3. Steunen vanaf €1
  await page.goto(`${SITE}/genesis?product=steun`, { waitUntil: "networkidle" });
  await page.getByText("Signed in", { exact: true }).waitFor({ timeout: 15000 });
  await page.fill("#bedrag", "12.50");
  await page.check("#a-terms");
  await page.check("#a-nature");
  await page.check("#a-demo");
  await page.getByRole("button", { name: /Support with €12\.50/ }).click();
  await page.getByText("Thank you for your support.").waitFor({ timeout: 60000 });
  console.log("steun gelukt");

  // 3b. Een tweede pass, betaald in tUSD (de testversie van USDC)
  await page.goto(`${SITE}/genesis`, { waitUntil: "networkidle" });
  await page.getByText("Signed in", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole("radio", { name: /tUSD/ }).click();
  await page.getByText(/ECB reference rate/).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Get 1,000 tUSD/ }).click();
  await page.getByText(/You received 1,000\.00 tUSD/).waitFor({ timeout: 30000 });
  await page.check("#a-terms");
  await page.check("#a-nature");
  await page.check("#a-demo");
  await shot(page, "genesis-claim-usdc.png");
  await page.getByRole("button", { name: /Claim Genesis Pass #\d{3} for €99/ }).click();
  await page.getByText(/You paid [\d.,]+ tUSD \(€99\.00\)/).waitFor({ timeout: 60000 });
  console.log("pass in tUSD geclaimd:", await page.locator(".claimed-copy .lead").innerText());

  // 4. Overzichtspagina's, ook op gsm
  for (const [name, path, vp] of [
    ["overzicht", "/", { width: 1280, height: 900 }],
    ["transparantie", "/transparantie", { width: 1280, height: 900 }],
    ["voorwaarden", "/voorwaarden", { width: 1280, height: 900 }],
    ["overzicht-nl", "/?lang=nl", { width: 1280, height: 900 }],
    ["claim", "/genesis?lang=en", { width: 1280, height: 900 }],
    ["overzicht-gsm", "/", { width: 390, height: 844 }],
    ["claim-gsm", "/genesis", { width: 390, height: 844 }],
    ["mijn-pass-gsm", "/mijn-pass", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(vp);
    await page.goto(`${SITE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await noOverflow(page, name, problems);
    await shot(page, `${name}.png`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${SITE}/transparantie`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Verify in my browser" }).click();
  await page.getByText("Everything matches.").waitFor({ timeout: 90000 });
  console.log("browsercontrole: alles klopt");

  // 5. Geld terug binnen 14 dagen
  await page.goto(`${SITE}/mijn-pass`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Request refund" }).first().click();
  await page.getByRole("button", { name: /Yes, refund 110\.96 tUSD/ }).click(); // de nieuwste pass (in tUSD) staat bovenaan
  await page.getByText(/Refunded: 110\.96 tUSD/).waitFor({ timeout: 60000 });
  await page.getByText("Refunded", { exact: true }).first().waitFor({ timeout: 30000 });
  await shot(page, "mijn-pass-terug.png");
  console.log("geld terug gelukt");
} catch (err) {
  // Toon wat er op het scherm stond, zodat een fout meteen te begrijpen is.
  if (page) {
    await shot(page, "fout.png").catch(() => {});
    const notices = await page.locator(".notice, .errors").allInnerTexts().catch(() => []);
    if (notices.length) console.log("Op het scherm:\n- " + notices.join("\n- "));
  }
  throw err;
} finally {
  await browser.close();
}

if (problems.length) {
  console.log("Problemen:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Alles in orde.");
