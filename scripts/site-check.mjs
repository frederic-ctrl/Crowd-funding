// Controle vóór een deploy van de site.
// - Bedrijfsgegevens in shared/bedrijf.json (vennootschap, adres, ondernemingsnummer, privacy-e-mail).
// - De deelafbeelding voor X en de afbeeldingen en metadata van de passes bestaan.
// Zodra er echt verkocht kan worden (een build voor mainnet, of verkoopActief in shared/genesis.json)
// of met --strict faalt de build zolang er iets ontbreekt. Een testnet-demo geeft enkel een waarschuwing.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const genesis = JSON.parse(readFileSync(join(root, "shared", "genesis.json"), "utf8"));
const strict = process.argv.includes("--strict") || process.env.VITE_SOLANA_NETWORK === "mainnet-beta" || genesis.verkoopActief === true;
const problems = [];

const company = JSON.parse(readFileSync(join(root, "shared", "bedrijf.json"), "utf8"));
for (const field of ["vennootschap", "adres", "ondernemingsnummer", "privacyEmail"]) {
  if (!company[field]) problems.push(`shared/bedrijf.json: "${field}" is nog niet ingevuld`);
}
for (const file of ["og-genesis.png", "icon.svg", ...["pass", "agency", "steun"].flatMap((v) => [`token/${v}.png`, `token/${v}.json`])]) {
  if (!existsSync(join(root, "web", "public", file))) problems.push(`web/public/${file} ontbreekt`);
}

if (problems.length === 0) {
  console.log("site-check: alles in orde");
} else {
  for (const p of problems) console.log(`${strict ? "FOUT" : "let op"}: ${p}`);
  if (strict) {
    console.log("site-check: vul dit aan voor je echt verkoopt.");
    process.exit(1);
  }
}
