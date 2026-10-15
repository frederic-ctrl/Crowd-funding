import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPost, hasErrors, aboutInvesting } from "../src/compliance.js";

const config = {
  offer: {
    status: "pre-launch",
    noticeWhenNotLive: "Nog geen aanbod",
    riskShort: "Investeren houdt risico's in",
    riskLive: "Je kan je volledige inleg verliezen",
    documentsUrl: "",
    deMinimisNotice: "",
  },
  links: { allowedDomains: ["marketingscan.be", "fsma.be"] },
  maxHashtags: 2,
};
const live = {
  ...config,
  offer: {
    ...config.offer,
    status: "live",
    documentsUrl: "https://community.marketingscan.be/documenten",
    deMinimisNotice: "max €500.000, max €5.000 per persoon",
  },
};

const rules = (issues) => issues.filter((i) => i.niveau === "fout").map((i) => i.regel);

test("een nette productpost gaat door", () => {
  const issues = checkPost({ categorie: "product", tekst: "Gratis scan van je website. https://www.marketingscan.be" }, config);
  assert.deepEqual(issues, []);
});

test("productpost over investeren moet een andere categorie krijgen", () => {
  const issues = checkPost({ categorie: "product", tekst: "Word aandeelhouder van Marketing Scan." }, config);
  assert.ok(rules(issues).includes("categorie"));
});

test("rondepost zonder verplichte vermeldingen wordt geblokkeerd", () => {
  const issues = checkPost({ categorie: "ronde", tekst: "Onze community-ronde komt eraan." }, config);
  assert.ok(rules(issues).includes("vermelding-ontbreekt"));
  assert.ok(rules(issues).includes("risico-ontbreekt"));
});

test("rondepost met vermeldingen gaat door, ook met typografische apostrof", () => {
  const tekst = "Onze community-ronde komt eraan. Nog geen aanbod. Investeren houdt risico’s in.";
  assert.equal(hasErrors(checkPost({ categorie: "ronde", tekst }, config)), false);
});

for (const tekst of [
  "Gegarandeerd rendement met onze aandelen. Nog geen aanbod.",
  "Je inleg verdubbelt zeker. Nog geen aanbod.",
  "Dit wordt 10x waard. Nog geen aanbod.",
  "Laatste kans om mee te doen! Nog geen aanbod.",
  "Onze token presale start. Nog geen aanbod.",
  "8% rendement per jaar op je aandelen. Nog geen aanbod.",
  "Investeren zonder risico. Nog geen aanbod.",
  "Aandelen to the moon. Nog geen aanbod.",
]) {
  test(`verboden taal wordt geblokkeerd: ${tekst}`, () => {
    assert.ok(rules(checkPost({ categorie: "uitleg", tekst }, config)).includes("verboden-taal"));
  });
}

test("ontkenningen zijn toegestaan", () => {
  const tekst = "Bij aandelen is er geen dividend gegarandeerd. Nog geen aanbod.";
  assert.equal(rules(checkPost({ categorie: "uitleg", tekst }, config)).includes("verboden-taal"), false);
});

test("geen oproep tot investeren zolang er geen aanbod is", () => {
  const tekst = "Investeer nu in Marketing Scan. Nog geen aanbod. Investeren houdt risico's in.";
  assert.ok(rules(checkPost({ categorie: "ronde", tekst }, config)).includes("oproep-tot-investeren"));
});

test("een wachtlijst-oproep is wel toegestaan", () => {
  const tekst = "Schrijf je in op de wachtlijst van de community-ronde. Nog geen aanbod. Investeren houdt risico's in.";
  assert.equal(hasErrors(checkPost({ categorie: "ronde", tekst }, config)), false);
});

test("categorie aanbod kan niet voor de lancering", () => {
  assert.ok(rules(checkPost({ categorie: "aanbod", tekst: "Nog geen aanbod" }, config)).includes("geen-aanbod"));
});

test("cashtags en onbekende links worden geblokkeerd", () => {
  const issues = checkPost({ categorie: "product", tekst: "Volg $MSCAN op https://pump.example.com" }, config);
  assert.ok(rules(issues).includes("cashtag"));
  assert.ok(rules(issues).includes("link"));
});

test("te lange post wordt geblokkeerd", () => {
  assert.ok(rules(checkPost({ categorie: "product", tekst: "a".repeat(281) }, config)).includes("lengte"));
});

test("live: risico, documentenlink en de-minimisvermelding zijn verplicht", () => {
  const zonder = checkPost({ categorie: "aanbod", tekst: "De community-ronde is gestart." }, live);
  assert.ok(rules(zonder).includes("risico-ontbreekt"));
  assert.ok(rules(zonder).includes("documenten"));
  assert.ok(rules(zonder).includes("de-minimis"));

  const met = checkPost(
    {
      categorie: "aanbod",
      tekst:
        "De community-ronde is gestart, max €500.000, max €5.000 per persoon. Je kan je volledige inleg verliezen. https://community.marketingscan.be/documenten",
    },
    live,
  );
  assert.equal(hasErrors(met), false, JSON.stringify(met));
});

test("investeringswoorden worden herkend", () => {
  assert.equal(aboutInvesting("Word mede-eigenaar vanaf €1"), true);
  assert.equal(aboutInvesting("Je website is traag"), false);
});

test("stijlwaarschuwingen blokkeren niet", () => {
  const issues = checkPost({ categorie: "product", tekst: "SUPER GOEDE SCAN!! 🚀🚀🚀 @iemand" }, config);
  assert.equal(hasErrors(issues), false);
  const regels = issues.map((i) => i.regel);
  for (const r of ["hoofdletters", "uitroeptekens", "emoji", "vermelding"]) assert.ok(regels.includes(r), r);
});
