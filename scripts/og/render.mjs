// Maakt site/og-community.png (1200 x 630) van scripts/og/og.html.
// Vereist Playwright met Chromium op de machine: npm i -D playwright && npx playwright install chromium
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import("playwright");

const browser = await chromium.launch(
  process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, "og.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const out = join(here, "..", "..", "site", "og-community.png");
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`geschreven: ${out}`);
