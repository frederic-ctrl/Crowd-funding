import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPost,
  hasErrors,
  aboutGenesis,
  saleLive,
  offerTexts,
  postLang,
  CATEGORIES,
  ABOUT_GENESIS,
  LANGS,
  DEFAULT_LANG,
} from "../src/compliance.js";

// Zelfde vorm als config.json. De Nederlandse tests hieronder draaien met standaardtaal nl,
// de Engelse tests verderop met standaardtaal en.
const config = {
  defaultLang: "nl",
  offer: {
    verkoopActief: false,
    legalReviewDone: false,
    required: { en: "Not an investment", nl: "Geen investering" },
    noticeWhenNotLive: { en: "Not on sale yet", nl: "Nog geen verkoop" },
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

// ---------------------------------------------------------------------------------------------
// Talen: Engels is de standaard, Nederlands per post met lang: "nl".

const en = { ...config, defaultLang: "en" };
const enLive = { ...live, defaultLang: "en" };
const EN_OK = " Not an investment. Not on sale yet.";

test("talen: en en nl, Engels is de standaard", () => {
  assert.deepEqual(LANGS, ["en", "nl"]);
  assert.equal(DEFAULT_LANG, "en");
  assert.equal(postLang({}, {}), "en");
  assert.equal(postLang({}, { defaultLang: "nl" }), "nl");
  assert.equal(postLang({ lang: "nl" }, { defaultLang: "en" }), "nl");
  assert.deepEqual(offerTexts(en, "en"), { required: "Not an investment", notice: "Not on sale yet" });
  assert.deepEqual(offerTexts(en, "nl"), { required: "Geen investering", notice: "Nog geen verkoop" });
});

test("de meegeleverde config.json is Engels eerst, met vermeldingen per taal", async () => {
  const { readFileSync } = await import("node:fs");
  const shipped = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
  assert.equal(shipped.defaultLang, "en");
  assert.deepEqual(shipped.offer.required, { en: "Not an investment", nl: "Geen investering" });
  assert.deepEqual(shipped.offer.noticeWhenNotLive, { en: "Not on sale yet", nl: "Nog geen verkoop" });
});

for (const categorie of ["genesis", "uitleg", "transparantie"]) {
  test(`Engels, categorie ${categorie}: "Not an investment" en "Not on sale yet" zijn verplicht`, () => {
    const noDisclaimer = rules(checkPost({ categorie, tekst: "About Marketing Scan. Not on sale yet." }, en));
    assert.ok(noDisclaimer.includes("disclaimer-ontbreekt"));
    assert.equal(noDisclaimer.includes("vermelding-ontbreekt"), false);
    const noNotice = rules(checkPost({ categorie, tekst: "About Marketing Scan. Not an investment." }, en));
    assert.ok(noNotice.includes("vermelding-ontbreekt"));
    assert.equal(noNotice.includes("disclaimer-ontbreekt"), false);
    assert.equal(hasErrors(checkPost({ categorie, tekst: `About Marketing Scan.${EN_OK}` }, en)), false);
  });
}

test("Engels: de vermelding moet in de taal van de post staan", () => {
  const dutchInEnglish = rules(checkPost({ categorie: "genesis", tekst: `The Genesis Pass.${OK}` }, en));
  assert.ok(dutchInEnglish.includes("disclaimer-ontbreekt"));
  assert.ok(dutchInEnglish.includes("vermelding-ontbreekt"));
  const englishInDutch = rules(checkPost({ categorie: "genesis", lang: "nl", tekst: `De Genesis Pass.${EN_OK}` }, en));
  assert.ok(englishInDutch.includes("disclaimer-ontbreekt"));
  assert.equal(hasErrors(checkPost({ categorie: "genesis", lang: "nl", tekst: `De Genesis Pass.${OK}` }, en)), false);
  const msg = checkPost({ categorie: "genesis", tekst: "The Genesis Pass." }, en).map((i) => i.bericht).join(" ");
  assert.match(msg, /"Not an investment"/);
  assert.match(msg, /"Not on sale yet"/);
});

test("Engels: hoofdletters maken niet uit", () => {
  assert.equal(hasErrors(checkPost({ categorie: "uitleg", tekst: "Your Genesis Pass. NOT AN INVESTMENT. not on sale yet." }, en)), false);
});

test("zonder defaultLang in config geldt Engels, ook voor de standaardteksten", () => {
  const { defaultLang, ...noDefault } = config;
  const bare = { ...noDefault, offer: { verkoopActief: false, legalReviewDone: false } };
  assert.equal(defaultLang, "nl");
  assert.equal(hasErrors(checkPost({ categorie: "genesis", tekst: `The Genesis Pass.${EN_OK}` }, bare)), false);
  assert.ok(rules(checkPost({ categorie: "genesis", tekst: `De Genesis Pass.${OK}` }, bare)).includes("disclaimer-ontbreekt"));
});

test("onbekende taal wordt geblokkeerd", () => {
  for (const lang of ["fr", "EN", ""]) {
    assert.ok(rules(checkPost({ categorie: "product", lang, tekst: "Free scan." }, en)).includes("taal"), lang);
  }
  assert.ok(rules(checkPost({ categorie: "product", tekst: "Free scan." }, { ...en, defaultLang: "de" })).includes("taal"));
});

test("oude config met gewone strings blijft werken: de string telt als Nederlands", () => {
  const old = {
    ...config,
    defaultLang: undefined,
    offer: { ...config.offer, required: "Dit is geen investering", noticeWhenNotLive: "Verkoop nog niet open" },
  };
  assert.deepEqual(offerTexts(old, "nl"), { required: "Dit is geen investering", notice: "Verkoop nog niet open" });
  assert.deepEqual(offerTexts(old, "en"), { required: "Not an investment", notice: "Not on sale yet" });
  const nl = (tekst) => rules(checkPost({ categorie: "genesis", lang: "nl", tekst }, old));
  assert.deepEqual(nl("De Genesis Pass. Dit is geen investering. Verkoop nog niet open."), []);
  assert.ok(nl(`De Genesis Pass.${OK}`).includes("disclaimer-ontbreekt"));
  assert.deepEqual(rules(checkPost({ categorie: "genesis", tekst: `The Genesis Pass.${EN_OK}` }, old)), []);
});

// Engelse investeringstaal, hype, druk en crypto-verkooptermen.
for (const tekst of [
  "Invest early in Marketing Scan.",
  "A smart investment.",
  "Investors welcome.",
  "Own a piece of Marketing Scan.",
  "A share in the company.",
  "Shareholders get perks.",
  "Equity for early backers.",
  "Real yield.",
  "Revenue share for supporters.",
  "Staking rewards for holders.",
  "Strong profits ahead.",
  "Your pass will be worth more.",
  "Watch it go up in value.",
  "The value of your pass goes up every 50 passes.",
  "Massive upside.",
  "Market cap will grow.",
  "Price target: €1,000.",
  "This will skyrocket.",
  "Resell it later.",
  "Flip your pass.",
  "Trade it anytime.",
  "Fully tradable.",
  "Transferable to anyone.",
  "Sell it on OpenSea.",
  "Floor price rising.",
  "Listed on major exchanges soon.",
  "Coming to a DEX.",
  "We guarantee results.",
  "Risk-free.",
  "Zero risk.",
  "Nothing to lose.",
  "Passive income.",
  "Get rich.",
  "Financial freedom.",
  "Earn passive rewards.",
  "10x potential.",
  "Double your money.",
  "Ten times your money.",
  "12% a year.",
  "8% APY.",
  "To the moon.",
  "LFG.",
  "Diamond hands.",
  "Bullish on Genesis.",
  "Hidden gem.",
  "Limited time only.",
  "Act now.",
  "Only 12 passes left.",
  "Selling fast.",
  "Don't miss out.",
  "While supplies last.",
  "Join the presale.",
  "Pre-sale soon.",
  "Token sale soon.",
  "Airdrop for early users.",
  "Get on the whitelist.",
  "Allowlist spots.",
  "Fair launch.",
  "Free mint.",
]) {
  test(`Engelse verboden taal wordt geblokkeerd: ${tekst}`, () => {
    assert.ok(rules(checkPost({ categorie: "genesis", tekst: `${tekst}${EN_OK}` }, en)).includes("verboden-taal"), tekst);
  });
}

// Engelse ontkenningen vlak voor het woord zijn toegestaan.
for (const tekst of [
  "Not an investment.",
  "This is not an investment.",
  "This isn't an investment.",
  "No shares. No returns. No equity.",
  "Not transferable. No speculation.",
  "Non-transferable by design.",
  "Zero returns, zero equity. Just software.",
  "No guarantees, just honest numbers.",
  "You can't resell it.",
  "Without any equity.",
  "Never a security token.",
  "No trading, no floor price.",
  "We don't trade.",
]) {
  test(`Engelse ontkenning is toegestaan: ${tekst}`, () => {
    const issues = checkPost({ categorie: "uitleg", tekst: `Your Genesis Pass. ${tekst}${EN_OK}` }, en);
    assert.equal(rules(issues).includes("verboden-taal"), false, JSON.stringify(issues));
  });
}

test("Engels: een ontkenning verderop in de zin dekt het woord niet", () => {
  for (const tekst of [
    "Not an investment, but huge returns.",
    "No hype. Just returns.",
    "Not an investment. Great profit though.",
    "No shares, but you own a piece of it.",
  ]) {
    assert.ok(rules(checkPost({ categorie: "uitleg", tekst: `${tekst}${EN_OK}` }, en)).includes("verboden-taal"), tekst);
  }
});

test("Engels: feiten over de prijsladder zijn toegestaan", () => {
  for (const zin of [
    "The price rises every 50 passes.",
    "Earlier is cheaper.",
    "Your number sets your price.",
    "#001 to #050: €99. Then €149, €199, €249 and €299.",
    "The price moves to €149 from pass #051.",
    "Pass #201 to #250 costs €299.",
  ]) {
    const issues = checkPost({ categorie: "genesis", tekst: `The Genesis Pass. ${zin}${EN_OK}` }, en);
    assert.deepEqual(issues, [], `${zin}: ${JSON.stringify(issues)}`);
  }
});

test("Engels: geen koopoproep zolang de verkoop niet live is", () => {
  for (const zin of [
    "Buy now.",
    "Mint yours today.",
    "Claim yours today.",
    "Claim your Genesis Pass.",
    "Get yours today.",
    "Secure your spot.",
    "Grab a Genesis Pass.",
    "Buy a Genesis Pass.",
    "Reserve your number now.",
    "Lock in your price.",
    "Pre-order yours today.",
    "Become a supporter from €1.",
    "Become a founding member.",
    "Support us today.",
    "Join now.",
    "Get in early.",
    "The sale is now open.",
    "Early access is live.",
    "Mint opens today.",
    "Now on sale.",
  ]) {
    const r = rules(checkPost({ categorie: "genesis", tekst: `${zin}${EN_OK}` }, en));
    assert.ok(r.includes("koopoproep"), zin);
  }
});

test("Engels: dezelfde koopoproep wordt maar één keer gemeld", () => {
  const issues = checkPost({ categorie: "genesis", tekst: `Buy now.${EN_OK}` }, en).filter((i) => i.regel === "koopoproep");
  assert.equal(issues.length, 1);
});

test("Engels: de demo uitleggen en de scan aanbieden is geen koopoproep", () => {
  const demo = `Try the Genesis demo on Solana devnet: connect a wallet, pick up test euros and mint a test pass. Mint a test pass, refund it. No real money.${EN_OK}`;
  assert.deepEqual(checkPost({ categorie: "uitleg", tekst: demo }, en), []);
  const uitleg = `With a Genesis Pass you get lifetime Marketing Scan Pro. Why there's no sale yet: legal form first.${EN_OK}`;
  assert.deepEqual(checkPost({ categorie: "uitleg", tekst: uitleg }, en), []);
  assert.deepEqual(checkPost({ categorie: "product", tekst: "Get your free scan today. https://www.marketingscan.be" }, en), []);
});

test("Engels live: verkooppost met disclaimer en voorwaarden gaat door, enkel in categorie verkoop", () => {
  const tekst = "Claim your Genesis Pass. Not an investment. https://community.marketingscan.be/voorwaarden?lang=en";
  assert.ok(rules(checkPost({ categorie: "verkoop", tekst }, { ...en, offer: { ...en.offer, verkoopActief: true } })).includes("verkoop-gesloten"));
  assert.equal(hasErrors(checkPost({ categorie: "verkoop", tekst }, enLive)), false);
  assert.ok(rules(checkPost({ categorie: "genesis", tekst }, enLive)).includes("koopoproep"));
  assert.ok(rules(checkPost({ categorie: "verkoop", tekst: "Claim your Genesis Pass." }, enLive)).includes("disclaimer-ontbreekt"));
});

test("Engels live: 'Not on sale yet' en een vergeten Nederlandse vermelding geven een waarschuwing", () => {
  for (const tekst of [`The Genesis Pass.${EN_OK}`, "The Genesis Pass. Not an investment. Nog geen verkoop."]) {
    const issues = checkPost({ categorie: "genesis", tekst }, enLive);
    assert.equal(hasErrors(issues), false, JSON.stringify(issues));
    assert.ok(issues.some((i) => i.regel === "vermelding-verouderd" && i.niveau === "waarschuwing"), tekst);
  }
});

test("Engelse Genesis-woorden worden herkend, ook in een productpost", () => {
  for (const tekst of ["Early access for founding members.", "One-click refund.", "Try it on devnet.", "The price ladder.", "Mint a pass."]) {
    assert.equal(aboutGenesis(tekst), true, tekst);
    assert.ok(rules(checkPost({ categorie: "product", tekst }, en)).includes("categorie"), tekst);
  }
  assert.equal(aboutGenesis("How visible is your business online? Free scan, results in 60 seconds."), false);
});
