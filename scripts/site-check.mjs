// Controle vóór een deploy van de site.
// - Bedrijfsgegevens in shared/bedrijf.json (vennootschap, adres, ondernemingsnummer, privacy-e-mail).
// - De deelafbeelding voor X en de token-afbeelding bestaan.
// Bij een productie-deploy op Vercel (VERCEL_ENV=production) of met --strict faalt de build
// zolang er iets ontbreekt. Preview-deploys en lokale builds geven enkel een waarschuwing.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict") || process.env.VERCEL_ENV === "production";
const problems = [];

const company = JSON.parse(readFileSync(join(root, "shared", "bedrijf.json"), "utf8"));
for (const field of ["vennootschap", "adres", "ondernemingsnummer", "privacyEmail"]) {
  if (!company[field]) problems.push(`shared/bedrijf.json: "${field}" is nog niet ingevuld`);
}
for (const file of ["og-community.png", "token/mscan.png", "token/mscan.json", "icon.svg"]) {
  if (!existsSync(join(root, "web", "public", file))) problems.push(`web/public/${file} ontbreekt`);
}

if (problems.length === 0) {
  console.log("site-check: alles in orde");
} else {
  for (const p of problems) console.log(`${strict ? "FOUT" : "let op"}: ${p}`);
  if (strict) {
    console.log("site-check: vul dit aan voor een productie-deploy.");
    process.exit(1);
  }
}
