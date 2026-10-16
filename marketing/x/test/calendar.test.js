import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { reviewCalendar, materializeTemplates, renderText, approve, revoke, templateVars, withLang, textVariants } from "../src/calendar.js";
import { approvalHash, weightedLength, extractLinks, MAX_WEIGHTED_LENGTH } from "../src/text.js";
import { ABOUT_GENESIS, offerTexts } from "../src/compliance.js";

const config = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));

const errors = (r) => r.issues.filter((i) => i.niveau === "fout").map((i) => i.regel);

const post = (extra = {}) => ({
  id: "2026-10-27-test",
  moment: "2026-10-27T10:00:00+01:00",
  categorie: "product",
  status: "concept",
  tekst: "Gratis scan van je website.\n\n{scan}",
  ...extra,
});

const shipped = YAML.parse(readFileSync(new URL("../kalender.yaml", import.meta.url), "utf8"));

test("de meegeleverde kalender heeft geen fouten en geen waarschuwingen", () => {
  const reviewed = reviewCalendar({ posts: shipped.posts, templates: shipped.sjablonen }, config);
  assert.ok(reviewed.length >= 10);
  for (const r of reviewed) assert.deepEqual(r.issues, [], `${r.id}: ${JSON.stringify(r.issues)}`);
});

test("de meegeleverde kalender: Genesis-posts met beide vermeldingen in hun taal, binnen 280 tekens", () => {
  const reviewed = reviewCalendar({ posts: shipped.posts, templates: shipped.sjablonen }, config);
  for (const r of reviewed) {
    assert.ok(["concept", "goedgekeurd"].includes(r.status), r.id);
    assert.ok(weightedLength(r.tekst) <= MAX_WEIGHTED_LENGTH, r.id);
    if (ABOUT_GENESIS.has(r.categorie)) {
      const { required, notice, gift } = offerTexts(config, r.lang);
      assert.ok(r.tekst.includes(required), `${r.id}: ${required}`);
      // Een steunpost is geen verkoop: daar staat de gift-vermelding in plaats van "Not on sale yet".
      const expected = r.categorie === "steun" ? gift : notice;
      assert.ok(r.tekst.includes(expected), `${r.id}: ${expected}`);
    }
    assert.ok(!r.tekst.includes("\u2014"), `${r.id} bevat een lang streepje`);
    assert.doesNotMatch(r.tekst, /pre-?sale/i, r.id);
    assert.ok((r.tekst.match(/(^|\s)#[a-z]\w*/gi) ?? []).length <= 2, `${r.id}: max 2 hashtags`);
    for (const link of extractLinks(r.tekst)) {
      if (link.raw.includes("funding.marketingscan.be")) assert.ok(link.raw.endsWith(`?lang=${r.lang}`), `${r.id}: ${link.raw}`);
    }
  }
  const categories = new Set(reviewed.map((r) => r.categorie));
  for (const c of ["product", "genesis", "uitleg", "transparantie"]) assert.ok(categories.has(c), c);
  assert.equal(categories.has("verkoop"), false);
});

test("de meegeleverde kalender is Engels eerst: hooguit 3 Nederlandse posts", () => {
  const reviewed = reviewCalendar({ posts: shipped.posts, templates: shipped.sjablonen }, config);
  const posts = reviewed.filter((r) => r.soort === "post");
  const dutch = posts.filter((r) => r.lang === "nl");
  assert.ok(posts.length >= 12);
  assert.ok(dutch.length <= 3, dutch.map((r) => r.id).join(", "));
  assert.ok(posts.filter((r) => r.lang === "en").length >= posts.length - 3);
  for (const r of dutch) assert.equal(r.categorie, "product", r.id);
  const [weekly] = shipped.sjablonen;
  assert.equal(weekly.lang, "en");
  assert.deepEqual(Object.keys(weekly.tekst).sort(), ["en", "nl"]);
});

test("placeholders worden ingevuld vanuit config, links naar de site krijgen ?lang", () => {
  assert.equal(renderText("Scan: {scan}", config), `Scan: ${config.links.scan.en}`);
  assert.equal(renderText("{scan}", config, {}, "nl"), config.links.scan.nl);
  assert.equal(renderText("{genesis}", config), `${config.links.site}/genesis?lang=en`);
  assert.equal(renderText("{transparantie}", config), `${config.links.site}/transparantie?lang=en`);
  assert.equal(renderText("{voorwaarden}", config), `${config.offer.voorwaardenUrl}?lang=en`);
  assert.equal(renderText("{site}", config), `${config.links.site}/?lang=en`);
  assert.equal(renderText("{genesis} {site}", config, {}, "nl"), `${config.links.site}/genesis?lang=nl ${config.links.site}/?lang=nl`);
  assert.equal(renderText("{onbekend}", config), "{onbekend}");
  assert.equal(renderText("{docs}", config), "{docs}");
});

test("?lang komt er enkel bij als de link nog geen query heeft", () => {
  assert.equal(withLang("https://funding.marketingscan.be/genesis", "nl"), "https://funding.marketingscan.be/genesis?lang=nl");
  assert.equal(withLang("https://funding.marketingscan.be/genesis?ref=x", "nl"), "https://funding.marketingscan.be/genesis?ref=x");
  assert.equal(withLang("https://funding.marketingscan.be/genesis?lang=en", "nl"), "https://funding.marketingscan.be/genesis?lang=en");
  assert.equal(withLang("https://funding.marketingscan.be/voorwaarden#refund", "en"), "https://funding.marketingscan.be/voorwaarden?lang=en#refund");
  assert.equal(withLang("", "en"), "");
  const custom = { ...config, links: { ...config.links, genesis: "https://funding.marketingscan.be/genesis?utm_source=x" } };
  assert.equal(renderText("{genesis}", custom), "https://funding.marketingscan.be/genesis?utm_source=x");
});

test("een link met ?lang telt nog altijd als 23 tekens", () => {
  assert.equal(weightedLength(renderText("Zie {genesis}", config)), 4 + 23);
  assert.equal(weightedLength(renderText("{site}.", config, {}, "nl")), 23 + 1);
});

test("een post met lang: nl krijgt ?lang=nl en moet de Nederlandse vermeldingen hebben", () => {
  const nl = post({ categorie: "genesis", lang: "nl", tekst: "De Genesis Pass. Geen investering. Nog geen verkoop. {genesis}" });
  const [ok] = reviewCalendar({ posts: [nl], templates: [] }, config);
  assert.equal(ok.lang, "nl");
  assert.match(ok.tekst, /\/genesis\?lang=nl$/);
  assert.deepEqual(ok.issues, []);
  const [wrong] = reviewCalendar({ posts: [{ ...nl, lang: undefined }], templates: [] }, config);
  assert.equal(wrong.lang, "en");
  assert.ok(errors(wrong).includes("disclaimer-ontbreekt"));
  const [unknown] = reviewCalendar({ posts: [{ ...nl, lang: "fr" }], templates: [] }, config);
  assert.ok(errors(unknown).includes("taal"));
});

test("{voorwaarden} zonder voorwaardenUrl wordt gemeld", () => {
  const leeg = { ...config, offer: { ...config.offer, voorwaardenUrl: "" } };
  const [r] = reviewCalendar({ posts: [post({ tekst: "Voorwaarden: {voorwaarden}" })], templates: [] }, leeg);
  assert.ok(errors(r).includes("placeholder"));
});

test("onbekende placeholder, slecht moment en dubbele id worden gemeld", () => {
  const reviewed = reviewCalendar(
    { posts: [post({ tekst: "Hallo {foo}" }), post({ moment: "2026-10-27 10:00" })], templates: [] },
    config,
  );
  assert.ok(errors(reviewed[0]).includes("placeholder"));
  assert.ok(errors(reviewed[1]).includes("moment"));
  assert.ok(errors(reviewed[1]).includes("id"));
});

test("dubbele tekst wordt gemeld", () => {
  const reviewed = reviewCalendar({ posts: [post(), post({ id: "2026-10-28-test" })], templates: [] }, config);
  assert.ok(errors(reviewed[1]).includes("dubbel"));
});

test("goedkeuring vervalt als de tekst wijzigt", () => {
  const tekst = renderText(post().tekst, config);
  const ok = reviewCalendar(
    { posts: [post({ status: "goedgekeurd", goedkeuring: { door: "f", op: "x", hash: approvalHash(tekst) } })], templates: [] },
    config,
  );
  assert.deepEqual(errors(ok[0]), []);
  const changed = reviewCalendar(
    {
      posts: [post({ status: "goedgekeurd", tekst: "Andere tekst.", goedkeuring: { door: "f", op: "x", hash: approvalHash(tekst) } })],
      templates: [],
    },
    config,
  );
  assert.ok(errors(changed[0]).includes("goedkeuring"));
});

test("goedkeuren en intrekken passen het YAML-document aan en bewaren commentaar", () => {
  const src = `# commentaar blijft\nposts:\n  - id: 2026-10-27-test\n    moment: 2026-10-27T10:00:00+01:00\n    categorie: product\n    status: concept\n    tekst: |-\n      Gratis scan van je website.\n`;
  const doc = YAML.parseDocument(src);
  const now = new Date("2026-10-20T08:00:00Z");
  const res = approve(doc, "2026-10-27-test", { door: "frederic", now, config });
  const out = doc.toString();
  assert.match(out, /# commentaar blijft/);
  assert.match(out, /status: goedgekeurd/);
  assert.match(out, new RegExp(`hash: ${res.hash}`));
  assert.match(out, /door: frederic/);
  revoke(doc, "2026-10-27-test");
  assert.match(doc.toString(), /status: concept/);
  assert.doesNotMatch(doc.toString(), /goedkeuring/);
});

test("goedkeuren weigert een post met fouten", () => {
  const doc = YAML.parseDocument(
    `posts:\n  - id: slecht-1\n    moment: 2026-10-27T10:00:00+01:00\n    categorie: genesis\n    status: concept\n    tekst: Investeer nu in je Genesis Pass, de waarde stijgt!\n`,
  );
  assert.throws(() => approve(doc, "slecht-1", { door: "f", now: new Date(), config }), /Kan "slecht-1" niet goedkeuren/);
  assert.throws(() => approve(doc, "bestaat-niet", { door: "f", now: new Date(), config }), /Geen post/);
});

const template = {
  id: "transparantie-wekelijks",
  categorie: "transparantie",
  elke: "maandag",
  om: "10:00",
  status: "concept",
  lang: "nl",
  tekst:
    "Week {week}: {passes}/250 passes, {agency}/25 agency-passes, {supporters} supporters, €{opgehaald} van €50.000, {gebruikers} wekelijkse gebruikers. Stand: {stand}.\n\nGeen investering. Nog geen verkoop. {transparantie}",
};

const cijfers = {
  bijgewerkt: "2026-10-23",
  wekelijkseGebruikers: 1234,
  passesGeclaimd: 42,
  agencyGeclaimd: 3,
  supporters: 17,
  opgehaaldEur: 12345.5,
  wachtlijst: 0,
  stand: "rechtsvorm bij de boekhouder.",
};

test("sjabloon wordt ingevuld met recente Genesis-cijfers", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  const items = materializeTemplates([template], cijfers, config, now);
  const current = items.find((i) => i.id === "transparantie-wekelijks-2026-w44");
  assert.ok(current);
  assert.equal(current.moment.toISOString(), "2026-10-26T09:00:00.000Z");
  assert.match(current.tekst, /^Week 44: 42\/250 passes, 3\/25 agency-passes, 17 supporters, €12\.345,50 van €50\.000, 1\.234 wekelijkse gebruikers\. Stand: rechtsvorm bij de boekhouder\.\n/);
  assert.match(current.tekst, /https:\/\/funding\.marketingscan\.be\/transparantie\?lang=nl$/);
  assert.equal(current.lang, "nl");
  assert.deepEqual(current.issues.filter((i) => i.niveau === "fout"), []);
});

const templateEn = {
  ...template,
  lang: "en",
  tekst:
    "Week {week}: {passes}/250 passes, {agency}/25 agency passes, {supporters} supporters, €{opgehaald} of €50,000, {gebruikers} weekly users. Status: {stand}.\n\nNot an investment. Not on sale yet. {transparantie}",
};
const cijfersEn = { ...cijfers, stand: { en: "legal form with the accountant.", nl: "rechtsvorm bij de boekhouder." } };

test("Engels sjabloon: Engelse cijfernotatie en Engelse stand", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  const current = materializeTemplates([templateEn], cijfersEn, config, now).find((i) => i.id === "transparantie-wekelijks-2026-w44");
  assert.equal(current.lang, "en");
  assert.match(current.tekst, /^Week 44: 42\/250 passes, 3\/25 agency passes, 17 supporters, €12,345\.50 of €50,000, 1,234 weekly users\. Status: legal form with the accountant\.\n/);
  assert.match(current.tekst, /\/transparantie\?lang=en$/);
  assert.deepEqual(errors(current), []);
});

test("cijfernotatie per taal", () => {
  const data = { wekelijkseGebruikers: 1234, opgehaaldEur: 12345.5, stand: { en: "en text", nl: "nl tekst" } };
  assert.equal(templateVars(data, 44, "en").vars.gebruikers, "1,234");
  assert.equal(templateVars(data, 44, "en").vars.opgehaald, "12,345.50");
  assert.equal(templateVars(data, 44, "nl").vars.gebruikers, "1.234");
  assert.equal(templateVars(data, 44, "nl").vars.opgehaald, "12.345,50");
  assert.equal(templateVars(data, 44, "en").vars.stand, "en text");
  assert.equal(templateVars(data, 44, "nl").vars.stand, "nl tekst");
});

test("een gewone string als stand telt als Nederlands: het Engelse sjabloon blijft dan geblokkeerd", () => {
  const { vars, problems } = templateVars({ stand: "rechtsvorm bij de boekhouder" }, 44, "en");
  assert.equal(vars.stand, "");
  assert.match(problems.stand, /\{stand\}/);
  assert.equal(templateVars({ stand: "rechtsvorm bij de boekhouder" }, 44, "nl").vars.stand, "rechtsvorm bij de boekhouder");
  const items = materializeTemplates([templateEn], cijfers, config, new Date("2026-10-26T09:30:00Z"));
  assert.ok(items.every((i) => i.issues.some((x) => x.regel === "cijfers" && /\{stand\}/.test(x.bericht))));
});

const bilingual = { ...template, lang: undefined, tekst: { en: templateEn.tekst, nl: template.tekst } };

test("sjabloon met een tekst per taal: lang kiest de tekst, standaard Engels", () => {
  const tv = textVariants(bilingual, config);
  assert.equal(tv.lang, "en");
  assert.equal(tv.selected, templateEn.tekst);
  const now = new Date("2026-10-26T09:30:00Z");
  const enItem = materializeTemplates([bilingual], cijfersEn, config, now).find((i) => i.id === "transparantie-wekelijks-2026-w44");
  assert.match(enItem.tekst, /Not an investment\. Not on sale yet\./);
  assert.deepEqual(errors(enItem), []);
  const nlItem = materializeTemplates([{ ...bilingual, lang: "nl" }], cijfersEn, config, now).find((i) => i.id === "transparantie-wekelijks-2026-w44");
  assert.match(nlItem.tekst, /Geen investering\. Nog geen verkoop\./);
  assert.match(nlItem.tekst, /€12\.345,50/);
  assert.deepEqual(errors(nlItem), []);
  const [reviewed] = reviewCalendar({ posts: [], templates: [bilingual] }, config);
  assert.deepEqual(reviewed.issues, []);
  assert.equal(reviewed.lang, "en");
});

test("sjabloon met een tekst per taal: elke taalversie wordt gecontroleerd", () => {
  const broken = { ...bilingual, tekst: { en: templateEn.tekst, nl: "Week {week}: mooi rendement. Geen investering. Nog geen verkoop." } };
  const [reviewed] = reviewCalendar({ posts: [], templates: [broken] }, config);
  const fout = reviewed.issues.find((i) => i.regel === "verboden-taal");
  assert.ok(fout);
  assert.match(fout.bericht, /^\[nl\] /);
  const missing = reviewCalendar({ posts: [], templates: [{ ...bilingual, lang: "nl", tekst: { en: templateEn.tekst } }] }, config)[0];
  assert.ok(errors(missing).includes("taal"));
  const items = materializeTemplates([{ ...bilingual, lang: "nl", tekst: { en: templateEn.tekst } }], cijfersEn, config, new Date("2026-10-26T09:30:00Z"));
  assert.ok(items.every((i) => i.issues.some((x) => x.regel === "taal")));
  const unknown = reviewCalendar({ posts: [], templates: [{ ...bilingual, tekst: { ...bilingual.tekst, fr: "Semaine {week}." } }] }, config)[0];
  assert.ok(errors(unknown).includes("taal"));
});

test("goedkeuren van een sjabloon met tekst per taal koppelt de hash aan de gekozen tekst", () => {
  const src = [
    "sjablonen:",
    "  - id: wekelijks",
    "    categorie: transparantie",
    "    elke: maandag",
    '    om: "15:00"',
    "    status: concept",
    "    lang: en",
    "    tekst:",
    "      en: |-",
    "        Week {week}: {passes}/250 passes. Not an investment. Not on sale yet. {transparantie}",
    "      nl: |-",
    "        Week {week}: {passes}/250 passes. Geen investering. Nog geen verkoop. {transparantie}",
    "",
  ].join("\n");
  const doc = YAML.parseDocument(src);
  const res = approve(doc, "wekelijks", { door: "f", now: new Date("2026-10-20T08:00:00Z"), config });
  const entry = doc.toJS().sjablonen[0];
  assert.equal(res.hash, approvalHash(renderText(entry.tekst.en, config, {}, "en")));
  assert.deepEqual(errors(reviewCalendar({ posts: [], templates: [entry] }, config)[0]), []);
  const switched = reviewCalendar({ posts: [], templates: [{ ...entry, lang: "nl" }] }, config)[0];
  assert.ok(errors(switched).includes("goedkeuring"), "van taal wisselen laat de goedkeuring vervallen");
});

test("nul is een geldig cijfer", () => {
  const { vars, problems } = templateVars({ passesGeclaimd: 0, opgehaaldEur: 0 }, 44);
  assert.equal(vars.passes, "0");
  assert.equal(vars.opgehaald, "0");
  assert.equal(vars.supporters, "");
  assert.deepEqual(problems, {});
});

test("sjabloon blokkeert bij onmogelijke cijfers", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  for (const fout of [{ passesGeclaimd: 251 }, { agencyGeclaimd: 26 }, { supporters: -1 }, { passesGeclaimd: 1.5 }, { opgehaaldEur: "veel" }]) {
    const items = materializeTemplates([template], { ...cijfers, ...fout }, config, now);
    assert.ok(items.every((i) => i.issues.some((x) => x.regel === "cijfers" && /data\/cijfers\.json moet/.test(x.bericht))), JSON.stringify(fout));
  }
});

test("sjabloon blokkeert bij verouderde of ontbrekende cijfers", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  const stale = materializeTemplates([template], { ...cijfers, bijgewerkt: "2026-10-01" }, config, now);
  assert.ok(stale.every((i) => i.issues.some((x) => x.regel === "cijfers")));
  const empty = materializeTemplates([template], {}, config, now);
  assert.ok(empty.every((i) => i.issues.some((x) => x.regel === "cijfers")));
  const noStand = materializeTemplates([template], { ...cijfers, stand: "" }, config, now);
  assert.ok(noStand.every((i) => i.issues.some((x) => x.regel === "cijfers" && /\{stand\}/.test(x.bericht))));
});

test("verboden taal in de vrije tekst van de cijfers blokkeert de post", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  const items = materializeTemplates([template], { ...cijfers, stand: "mooi rendement in zicht" }, config, now);
  assert.ok(items.every((i) => i.issues.some((x) => x.regel === "verboden-taal")));
});

test("het meegeleverde sjabloon werkt met het meegeleverde cijferbestand", () => {
  const data = JSON.parse(readFileSync(new URL("../data/cijfers.json", import.meta.url), "utf8"));
  const now = new Date(`${data.bijgewerkt}T12:00:00Z`);
  const items = materializeTemplates(shipped.sjablonen, data, config, now, { weeksAhead: 1 });
  assert.ok(items.length > 0);
  const fresh = items.filter((i) => i.moment.getTime() >= now.getTime());
  assert.ok(fresh.length > 0);
  for (const i of fresh) assert.deepEqual(errors(i), [], `${i.id}: ${JSON.stringify(i.issues)}`);
});

test("sjabloon kan vooruit plannen", () => {
  const items = materializeTemplates([template], {}, config, new Date("2026-10-26T09:30:00Z"), { weeksAhead: 2 });
  assert.deepEqual(
    items.map((i) => i.id),
    ["transparantie-wekelijks-2026-w43", "transparantie-wekelijks-2026-w44", "transparantie-wekelijks-2026-w45", "transparantie-wekelijks-2026-w46"],
  );
});

test("{scan} linkt naar de marketingscan.be-pagina in de taal van de post", async () => {
  const { renderText } = await import("../src/calendar.js");
  const cfg = { defaultLang: "en", links: { site: "https://funding.marketingscan.be", scan: { nl: "https://www.marketingscan.be", en: "https://www.marketingscan.be/en" } } };
  assert.equal(renderText("Free scan: {scan}", cfg, {}, "en"), "Free scan: https://www.marketingscan.be/en");
  assert.equal(renderText("Gratis scan: {scan}", cfg, {}, "nl"), "Gratis scan: https://www.marketingscan.be");
  assert.equal(renderText("{scan}", { links: { scan: "https://x.be" } }, {}, "en"), "https://x.be", "een gewone string blijft werken");
});

test("afbeeldingen: bestaand bestand, toegelaten type, en de goedkeuring hangt ook aan de afbeelding", async () => {
  const { reviewCalendar, approve, approvalSubject } = await import("../src/calendar.js");
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const YAMLmod = (await import("yaml")).default;
  const dir = mkdtempSync(join(tmpdir(), "x-media-"));
  try {
    mkdirSync(join(dir, "media"));
    writeFileSync(join(dir, "media", "a.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(dir, "media", "b.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]));
    const base = { id: "2026-11-02-beeld", moment: "2026-11-02T15:00:00+01:00", categorie: "product", status: "concept", tekst: "Free scan, 60 seconds. https://www.marketingscan.be/en" };
    const check = (post) => reviewCalendar({ posts: [post], templates: [], baseDir: dir }, config)[0];
    assert.deepEqual(check({ ...base, afbeelding: "media/a.png" }).issues, []);
    assert.equal(check({ ...base, afbeelding: "media/a.png" }).afbeelding, join(dir, "media", "a.png"));
    assert.ok(check({ ...base, afbeelding: "media/c.png" }).issues.some((i) => i.regel === "afbeelding"));
    assert.ok(check({ ...base, afbeelding: "media/a.bmp" }).issues.some((i) => i.regel === "afbeelding"));
    const doc = YAMLmod.parseDocument(YAMLmod.stringify({ posts: [{ ...base, afbeelding: "media/a.png", test: "t1", variant: "A" }] }));
    approve(doc, base.id, { door: "test", now: new Date(), config, baseDir: dir });
    const approved = doc.toJS().posts[0];
    assert.deepEqual(check(approved).issues, []);
    assert.equal(check(approved).test, "t1");
    const swapped = { ...approved, afbeelding: "media/b.png" };
    assert.ok(check(swapped).issues.some((i) => i.regel === "goedkeuring"), "een andere afbeelding vraagt een nieuwe goedkeuring");
    assert.notEqual(approvalSubject("x", "media/a.png"), approvalSubject("x", "media/b.png"));
    assert.equal(approvalSubject("x"), "x", "zonder afbeelding blijft de goedkeuring gelijk aan vroeger");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
