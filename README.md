# Marketingscan.be crowdfunding

Transparant investeren in Marketingscan.be vanaf €1, met je aandelen als token in je eigen Solana-wallet.

Status: **concept**. Er wordt geen geld opgehaald en er staat niets op mainnet voor er juridisch groen licht is.

## Documenten

- [docs/plan.md](docs/plan.md): het plan (juridisch kader, structuur, fases, waarde, geldstroom, anti-scamgaranties, kosten, open beslissingen)
- [docs/technisch-ontwerp.md](docs/technisch-ontwerp.md): token, multisig, escrow-programma, invarianten, beveiliging en bouwvolgorde
- [docs/x-promotie.md](docs/x-promotie.md): automatische promotie via X en de campagnesite (installatie, gebruik, noodstop)

## Wat er in de repo zit

| Map | Inhoud |
|---|---|
| `site/` | Campagnesite in de huisstijl van Marketing Scan, met wachtlijst (nog geen aanbod) |
| `api/` | Wachtlijst-API (Vercel Function, opslag in Supabase) |
| `supabase/` | Databasetabel voor de wachtlijst |
| `marketing/x/` | Contentkalender, compliance-controle en automatisch posten op X |
| `.github/workflows/` | Controle bij elke push, automatisch posten, goedkeuren vanuit GitHub |

## Lokaal

```bash
npm ci
npm test            # alle tests
npm run x:lint      # kalender controleren
npm run x:plan      # planning en kostenraming
npm run site:check  # openstaande invulvelden op de site
```

## In één zin

Max 49% van Marketingscan in drie fases, 1 token = 1 aandeel, het geld nooit naar een persoonlijke wallet, automatisch terug als een fase haar minimumdoel niet haalt, en alles publiek controleerbaar on-chain.
