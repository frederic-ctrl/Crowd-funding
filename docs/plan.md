# Marketing Scan: community-ronde op Solana

Status: werkende demo op het testnet, oktober 2026. Er wordt nog geen echt geld opgehaald.
Dit is geen juridisch of fiscaal advies. Laat alles wat juridisch of fiscaal is bevestigen door een advocaat (financieel recht en vennootschapsrecht) en je boekhouder.

---

## In het kort

- **Twee rondes, samen maximaal 49%.** Ronde 1: 9% voor maximaal €45.000. Ronde 2: 40% voor €500.000. De oprichter houdt 51%.
- **Vanaf €1.** In ronde 1 kost een aandeel €0,005: voor €1 krijg je 200 aandelen.
- **Je aandelen staan in je eigen wallet** als Solana-token (Token-2022). Er bestaan er exact 100.000.000, en dat is op de blockchain vastgelegd: niemand kan er nog bij maken.
- **Inloggen met je wallet en je waarde zien.** In de portefeuille zie je je aantal aandelen, je percentage, de waarde volgens de laatste rondeprijs en al je aankopen, live van de blockchain.
- **Betalen en ontvangen in één transactie.** Lukt één deel niet, dan gebeurt er niets. Het geld gaat naar een escrow die iedereen kan bekijken, niet naar een persoon.
- **Minimumdoel niet gehaald? Iedereen krijgt alles terug.** Daar is een script voor, en elke terugbetaling is publiek.
- **Jouw wallet** (`JPmY…8T6`) krijgt de 51% van de oprichter, vergrendeld. Zo is je wallet zichtbaar gekoppeld aan het bedrijf.

---

## 1. Waar je vandaag staat, eerlijk

- Marketing Scan is nog **geen vennootschap**. Er is niets officieel.
- Het product werkt: een gratis scan, Semrush-achtige analyse, **10 wekelijkse gebruikers**, nog geen betalende klanten.
- Je wil alles **crypto-first** opstarten, en later ook **uitbetalen in crypto**.

### Mijn advies: richt eerst een BV op, en doe al de rest in crypto

Crypto-first en een BV gaan perfect samen: de BV is de juridische schil, de blockchain is de motor. Zonder vennootschap loop je drie grote risico's:

1. **Er is niets om een deel van te kopen.** "10% van Marketing Scan" moet ergens juridisch van zijn. Zonder BV koopt een investeerder hoogstens een belofte van jou persoonlijk.
2. **Je bent persoonlijk aansprakelijk**, met je eigen vermogen.
3. **Belastingen.** Geld dat je als privépersoon ophaalt, kan als inkomen belast worden, mogelijk tegen het hoogste tarief. In een BV is het een inbreng in het bedrijf.

Daarnaast blijft het een aanbieding van beleggingsinstrumenten: of je in euro of in crypto werkt, de FSMA-regels gelden (zie 6). Een buitenlandse crypto-constructie (DAO, stichting in het buitenland) verandert dat niet als je Belgen aanspreekt, en kost meer vertrouwen dan ze oplevert.

Een BV oprichten kost ongeveer €1.000 tot €2.000 bij de notaris en vraagt een financieel plan. Er is geen minimumkapitaal meer. Dat is klein tegenover een ronde van €45.000, en het is het sterkste vertrouwenssignaal dat je kan geven.

---

## 2. De rondes

| | Oprichter | Ronde 1 · Community | Ronde 2 · Groei |
|---|---|---|---|
| Deel van het bedrijf | 51% | 9% | 40% |
| Aandelen | 51.000.000 | 9.000.000 | 40.000.000 |
| Prijs per aandeel | - | €0,005 | €0,0125 |
| Op te halen (max) | - | €45.000 | €500.000 |
| Waardering van het hele bedrijf | - | €500.000 | €1.250.000 |
| Voor €1 krijg je | - | 200 aandelen | 80 aandelen |
| Minimumdoel | - | €5.000 | nog te bepalen |
| Max per persoon | - | €5.000 | €5.000 (of geen, zie 6) |
| Status | vergrendeld | open op testnet | gepland |

Alle cijfers staan in één bestand: `shared/aanbod.json`. Wil je ronde 1 op €40.000 voor 9% (zoals je ook noemde), dan wordt de prijs €0,00444 per aandeel. Mijn voorstel blijft €45.000: dezelfde waardering als 10% voor €50.000, en een ronde prijs per aandeel.

**Over de waardering:** €500.000 voor een product met 10 wekelijkse gebruikers en nog geen omzet is ambitieus. Investeerders, en de FSMA, letten op een evenwichtige voorstelling. Laat de waardering onafhankelijk bevestigen, en toon je cijfers eerlijk (de site doet dat al: "We zijn vroeg. Daarom is de instap laag, en het risico hoog.").

**Ronde 2** start pas als de mijlpalen van ronde 1 gehaald zijn (voorstel: betalende klanten, terugkerende omzet en de eerste nieuwe modules live), publiek gerapporteerd.

---

## 3. De token: je aandelen in je wallet

- **Token-2022** (Solana Token Extensions), symbool `MSCAN`, 0 decimalen: 1 token = 1 aandeel.
- **Vaste voorraad:** 100.000.000. Na het aanmaken is het muntrecht definitief ingetrokken.
- **Vergrendeld:** aandelen zijn niet vrij overdraagbaar. Zo belanden ze niet op speculatieve markten en blijft het aandelenregister kloppen. Een overdracht kan via een gecontroleerde procedure.
- **Oprichter:** 51.000.000 aandelen in jouw wallet `JPmYxhBGqt9GMe6kfozUce3EyQRAoQZD1hbLGWJR8T6`, vergrendeld (lock-up).
- **Reserve ronde 2:** 40.000.000 aandelen achter een aparte, offline sleutel, ook vergrendeld.
- **Herstelsleutel (offline):** kan aandelen van een verloren wallet na een identiteitscontrole overzetten. Elke inzet is publiek.
- **In Phantom of Solflare** zie je "Marketing Scan Aandeel" met het logo en het aantal. Geen eurokoers, want er is bewust geen beursnotering.

---

## 4. De geldstroom

```
Investeerder ──(EURC, of tEUR op testnet)──► escrow op de blockchain (publiek zichtbaar)
     ▲                                              │
     └──── aandelen uit de verkoopkluis ◄───────────┘   (in dezelfde transactie)

Einde ronde:
  minimumdoel gehaald     → escrow vrijgegeven aan de treasury   (scripts/solana/vrijgeven.mjs)
  minimumdoel niet gehaald → iedereen terugbetaald, aandelen terug (scripts/solana/terugbetalen.mjs)
```

- De investeerder heeft **geen SOL** nodig: de transactiekosten betaalt het platform.
- **Treasury:** voor de echte ronde een Squads-multisig (2 van 3 handtekeningen), met jouw wallet als een van de ondertekenaars en een onafhankelijke derde. Nooit je persoonlijke wallet.
- **Betaalmunt:** EURC, de euro-stablecoin van Circle (1:1 inwisselbaar voor euro). Op het testnet: tEUR zonder waarde.

---

## 5. Uitbetalen in crypto

Als er winst is en de algemene vergadering beslist uit te keren:

1. **Momentopname** van alle tokenhouders op een vaste datum (publiek, met de lijst als bestand).
2. **Berekening** per houder: aandelen × bedrag per aandeel. Bij een BV wordt de roerende voorheffing (standaard 30%) ingehouden en afgedragen.
3. **Uitbetaling** in EURC rechtstreeks naar elke wallet, in batches vanuit de treasury-multisig.
4. **Bewijs:** elke uitbetaling heeft een publieke transactie. In de portefeuille verschijnt ze onder "Uitkeringen".

Voorwaarde: de houders zijn geïdentificeerd (KYC), want uitkeringen en belastingen moeten aan een persoon gekoppeld kunnen worden.

---

## 6. Juridisch kader (België)

| Totaal over 12 maanden | Wat nodig is | Ronde |
|---|---|---|
| Max €500.000 **en** max €5.000 per belegger | De minimis: geen prospectus, geen informatienota. Totaalbedrag en maximum per persoon in elk document vermelden. | Ronde 1 (€45.000) |
| Tot €12.000.000 | Informatienota (max 15 A4-pagina's), uiterlijk bij de start neergelegd bij de FSMA. | Ronde 2 (€500.000), tenzij ze meer dan 12 maanden na ronde 1 valt én max €5.000 per persoon vraagt |
| Meer dan €12.000.000 | Prospectus | n.v.t. |

- Ronde 2 brengt het totaal over 12 maanden boven €500.000 (€45.000 + €500.000). Dan is een informatienota nodig, maar mag het maximum per persoon weg.
- **Tax shelter** (30 tot 45% belastingvermindering voor investeerders) vraagt rechtstreekse nieuwe aandelen in een BV, betaald in geld. Met betaling in crypto is dat waarschijnlijk uitgesloten. Laat je boekhouder dit bekijken.
- **Reclame** (posts, site, mails) moet evenwichtig zijn en de risico's tonen. Het X-systeem dwingt dat af (zie `docs/x-promotie.md`).
- **KYC:** voor de echte ronde moet je weten wie je aandeelhouders zijn (bv. via itsme). Dat is ook nodig om de limiet "per persoon" te handhaven en om uit te keren.
- De FSMA heeft een gratis **FinTech-contactpunt**. Leg het project daar vóór de start voor.

---

## 7. Wat we bouwen met het geld

| Module | Status |
|---|---|
| Marketingscan en SEO-analyse (30+ controlepunten, zichtbaarheid in Google en AI-assistenten) | live |
| Volledige SEO-suite (zoekwoorden, posities, concurrenten, backlinks) | gepland |
| E-mailmarketing (nieuwsbrieven, automatische mails) | gepland |
| Social posting (plannen en publiceren op alle kanalen) | gepland |

Publiceer vóór de start een bestedingsplan per ronde, en rapporteer elk kwartaal begroot versus werkelijk.

---

## 8. Wat er al werkt

- **Website** met overzicht, investeren, portefeuille, transparantie en privacy, in de huisstijl van Marketing Scan. Zie `web/`.
- **Inloggen met je wallet** (Phantom, Solflare, Backpack, ...). Op gsm met een link om de site in de Phantom-app te openen.
- **Portefeuille:** aantal aandelen, percentage, indicatieve waarde, status, aankopen met link naar de blockchain. Elk adres is ook alleen-lezen te bekijken.
- **Investeren vanaf €1** met live controle van minimum, maximum per persoon, saldo en beschikbare aandelen.
- **Transparantiepagina** die live controleert: vaste voorraad, ingetrokken muntrecht, vergrendelde oprichter en reserve, kluis, escrow, laatste aankopen en alle adressen.
- **Getest:** 84 automatische tests, waarvan 7 op een echte Solana-keten, plus een browsertest die de volledige aankoop doorloopt.

---

## 9. Risico's

- **Ondernemingsrisico:** zonder betalende klanten kan het mislukken. Investeerders kunnen alles verliezen.
- **Juridisch:** zonder BV en zonder de juiste documenten mag de echte ronde niet starten.
- **Waardering:** ambitieus voor de huidige cijfers.
- **Technisch:** de serversleutel betaalt kosten en beheert de verkoopkluis. Ze kan geen aandelen bijmaken en geen aandelen van investeerders wegnemen, maar ze moet goed beveiligd worden. Voor de echte ronde: een geaudit escrow-programma of een multisig, zodat terugbetalen niet van één sleutel afhangt.
- **Reputatie:** crypto roept bij veel mensen "scam" op. Daarom de live controles en een toon zonder hype.

---

## 10. Volgende stappen

1. **Testnet online zetten:** test-SOL naar de serversleutel, daarna zet ik de token op devnet en de site op Vercel.
2. **BV oprichten** (notaris, financieel plan) en de bedrijfsgegevens invullen in `shared/bedrijf.json`.
3. **Advocaat en boekhouder:** structuur, rechten van tokenhouders, uitkeringen, belastingen, de-minimisdocumenten.
4. **Onafhankelijke waardering** voor de prijs van ronde 1.
5. **KYC** kiezen (bv. itsme) en inbouwen.
6. **Treasury** als Squads-multisig met een onafhankelijke medeondertekenaar.
7. **Mainnet:** pas na groen licht van de advocaat, met EURC als betaalmunt.

---

## Bronnen

- FSMA, [Wanneer een prospectus en wanneer een informatienota?](https://www.fsma.be/nl/faq/1-welke-gevallen-moet-er-een-prospectus-worden-gepubliceerd-en-welke-gevallen-een)
- FSMA, [Vragen en antwoorden over aanbiedingen aan het publiek](https://www.fsma.be/nl/faq/vragen-en-antwoorden-regels-over-de-aanbiedingen-aan-het-publiek-van-beleggingsinstrumenten)
- FSMA, [Nieuwe prospectusdrempel](https://www.fsma.be/en/news/new-prospectus-threshold-offers-securities-public) (27/05/2026)
- FSMA, [FinTech-contactpunt](https://www.fsma.be/en/node/7520)
- VLAIO, [Tax Shelter voor startende ondernemingen](https://www.vlaio.be/nl/subsidies-financiering/subsidiedatabank/tax-shelter-voor-startende-ondernemingen)
- Circle, [EURC op Solana](https://circle.com/pressroom/eurc-launches-on-solana)
