#!/usr/bin/env node
// Schermafbeeldingen van alle pagina's (desktop en gsm, Engels en Nederlands), om de vormgeving na te kijken.
// Gebruik: SITE_URL=http://127.0.0.1:4173 SHOTS=./shots node scripts/e2e/shots.mjs [walletadres-voor-mijn-pass]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const SITE = process.env.SITE_URL ?? "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS ?? "shots";
const wallet = process.argv[2];
mkdirSync(SHOTS, { recursive: true });

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

const pages = [
  ["home", "/?lang=en"],
  ["home-nl", "/?lang=nl"],
  ["claim", "/genesis?lang=en"],
  ["claim-agency", "/genesis?product=agency&lang=en"],
  ["transparency", "/transparantie?lang=en"],
  ["terms", "/voorwaarden?lang=en"],
  ...(wallet ? [["mypass", `/mijn-pass?adres=${wallet}&lang=en`]] : []),
];
const browser = await chromium.launch();
const problems = [];
for (const [vpName, viewport] of [["desktop", { width: 1280, height: 900 }], ["gsm", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, locale: "en-US" });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, viaNode);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  for (const [name, path] of pages) {
    await page.goto(`${SITE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    // Door de pagina scrollen zodat alles wat bij het scrollen verschijnt, ook echt zichtbaar is.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) problems.push(`${name}-${vpName}: horizontale scroll van ${overflow}px`);
    await page.screenshot({ path: join(SHOTS, `${name}-${vpName}.png`), fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `Problemen:\n- ${problems.join("\n- ")}` : "Alles in orde.");
