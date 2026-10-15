// Controle vóór een deploy van de campagnesite.
// - Zoekt invulvelden zoals [KBO-nummer] in de HTML.
// - Controleert dat de deelafbeelding voor X bestaat.
// Bij een productie-deploy op Vercel (VERCEL_ENV=production) of met --strict faalt de build
// zolang er invulvelden openstaan. Preview-deploys en lokale runs geven enkel een waarschuwing.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
const strict = process.argv.includes("--strict") || process.env.VERCEL_ENV === "production";

const PLACEHOLDER = /\[(?:[A-Za-z][^\]\n]{2,60})\]/g;
const problems = [];

for (const file of readdirSync(root).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(root, file), "utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  for (const match of text.matchAll(PLACEHOLDER)) {
    problems.push(`${file}: invulveld ${match[0]} staat nog open`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${file}: geen <title>`);
}

if (!existsSync(join(root, "og-community.png"))) {
  problems.push("og-community.png ontbreekt (npm run site:og)");
}

if (problems.length === 0) {
  console.log("site-check: alles in orde");
} else {
  for (const p of problems) console.log(`${strict ? "FOUT" : "let op"}: ${p}`);
  if (strict) {
    console.log("site-check: vul de velden in voor een productie-deploy.");
    process.exit(1);
  }
}
