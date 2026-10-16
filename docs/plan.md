# Marketing Scan Genesis: plan

> Status: **werkende demo op een lokale Solana-keten, klaar voor het testnet.** Er wordt niets verkocht voor je boekhouder de rechtsvorm en de btw heeft bekeken. Dit document is geen juridisch of fiscaal advies: neem het mee naar dat gesprek.

## In het kort

Marketing Scan haalt geen geld op met aandelen. Je verkoopt vooraf **levenslange abonnementen** aan je eerste klanten. Juridisch is dat een gewone voorverkoop, geen investering.

| Pakket | Wat je krijgt | Prijs | Aantal | Opbrengst als alles weg is |
|---|---|---|---|---|
| **Genesis Pass** | Levenslang Marketing Scan Pro voor 1 website | €99 tot €299, per 50 passes €50 duurder | 250 | €49.750 |
| **Genesis Agency** | Levenslang Pro voor tot 10 websites, support bij de oprichter | €799 | 25 | €19.975 |
| **Supporter** | Badge en naam op de Genesis-muur, geen abonnement | vanaf €1 | onbeperkt | vrij |

**Doel: €50.000.** De passes alleen halen dat bijna; Agency en supporters maken het verschil.

Alles staat in één bestand: `shared/genesis.json`. Prijzen, aantallen, voordelen en het doel pas je daar aan; site, server, tests en X-posts volgen automatisch.

---

## 1. Waarom geen aandelen meer

Een aanbod van aandelen valt onder de FSMA: documenten, een waardering, KYC, een vennootschap en reclameregels. Dat is zwaar voor €50.000, en "word mede-eigenaar via crypto" roept bij veel mensen meteen "scam" op.

Een voorverkoop van je eigen product is eenvoudiger en eerlijker:

- **Je verkoopt wat je hebt.** Marketing Scan werkt vandaag al. Een pass geeft meteen toegang en later alles wat erbij komt.
- **Geen rendement, geen doorverkoop.** De passes zijn *soulbound* (niet overdraagbaar). Niemand koopt er een om er winst mee te maken, dus het is geen belegging.
- **Wat de boekhouder of advocaat best bevestigt:** onder MiCA (de Europese crypto-verordening) vallen unieke, niet-vervangbare tokens buiten de regels (art. 2.3), en een token die enkel toegang geeft tot een dienst die al bestaat, is vrijgesteld van een white paper (art. 4.3). Een token die niet overdraagbaar is, valt bovendien moeilijk onder de definitie van een crypto-activum. Elke Genesis Pass is een eigen token met voorraad 1, voor een dienst die al werkt, en kan je wallet niet verlaten.

Daarom bewaakt het X-systeem ook dat er nooit beleggingstaal in een post komt (zie `docs/x-promotie.md`).

---

## 2. Waarom dit werkt op X

Wat crypto-mensen op X overtuigt, is bewijs, schaarste en erbij horen. Zonder hype:

- **Een nummer.** "#007" in je wallet is iets om te tonen. Na elke aankoop staat er een knop "Deel op X" met een kant-en-klare post.
- **Echte schaarste, eerlijk getoond.** 250 passes, de prijsladder ligt vast en staat op de site. Het nummer bepaalt de prijs, geen kortingscodes.
- **Controleerbaar.** Elke pass, elke euro en elke terugbetaling staat publiek op Solana. De site rekent het live na, en met één knop rekent je eigen browser alles opnieuw uit.
- **Geld terug met één klik.** Binnen 14 dagen verdwijnt je pass en staat je geld terug in je wallet, in dezelfde transactie. Dat neemt de grootste drempel weg.
- **De Genesis-muur.** Iedereen die meedoet, komt erop met de naam die die zelf kiest (bv. een X-handle).
- **Building in public.** De site toont je echte cijfers (10 wekelijkse gebruikers, 0 betalende klanten). Dat eerlijke vertrekpunt maakt het verhaal geloofwaardig.

---

## 3. Hoe het werkt

1. Iemand logt in met een Solana-wallet (Phantom, Solflare, Backpack) en kiest een pass.
2. De server bereidt één transactie voor: de munt van het volgende nummer wordt aangemaakt, de pass gaat naar de koper, het muntrecht wordt ingetrokken (er kan nooit een tweede #007 bestaan) en de betaling gaat naar de kas. De koper ondertekent in de eigen wallet. Transactiekosten en opslag betaal jij: minder dan 0,01 SOL per pass.
3. Op Mijn pass activeert de koper de pass met een gratis handtekening en krijgt een code (bv. `MSGEN-007-K7QD-2MXP`). Die code vul je later in Marketing Scan in om Pro te geven.
4. Binnen 14 dagen kan de koper met één klik geld terugvragen.

Details: [technisch-ontwerp.md](technisch-ontwerp.md).

---

## 4. Het geld

- **De kas** is een publieke rekening op Solana. Elke betaling komt daar binnen, met een vaste memo ("Marketing Scan Genesis Pass #007").
- **Buffer voor terugbetalingen:** aankopen van de laatste 14 dagen blijven in de kas. Het script `scripts/solana/opnemen.mjs` stuurt enkel de rest naar je eigen wallet, ook met een memo. Zo is elke terugbetaling altijd gedekt, en ziet iedereen wanneer jij geld opneemt.
- **Betaalmunten:** op het testnet tEUR en tUSD (zonder waarde), op mainnet EURC en USDC (de stablecoins van Circle op Solana). Prijzen staan in euro; in USDC betaal je aan de ECB-koers van de dag. Van EURC of USDC naar je bankrekening gaat via een exchange zoals Bitvavo of Kraken.
- **Supporters** betalen ook in de kas. Steun is een gift en wordt niet terugbetaald.

---

## 5. Met de boekhouder bespreken

Neem deze vragen mee. De antwoorden bepalen wanneer je `verkoopActief` op `true` mag zetten.

### Rechtsvorm
- **Eenmanszaak of BV?** Voor de verkoop heb je sowieso een ondernemingsnummer nodig (inschrijving in de KBO via een ondernemingsloket) en een statuut als zelfstandige (in bijberoep of hoofdberoep).
- Bij een eenmanszaak wordt de opbrengst belast als beroepsinkomen, progressief tot 50%. €50.000 in één jaar is dan duur. Vraag of de opbrengst gespreid kan worden (vooraf ontvangen inkomsten voor een dienst die jaren loopt), en of een BV daarom voordeliger is.

### Btw
- Software als dienst valt onder 21% btw.
- De **vrijstellingsregeling voor kleine ondernemingen** geldt tot €25.000 omzet per jaar. Met een doel van €50.000 ga je daar waarschijnlijk over, dus reken op btw-plicht.
- Btw is verschuldigd bij een **vooruitbetaling**, dus op het moment dat iemand een pass koopt, niet pas wanneer Pro gebruikt wordt.
- De prijzen op de site zijn **eindprijzen**. Met 21% btw houd je van €99 ongeveer €81,82 over. Wil je €99 netto, verhoog dan de prijsladder in `shared/genesis.json`.
- Klanten in andere EU-landen: bij bedrijven verlegging van btw, bij consumenten mogelijk btw van hun land (OSS-regeling). Vraag of je de verkoop eerst tot België wil beperken.
- Betaling in EURC of USDC verandert niets aan de btw: die wordt berekend op de waarde in euro (die staat bij elke aankoop in de memo op de keten).

### Consumentenrecht
- **Herroepingsrecht:** consumenten mogen een online aankoop binnen 14 dagen herroepen. De geld-terug-knop doet dat automatisch, ook voor bedrijven.
- **Informatieplicht:** naam, adres, ondernemingsnummer en e-mail moeten op de site staan vóór je verkoopt. Vul ze in `shared/bedrijf.json` in; een build voor mainnet of met verkoopActief faalt zolang ze ontbreken.
- **Voorwaarden:** een concept staat op `/voorwaarden` (levenslang = zolang de dienst bestaat, normaal gebruik, geen investering, 6 maanden vooraf verwittigen als Marketing Scan stopt, aansprakelijkheid beperkt tot de prijs behalve bij bedrog of opzet). Laat het nalezen.

### Overige
- **Facturen:** bedrijven willen een factuur. Leg vast hoe (bv. een formulier na de aankoop dat een factuur maakt in je boekhoudpakket).
- **Steun als gift:** voor jou is het waarschijnlijk gewoon inkomen; voor de gever is het niet fiscaal aftrekbaar.
- **Crypto in de boekhouding:** de kas is een publiek kasboek. Exporteer het per kwartaal uit de transparantiepagina.

---

## 6. Wat er al werkt

- **Website** (`web/`): overzicht met live stand, de drie pakketten, prijsladder, uitleg, eerlijke cijfers, live controles, Genesis-muur en vragen; claimpagina; Mijn pass met activeren en geld terug; transparantie met kasboek en controle in de browser; voorwaarden; privacy. Werkt op gsm.
- **Op de keten** (`server/genesis.js`): genummerde soulbound passes, prijs per nummer, maximum per wallet, steun met badge, geld terug in één transactie, activatiecodes, opnames met buffer.
- **API** (`api/`): stand, kopen, geld terug, activeren (plus een controle-adres voor Marketing Scan), testgeld, wachtlijst.
- **X-promotie** (`marketing/x/`): 14 concept-posts plus een wekelijkse update, met controles op beleggingstaal en een slot zolang de verkoop niet open is.
- **Getest:** 165 automatische tests, waarvan 14 op een echte Solana-keten, en een browsertest die de volledige weg aflegt: inloggen, pass claimen, activeren, steunen, alles nakijken en geld terug.

---

## 7. Risico's, eerlijk

- **Levenslang is lang.** 275 klanten die nooit meer betalen, kosten je servers en support. Het maximum van 250 plus 25 houdt dat beheersbaar. Hou de kosten per gebruiker in het oog.
- **Leveren.** Wie nu koopt, rekent op de SEO-suite, mailings en social posting. Publiceer een roadmap met data en rapporteer elke maand.
- **De serversleutel** maakt passen aan en beheert de kas. Ze kan geen passen afpakken of bevriezen, maar wie ze steelt, kan de kas leeghalen. Daarom: de kas regelmatig opnemen naar je eigen wallet (enkel de buffer van 14 dagen blijft staan), de sleutel enkel in Vercel en je wachtwoordbeheerder.
- **Je eigen wallet** ontvangt de opnames. Gebruik op mainnet een hardware-wallet of een Squads-multisig.
- **Interpretatie.** Of iets "geen investering" is, beslist uiteindelijk de toezichthouder. Soulbound, geen rendement en geen beleggingstaal maken het sterk, maar laat het bevestigen.

---

## 8. Volgende stappen

1. **Boekhouder:** rechtsvorm, btw, spreiding van de opbrengst (neem hoofdstuk 5 mee).
2. **Ondernemingsnummer** aanvragen en `shared/bedrijf.json` invullen.
3. **Voorwaarden** laten nalezen.
4. **Testnet online:** stuur devnet-SOL naar de serversleutel `9ZLJxhmEDFiDJ8VkMU43QoWXrSY22ZusYnw5BhyL95M9` (via faucet.solana.com), daarna zet ik Genesis op devnet en de site op Vercel.
5. **X opstarten** tijdens de testfase: posts goedkeuren, publiek opbouwen, wachtlijst laten groeien.
6. **Marketing Scan:** een veld voor de activatiecode dat `GET /api/activeer?code=...` aanroept en Pro geeft.
7. **Mainnet:** EURC en USDC als betaalmunten, verkoopActief en legalReviewDone op `true`, en starten.

---

## Bronnen

- Verordening (EU) 2023/1114 betreffende markten in crypto-activa (MiCA), [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2023/1114/oj)
- Accountable, [Wanneer word je btw-plichtig: de drempel van €25.000](https://www.accountable.eu/nl-be/help-center/wanneer-wordt-een-zelfstandige-btw-plichtig-in-belgie-jouw-complete-gids-over-de-drempel-van-e25-000/)
- Accountable, [De btw-vrijstelling voor kleine ondernemingen](https://www.accountable.eu/nl-be/help-center/alles-wat-je-moet-weten-over-de-status-van-btw-vrijstelling-voor-kleine-ondernemingen/)
- Practicali, [Kleine ondernemingsregeling: nieuwe omzetmelding](https://www.practicali.be/blog/kleine-ondernemingsregeling-nieuwe-omzetmelding-via-de-klantenlisting-uiterlijk-op-31-maart-2026)
- Unizo, [Wat is er nieuw in 2025](https://www.unizo.be/berichten/nieuws/nieuw-2025)
- Circle, [EURC op Solana](https://circle.com/pressroom/eurc-launches-on-solana)
