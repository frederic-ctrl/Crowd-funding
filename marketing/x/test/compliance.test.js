import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPost, hasErrors, aboutGenesis, saleLive, CATEGORIES, ABOUT_GENESIS } from "../src/compliance.js";

const config = {
  offer: {
    verkoopActief: false,
    legalReviewDone: false,
    required: "Geen investering",
    noticeWhenNotLive: "Nog geen verkoop",
    voorwaardenUrl: "https://community.marketingscan.be/voorwaarden",
  },
  links: { allowedDomains: ["marketingscan.be", "explorer.solana.com"] },
  maxHashtags: 2,
};
const withOffer = (offer) => ({ ...config, offer: { ...config.offer, ...offer } });
const live = withOffer({ verkoopActief: true, legalReviewDone: true });

const rules = (issues) => issues.filter((i) => i.niveau === "fout").map((i) => i.regel);
const OK = " Geen investering. Nog geen verkoop.";

test("categorieën", () => {
  assert.deepEqual(CATEGORIES, ["product", "genesis", "uitleg", "transparantie", "verkoop"]);
  assert.deepEqual([...ABOUT_GENESIS], ["genesis", "uitleg", "transparantie", "verkoop"]);
});

test("een nette productpost gaat door", () => {
  const issues = checkPost({ categorie: "product", tekst: "Gratis scan van je website. https://www.marketingscan.be" }, config);
  assert.deepEqual(issues, []);
});

test("productpost over Genesis moet een andere categorie krijgen", () => {
  for (const tekst of ["Binnenkort: de Genesis Pass.", "Verbind je wallet.", "Levenslang Pro voor 1 website.", "Geen aandelen, wel een scan."]) {
    assert.ok(rules(checkPost({ categorie: "product", tekst }, config)).includes("categorie"), tekst);
  }
});

test("Genesis-post zonder vermeldingen wordt geblokkeerd", () => {
  const r = rules(checkPost({ categorie: "genesis", tekst: "De Genesis Pass komt eraan." }, config));
  assert.ok(r.includes("disclaimer-ontbreekt"));
  assert.ok(r.includes("vermelding-ontbreekt"));
});

for (const categorie of ["genesis", "uitleg", "transparantie"]) {
  test(`categorie ${categorie}: "Geen investering" en "Nog geen verkoop" zijn verplicht`, () => {
    const zonderDisclaimer = rules(checkPost({ categorie, tekst: "Over Marketing Scan. Nog geen verkoop." }, config));
    assert.ok(zonderDisclaimer.includes("disclaimer-ontbreekt"));
    assert.equal(zonderDisclaimer.includes("vermelding-ontbreekt"), false);
    const zonderVermelding = rules(checkPost({ categorie, tekst: "Over Marketing Scan. Geen investering." }, config));
    assert.ok(zonderVermelding.includes("vermelding-ontbreekt"));
    assert.equal(zonderVermelding.includes("disclaimer-ontbreekt"), false);
    assert.equal(hasErrors(checkPost({ categorie, tekst: `Over Marketing Scan.${OK}` }, config)), false);
  });
}

test("vermeldingen werken ongeacht hoofdletters en typografische tekens", () => {
  const tekst = "Je Genesis Pass, uitgelegd. GEEN INVESTERING. nog geen verkoop.";
  assert.equal(hasErrors(checkPost({ categorie: "uitleg", tekst }, config)), false);
});

test("zonder vermeldingen in config gelden de standaardteksten", () => {
  const bare = { ...config, offer: { verkoopActief: false, legalReviewDone: false } };
  const r = rules(checkPost({ categorie: "genesis", tekst: "De Genesis Pass." }, bare));
  assert.ok(r.includes("disclaimer-ontbreekt"));
  assert.ok(r.includes("vermelding-ontbreekt"));
  assert.equal(hasErrors(checkPost({ categorie: "genesis", tekst: `De Genesis Pass.${OK}` }, bare)), false);
});

// Investeringstaal, in het Nederlands en het Engels.
for (const tekst of [
  "Investeer in Marketing Scan.",
  "Een slimme investering voor de toekomst.",
  "Word investeerder van het eerste uur.",
  "Een mooie belegging.",
  "Join the early investors.",
  "A great investment opportunity.",
  "Invest in the future of SEO.",
  "Je krijgt aandelen in je wallet.",
  "Eén pass is een aandeel in de toekomst.",
  "Get shares of Marketing Scan.",
  "Own equity in a growing tool.",
  "Word mede-eigenaar vanaf €1.",
  "Become a co-owner today.",
  "Mooi rendement op je pass.",
  "Strong returns for holders.",
  "Hoge ROI, mooie APY en APR.",
  "Real yield for early supporters.",
  "Deel in de winst van Marketing Scan.",
  "Share in the profit.",
  "Jaarlijks een dividend.",
  "Een onafhankelijke waardering van Marketing Scan.",
  "Our valuation keeps rising.",
  "Je pass wordt meer waard.",
  "Je pass stijgt in waarde.",
  "De waarde van je pass zal stijgen.",
  "Watch the value go up.",
  "Je kan je pass later doorverkopen.",
  "Resell your pass anytime.",
  "Flip it on day one.",
  "Trade it on the secondary market.",
  "Je pass is vrij verhandelbaar.",
  "Speculeer mee op Genesis.",
  "Genesis gaat to the moon.",
  "Wen lambo.",
  "Pump it.",
  "Wagmi.",
  "Time to ape in.",
  "Hodl je pass.",
  "Dit wordt 10x.",
  "100x potential.",
  "Tien keer je geld terug.",
  "Gegarandeerd succes.",
  "Guaranteed results.",
  "De presale start.",
  "Onze ICO komt eraan.",
  "IDO volgende week.",
  "De token sale begint.",
  "Gratis airdrop voor de wachtlijst.",
  "Schrijf je in voor de whitelist.",
  "8% rendement per jaar.",
  "Laatste kans om mee te doen.",
  "Nu of nooit.",
  "Fomo is echt.",
  "Haast je.",
  "Op is op.",
]) {
  test(`verboden taal wordt geblokkeerd: ${tekst}`, () => {
    assert.ok(rules(checkPost({ categorie: "genesis", tekst: `${tekst}${OK}` }, config)).includes("verboden-taal"), tekst);
  });
}

test("cashtags worden geblokkeerd", () => {
  assert.ok(rules(checkPost({ categorie: "genesis", tekst: `Volg $MSGEN.${OK}` }, config)).includes("cashtag"));
});

// Ontkenningen zijn toegestaan, maar enkel vlak voor het woord.
for (const tekst of [
  "Geen investering. Nog geen verkoop.",
  "Dit is geen investering, wel een abonnement. Geen investering. Nog geen verkoop.",
  "Not an investment. Geen investering. Nog geen verkoop.",
  "This is not an investment. Geen investering. Nog geen verkoop.",
  "Je koopt geen aandelen en geen rendement. Geen investering. Nog geen verkoop.",
  "No shares, no equity. Geen investering. Nog geen verkoop.",
  "Je pass is van jou en niet verhandelbaar, dus geen speculatie. Geen investering. Nog geen verkoop.",
  "Je kan je pass niet doorverkopen. Geen investering. Nog geen verkoop.",
  "Marketing Scan is nog niet winstgevend. Geen investering. Nog geen verkoop.",
  "Succes is niet gegarandeerd, dat zeggen we eerlijk. Geen investering. Nog geen verkoop.",
]) {
  test(`ontkenning is toegestaan: ${tekst}`, () => {
    const issues = checkPost({ categorie: "uitleg", tekst }, config);
    assert.equal(rules(issues).includes("verboden-taal"), false, JSON.stringify(issues));
  });
}

test("een ontkenning verderop in de zin dekt het woord niet", () => {
  for (const tekst of ["Geen gedoe, wel rendement.", "Geen investering, maar wel een investering in je bedrijf."]) {
    assert.ok(rules(checkPost({ categorie: "uitleg", tekst: `${tekst}${OK}` }, config)).includes("verboden-taal"), tekst);
  }
});

test("feiten over de prijsladder zijn toegestaan", () => {
  for (const zin of [
    "De prijs stijgt per 50 verkochte passes.",
    "Vroeger instappen is goedkoper.",
    "#001 tot #050 kost €99, daarna €149, €199, €249 en €299.",
    "De prijs gaat naar €149 vanaf pass #051.",
    "Pass #201 tot #250 kost €299.",
  ]) {
    const issues = checkPost({ categorie: "genesis", tekst: `De Genesis Pass. ${zin}${OK}` }, config);
    assert.deepEqual(issues, [], `${zin}: ${JSON.stringify(issues)}`);
  }
});

test("passnummers tellen niet als hashtag, echte hashtags wel", () => {
  const nummers = checkPost({ categorie: "genesis", tekst: `Genesis Agency: #01 tot #25, Genesis Pass: #001 tot #250.${OK}` }, config);
  assert.equal(rules(nummers).includes("hashtags"), false);
  assert.ok(rules(checkPost({ categorie: "product", tekst: "Scan #seo #kmo #marketing" }, config)).includes("hashtags"));
});

test("geen koopoproep zolang de verkoop niet live is", () => {
  for (const zin of [
    "Koop nu je Genesis Pass.",
    "Claim nu je nummer.",
    "Claim je pass.",
    "Bestel nu.",
    "Koop je Genesis Pass vandaag.",
    "Buy now.",
    "Mint now.",
    "Claim yours today.",
    "Word supporter vanaf €1.",
    "De voorverkoop is nu open.",
  ]) {
    const r = rules(checkPost({ categorie: "genesis", tekst: `${zin}${OK}` }, config));
    assert.ok(r.includes("koopoproep"), zin);
  }
});

test("de demo op het testnet uitleggen is geen koopoproep", () => {
  const tekst = `Probeer Genesis nu al uit op het Solana-testnet: verbind je wallet en maak een testpass aan, zonder echt geld.${OK}`;
  assert.equal(hasErrors(checkPost({ categorie: "uitleg", tekst }, config)), false);
});

test("categorie verkoop: geblokkeerd tot verkoopActief en legalReviewDone allebei true zijn", () => {
  const tekst = "Koop nu je Genesis Pass. Geen investering. https://community.marketingscan.be/voorwaarden";
  for (const offer of [{}, { verkoopActief: true }, { legalReviewDone: true }]) {
    const cfg = withOffer(offer);
    assert.equal(saleLive(cfg), false);
    assert.ok(rules(checkPost({ categorie: "verkoop", tekst }, cfg)).includes("verkoop-gesloten"), JSON.stringify(offer));
  }
  const issues = checkPost({ categorie: "verkoop", tekst }, live);
  assert.equal(saleLive(live), true);
  assert.equal(hasErrors(issues), false, JSON.stringify(issues));
});

test("live: koopoproepen enkel in categorie verkoop", () => {
  const tekst = "Koop nu je Genesis Pass. Geen investering.";
  assert.ok(rules(checkPost({ categorie: "genesis", tekst }, live)).includes("koopoproep"));
});

test("live: verkooppost zonder disclaimer of voorwaarden wordt geblokkeerd", () => {
  const r = rules(checkPost({ categorie: "verkoop", tekst: "Koop nu je Genesis Pass." }, live));
  assert.ok(r.includes("disclaimer-ontbreekt"));
  assert.ok(r.includes("voorwaarden"));
  const leeg = withOffer({ verkoopActief: true, legalReviewDone: true, voorwaardenUrl: "" });
  assert.ok(rules(checkPost({ categorie: "verkoop", tekst: "Koop nu. Geen investering." }, leeg)).includes("voorwaarden"));
});

test("live: verbodstaal blijft verboden en 'Nog geen verkoop' geeft een waarschuwing", () => {
  assert.ok(rules(checkPost({ categorie: "genesis", tekst: "Mooi rendement. Geen investering." }, live)).includes("verboden-taal"));
  const issues = checkPost({ categorie: "genesis", tekst: `De Genesis Pass.${OK}` }, live);
  assert.equal(hasErrors(issues), false);
  assert.ok(issues.some((i) => i.regel === "vermelding-verouderd" && i.niveau === "waarschuwing"));
});

test("onbekende links worden geblokkeerd", () => {
  assert.ok(rules(checkPost({ categorie: "product", tekst: "Kijk op https://example.com" }, config)).includes("link"));
});

test("te lange post wordt geblokkeerd", () => {
  assert.ok(rules(checkPost({ categorie: "product", tekst: "a".repeat(281) }, config)).includes("lengte"));
});

test("onbekende categorie wordt geblokkeerd", () => {
  for (const categorie of ["ronde", "aanbod", "x"]) {
    assert.ok(rules(checkPost({ categorie, tekst: "Gratis scan." }, config)).includes("categorie"), categorie);
  }
});

test("Genesis-woorden worden herkend", () => {
  assert.equal(aboutGenesis("Binnenkort de Genesis Pass"), true);
  assert.equal(aboutGenesis("Verbind je wallet op Solana"), true);
  assert.equal(aboutGenesis("Steun ons als supporter"), true);
  assert.equal(aboutGenesis("Je website is traag"), false);
});

test("stijlwaarschuwingen blokkeren niet", () => {
  const issues = checkPost({ categorie: "product", tekst: "SUPER GOEDE SCAN!! 🚀🚀🚀 @iemand" }, config);
  assert.equal(hasErrors(issues), false);
  const regels = issues.map((i) => i.regel);
  for (const r of ["hoofdletters", "uitroeptekens", "emoji", "vermelding"]) assert.ok(regels.includes(r), r);
});
