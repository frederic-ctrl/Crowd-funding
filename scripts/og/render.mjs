// Maakt de afbeeldingen voor sociale media en wallets:
//   web/public/og-genesis.png       (1200 x 630, kaart bij een link op X)
//   web/public/token/pass.png     (512 x 512, afbeelding van de Genesis Pass in wallets)
//   web/public/token/agency.png   (512 x 512, Genesis Agency)
//   web/public/token/steun.png    (512 x 512, supporter-badge)
// Vereist Playwright met Chromium op de machine: npm i -D playwright && npx playwright install chromium
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "web", "public");

const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
for (const [file, query, target, width, height, transparent] of [
  ["og.html", "", "og-genesis.png", 1200, 630, false],
  ["pass.html", "?v=pass", "token/pass.png", 512, 512, true],
  ["pass.html", "?v=agency", "token/agency.png", 512, 512, true],
  ["pass.html", "?v=steun", "token/steun.png", 512, 512, true],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(here, file)).href + query, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, target), clip: { x: 0, y: 0, width, height }, omitBackground: transparent });
  console.log(`geschreven: web/public/${target}`);
}
await browser.close();
