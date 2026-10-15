# Marketing Scan: community-ronde

Word mede-eigenaar van Marketing Scan vanaf €1. Je aandelen staan als token in je eigen Solana-wallet, en elke euro is live te volgen op de blockchain.

Status: **werkende demo op het Solana-testnet.** Er wordt geen echt geld opgehaald voor er een vennootschap en juridisch groen licht is.

## Wat het doet

- **Twee rondes:** 9% voor max €45.000 (€0,005 per aandeel), daarna 40% voor €500.000. De oprichter houdt 51%, vergrendeld in de oprichterswallet.
- **Inloggen met je wallet** (Phantom, Solflare, Backpack) en live je aandelen, je percentage, je waarde en je aankopen zien.
- **Investeren vanaf €1:** betaling en aandelen in één transactie, geld in een publieke escrow, iedereen terugbetaald als het minimumdoel niet gehaald wordt.
- **Transparantiepagina** die live controleert: vaste voorraad, ingetrokken muntrecht, vergrendelde oprichter, kluis, escrow en alle aankopen.
- **Automatische promotie via X** met ingebouwde FSMA-controles.

## Documenten

- [docs/plan.md](docs/plan.md): rondes, juridisch kader, BV-advies, uitbetalen in crypto, risico's, volgende stappen
- [docs/technisch-ontwerp.md](docs/technisch-ontwerp.md): token, sleutels, atomaire aankoop, terugbetalen, testen, naar devnet en mainnet
- [docs/x-promotie.md](docs/x-promotie.md): automatische X-posts, goedkeuring, noodstop, de website

## Mappen

| Map | Inhoud |
|---|---|
| `web/` | de website (React, Vite, TypeScript) |
| `api/` | serverfuncties: aankoop voorbereiden, testgeld, wachtlijst |
| `server/` | aankoop-, testgeld- en geschiedenislogica |
| `shared/` | aanbieding (`aanbod.json`), rekenregels, bedrijfsgegevens, adressen per netwerk |
| `scripts/solana/` | opzetten, demo-aankopen, terugbetalen, vrijgeven |
| `marketing/x/` | contentkalender en automatisch posten op X |
| `test/`, `marketing/x/test/` | automatische tests |

## Lokaal

```bash
npm ci
npm test              # alle tests
npm run typecheck     # TypeScript van de site
npm run dev           # site op http://localhost:5173 (met /api)
npm run x:lint        # X-kalender controleren
```
