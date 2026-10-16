# Marketing Scan Genesis

Levenslang Marketing Scan Pro, één keer betalen. 250 genummerde Genesis Passes voor de eerste klanten, als soulbound token in hun eigen Solana-wallet. Elke euro is live te volgen op de blockchain. **Geen investering:** een voorverkoop van een abonnement.

Status: **werkende demo op het Solana-testnet.** Er wordt niets verkocht voor de boekhouder de rechtsvorm en de btw heeft bekeken.

## Wat het doet

- **Drie pakketten:** Genesis Pass (1 website, €99 tot €299 volgens je nummer, 250 stuks), Genesis Agency (10 websites, €799, 25 stuks) en Supporter (vanaf €1). Doel: €50.000.
- **Genummerde, soulbound passes:** elke pass is een eigen token met voorraad 1, kan je wallet niet verlaten en kan door niemand bevroren worden. Een nummer bestaat maar één keer, dat dwingt de keten af.
- **Inloggen met je wallet** (Phantom, Solflare, Backpack): je pass zien, activeren met een gratis handtekening en binnen 14 dagen geld terug met één klik.
- **Transparantie:** live controles, een publiek kasboek en een knop waarmee je eigen browser alles nakijkt zonder onze server.
- **Automatische promotie via X** met controles tegen beleggingstaal en een slot zolang de verkoop niet open is.

## Documenten

- [docs/plan.md](docs/plan.md): de pakketten, waarom geen aandelen, waarom dit werkt op X, het geld, vragen voor de boekhouder, risico's, volgende stappen
- [docs/technisch-ontwerp.md](docs/technisch-ontwerp.md): accounts, de transacties, activeren, testen, naar devnet en mainnet
- [docs/x-promotie.md](docs/x-promotie.md): automatische X-posts, regels, goedkeuring, noodstop

## Mappen

| Map | Inhoud |
|---|---|
| `web/` | de website (React, Vite, TypeScript) |
| `api/` | serverfuncties: stand, kopen, geld terug, activeren, testgeld, wachtlijst |
| `server/` | ketenlogica (passen, steun, terugbetaling, opname, activatie) en testgeld |
| `shared/` | `genesis.json` (pakketten en prijzen), rekenregels, geschiedenis, bedrijfsgegevens, adressen per netwerk |
| `scripts/solana/` | opzetten, demo-aankopen, opnemen uit de kas |
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

Met een lokale Solana-keten: zie [docs/technisch-ontwerp.md](docs/technisch-ontwerp.md#7-testen).
