#!/usr/bin/env node
// Browsertest van de volledige aankoop via de echte website, met een testwallet die zich gedraagt
// als Phantom (Wallet Standard). Vereist: Playwright met Chromium, een draaiende site
// (npm run preview) en een netwerk met een deployment (bv. een lokale validator).
//
// Gebruik: SITE_URL=http://127.0.0.1:4173 SHOTS=./shots node scripts/e2e/ui-koop.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Keypair, Transaction } from "@solana/web3.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SITE = process.env.SITE_URL ?? "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS ?? "shots";
mkdirSync(SHOTS, { recursive: true });

const investor = Keypair.generate();

function walletScript(address, publicKeyBytes) {
  return `(() => {
    const account = { address: ${JSON.stringify(address)}, publicKey: new Uint8Array(${JSON.stringify(publicKeyBytes)}), chains: ["solana:devnet", "solana:localnet", "solana:testnet", "solana:mainnet"], features: ["solana:signTransaction"] };
    const listeners = {};
    const emit = () => (listeners.change || []).forEach((l) => l({ accounts: wallet.accounts }));
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
          signTransaction: async (...inputs) => Promise.all(inputs.map(async (input) => {
            let s = ""; input.transaction.forEach((b) => (s += String.fromCharCode(b)));
            const signed = await window.__testSign(btoa(s));
            return { signedTransaction: Uint8Array.from(atob(signed), (c) => c.charCodeAt(0)) };
          })),
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
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, file), fullPage: true });
}

const browser = await chromium.launch();
const problems = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, viaNode);
  await ctx.exposeFunction("__testSign", (b64) => {
    const tx = Transaction.from(Buffer.from(b64, "base64"));
    tx.partialSign(investor);
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  });
  await ctx.addInitScript(walletScript(investor.publicKey.toBase58(), Array.from(investor.publicKey.toBytes())));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });

  await page.goto(`${SITE}/investeren`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Inloggen met wallet" }).click();
  await page.getByRole("button", { name: /Testwallet/ }).click();
  await page.getByText("Ingelogd als").waitFor({ timeout: 15000 });
  console.log("ingelogd als", investor.publicKey.toBase58());

  await page.getByRole("button", { name: /Ontvang 50 tEUR/ }).click();
  await page.getByText(/Je kreeg/).waitFor({ timeout: 30000 });
  console.log("testgeld ontvangen");

  await page.fill("#bedrag", "12,50");
  await page.check("#a-risk");
  await page.check("#a-locked");
  await page.check("#a-demo");
  await shot(page, "investeren-klaar.png");
  await page.getByRole("button", { name: /Koop 2\.500 aandelen voor € 12,50/ }).click();
  await page.getByText("Welkom als mede-eigenaar").waitFor({ timeout: 60000 });
  await shot(page, "investeren-gelukt.png");
  console.log("aankoop gelukt");

  await page.getByRole("link", { name: "Naar mijn portefeuille" }).click();
  await page.locator(".cert-amount").getByText("2.500").waitFor({ timeout: 30000 });
  await page.locator("td").getByText("€ 12,50").first().waitFor({ timeout: 30000 });
  await shot(page, "portefeuille.png");
  console.log("portefeuille toont 2.500 aandelen en de aankoop");

  for (const [name, path, vp] of [
    ["overzicht", "/", { width: 1280, height: 900 }],
    ["transparantie", "/transparantie", { width: 1280, height: 900 }],
    ["overzicht-gsm", "/", { width: 390, height: 844 }],
    ["portefeuille-gsm", "/portefeuille", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(vp);
    await page.goto(`${SITE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) problems.push(`${name}: horizontale scroll van ${overflow}px`);
    await shot(page, `${name}.png`);
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.log("Problemen:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Alles in orde.");
