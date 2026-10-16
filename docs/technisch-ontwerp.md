# Technisch ontwerp (v0.3, Genesis)

Hoe Marketing Scan Genesis op Solana werkt: welke accounts er zijn, wat elke transactie doet en waarom niemand vals kan spelen. Alles draait zonder eigen smart contract, met de standaardprogramma's van Solana (Token-2022, Associated Token Account, Memo). Daardoor is er geen eigen code op de keten die een audit nodig heeft.

## 1. Overzicht

| Onderdeel | Waar | Wat |
|---|---|---|
| Configuratie | `shared/genesis.json` | pakketten, prijsladder, maxima, doel, bedenktijd, verkoopActief |
| Rekenregels | `shared/genesis.js` | prijs per nummer, controles, memo's, activatietekst (gedeeld door site, server en tests) |
| Geschiedenis | `shared/history.js` | leest de kas uit de keten en maakt er een kasboek en de Genesis-muur van (server en browser) |
| Ketenlogica | `server/genesis.js` | pass kopen, steunen, geld terug, opnemen, activeren |
| API | `api/*.js` | `genesis` (stand), `koop`, `terugbetaling`, `activeer`, `testgeld`, `waitlist` |
| Website | `web/` | React, Vite, TypeScript, wallet-adapter (Wallet Standard) |
| Scripts | `scripts/solana/` | `setup.mjs`, `demo-aankopen.mjs`, `opnemen.mjs` |

## 2. Accounts en sleutels

`scripts/solana/setup.mjs` maakt per netwerk:

| Account | Wat |
|---|---|
| **Serversleutel** (`.keys/<netwerk>/authority.json`) | betaalt kosten, maakt passen aan, beheert de kas, munt supporter-badges. In Vercel als `SALE_AUTHORITY_SECRET`. |
| **Betaalmunt** | tEUR (Token-2022, 6 decimalen) op het testnet; op mainnet een bestaande munt via `--payment-mint` (EURC). |
| **Kas** | het betaalaccount (ATA) van de serversleutel. Alle betalingen komen hier binnen. |
| **Rekening van de oprichter** | het betaalaccount van de oprichterswallet, voor opnames. |
| **Supporter-badge** (MSFAN) | Token-2022 met NonTransferable, 0 decimalen, zonder bevriesrecht. |

Alle adressen komen in `shared/deployments/<netwerk>.json`. De site leest dat bestand mee in bij het bouwen.

## 3. Een pass

Elke pass is een **eigen munt**:

- Token-2022 met de extensies **MetadataPointer** + **TokenMetadata** (naam "Marketing Scan Genesis #007", symbool MSGEN, link naar `token/pass.json`) en **NonTransferable** (soulbound).
- 0 decimalen, voorraad precies 1, muntrecht ingetrokken in dezelfde transactie, **geen bevriesrecht**.
- De pass-account van de koper is een gewone ATA; door NonTransferable kan de pass die nooit verlaten. Enkel verbranden kan, en dat kan enkel de eigenaar.

**Nummers zijn uniek door de keten zelf.** Het sleutelpaar van pass *n* wordt afgeleid uit de serversleutel: `sha256(geheim deel van de serversleutel, "marketingscan-genesis:<product>:<n>")`. Elk nummer heeft dus één vast adres. De server kiest het laagste vrije nummer; proberen twee kopers tegelijk hetzelfde nummer, dan mislukt de tweede transactie bij het aanmaken van het account ("already in use") en wordt er niets betaald. De site legt dat uit en de koper krijgt het volgende nummer. Een teruggegeven nummer blijft bestaan (voorraad 0) en wordt niet opnieuw verkocht.

## 4. De transacties

Elke transactie is atomair: lukt één stap niet, dan gebeurt er niets. De server bouwt ze, ondertekent als betaler van de kosten (en waar nodig als beheerder) en geeft ze aan de wallet van de koper, die ze nog eens volledig toont. Een gewijzigde transactie wordt geweigerd, want de handtekening van de server klopt dan niet meer.

**Pass kopen** (`buildPassPurchase`, ongeveer 1.020 van de 1.232 bytes):
1. account voor de munt van nummer *n* aanmaken (server betaalt de opslag)
2. MetadataPointer, NonTransferable en de munt initialiseren (geen bevriesrecht)
3. metadata met naam, symbool en link
4. pass-account van de koper, 1 pass munten, muntrecht intrekken
5. betaling van de koper naar de kas (de koper ondertekent)
6. memo: `Marketing Scan Genesis Pass #007 | @naam`

**Steunen** (`buildSupport`): de eerste keer een supporter-badge, daarna enkel de betaling naar de kas, met memo `Marketing Scan Supporter | naam`.

**Geld terug** (`buildRefund`), enkel binnen de bedenktijd en door de eigenaar:
1. de koper verbrandt de pass en sluit het pass-account
2. de kas betaalt het volledige bedrag van de oorspronkelijke aankoop terug (gelezen uit de eerste transactie van de munt)
3. memo: `Marketing Scan terugbetaling Genesis Pass #007`

**Opnemen** (`scripts/solana/opnemen.mjs`): van de kas naar de rekening van de oprichter, enkel wat buiten de bedenktijd valt, met memo `Marketing Scan opname`. Zonder `--uitvoeren` toont het script enkel het overzicht.

## 5. Activeren

Op Mijn pass ondertekent de koper gratis een tekst (geen transactie):

```
Marketing Scan Genesis
Ik activeer Marketing Scan Genesis #007 met wallet <adres>.
Tijdstip: <ISO-tijd>
```

`POST /api/activeer` controleert de ed25519-handtekening, of de tekst hoogstens 10 minuten oud is en of de pass echt in die wallet staat. Dan volgt de code, een HMAC van product en nummer: `MSGEN-007-K7QD-2MXP`. Het geheim is `GENESIS_ACTIVATION_SECRET` of, zonder die variabele, een afleiding van de serversleutel.

Voor Marketing Scan zelf: `GET /api/activeer?code=MSGEN-007-K7QD-2MXP` geeft `{ geldig, product, nummer, websites, wallet }`. Een teruggegeven pass geeft `geldig: false`. Marketing Scan bewaart welke code bij welk account hoort (één account per code).

## 6. De stand en de geschiedenis

- `GET /api/genesis` leest alle transacties van de kas, houdt enkel die bij die **de serversleutel ondertekende** en een Genesis-memo dragen, en rekent: verkocht per product, teruggegeven, steun, opgehaald, opgenomen, verwacht saldo, de muur en de laatste 100 bewegingen. Transacties veranderen nooit, dus de server bewaart ze in het geheugen en haalt enkel nieuwe op.
- De site controleert live: kas = binnen - terug - opgenomen, de buffer voor terugbetalingen, en per pass voorraad, muntrecht, bevriesrecht en NonTransferable (rechtstreeks van de keten).
- **Controle in de browser:** op de transparantiepagina leest de browser de volledige geschiedenis zelf van Solana, met dezelfde code (`shared/history.js`), en vergelijkt het resultaat met de server.

## 7. Testen

```bash
npm test                 # 165 tests (rekenregels, geschiedenis, API, X-promotie)
npm run typecheck
```

Op een echte keten (lokale validator):

```bash
solana-test-validator --reset &
node scripts/solana/setup.mjs --network localnet --keys /tmp/keys --force
SOLANA_E2E_DEPLOYMENT=shared/deployments/localnet.json SOLANA_E2E_AUTHORITY=/tmp/keys/authority.json node --test test/solana-e2e.test.js
```

Die 14 tests dekken onder meer: een pass kopen zonder SOL, de prijsladder, twee kopers voor hetzelfde nummer, niet kunnen doorsturen, maximum per wallet, Agency, steun en badge, geld terug (en niet twee keer, niet door een ander, niet na 14 dagen), activeren, het kasboek tegenover het saldo, opnemen met buffer en een gewijzigde transactie. GitHub Actions draait ze bij elke push.

De browsertest `scripts/e2e/ui-koop.mjs` doorloopt de echte site met een testwallet: inloggen, testgeld, pass claimen, activeren, steunen, alle pagina's (ook op gsm), controle in de browser en geld terug.

## 8. Op het testnet zetten (devnet)

1. Stuur devnet-SOL (minstens 0,3) naar de serversleutel, via faucet.solana.com.
2. `node scripts/solana/setup.mjs --network devnet`
3. `node scripts/solana/demo-aankopen.mjs --network devnet` (optioneel, voor een levendige muur)
4. Vercel: `SOLANA_NETWORK=devnet`, `SALE_AUTHORITY_SECRET=<inhoud van .keys/devnet/authority.json>`, optioneel `SOLANA_RPC_URL` (een eigen RPC, bv. Helius) en voor de wachtlijst `SUPABASE_URL` en `SUPABASE_SECRET_KEY`.
5. `shared/deployments/devnet.json` committen en deployen.

Geen database nodig: de blockchain is de bron van waarheid.

## 9. Naar mainnet (pas na het advies van de boekhouder)

1. `shared/bedrijf.json` invullen (een build voor mainnet faalt zonder).
2. Een nieuwe serversleutel en een eigen RPC.
3. `node scripts/solana/setup.mjs --network mainnet-beta --payment-mint <EURC-mint-adres> --ik-weet-wat-ik-doe`. Haal het mint-adres van EURC op Solana bij Circle zelf (developers.circle.com) en controleer het twee keer.
4. `verkoopActief: true` in `shared/genesis.json`, en `legalReviewDone` en `verkoopActief` in `marketing/x/config.json`.
5. Opnames naar een hardware-wallet of een Squads-multisig.
