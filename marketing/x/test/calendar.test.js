import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { reviewCalendar, materializeTemplates, renderText, approve, revoke, templateVars } from "../src/calendar.js";
import { approvalHash, weightedLength, MAX_WEIGHTED_LENGTH } from "../src/text.js";
import { ABOUT_GENESIS } from "../src/compliance.js";

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

test("de meegeleverde kalender: alles concept, Genesis-posts met beide vermeldingen, binnen 280 tekens", () => {
  const reviewed = reviewCalendar({ posts: shipped.posts, templates: shipped.sjablonen }, config);
  for (const r of reviewed) {
    assert.equal(r.status, "concept", r.id);
    assert.ok(weightedLength(r.tekst) <= MAX_WEIGHTED_LENGTH, r.id);
    if (ABOUT_GENESIS.has(r.categorie)) {
      assert.match(r.tekst, /Geen investering/i, r.id);
      assert.match(r.tekst, /Nog geen verkoop/i, r.id);
    }
    assert.ok(!r.tekst.includes("\u2014"), `${r.id} bevat een lang streepje`);
  }
  const categories = new Set(reviewed.map((r) => r.categorie));
  for (const c of ["product", "genesis", "uitleg", "transparantie"]) assert.ok(categories.has(c), c);
  assert.equal(categories.has("verkoop"), false);
});

test("placeholders worden ingevuld vanuit config", () => {
  assert.equal(renderText("Scan: {scan}", config), `Scan: ${config.links.scan}`);
  assert.equal(renderText("{genesis}", config), `${config.links.site}/genesis`);
  assert.equal(renderText("{transparantie}", config), `${config.links.site}/transparantie`);
  assert.equal(renderText("{voorwaarden}", config), config.offer.voorwaardenUrl);
  assert.equal(renderText("{onbekend}", config), "{onbekend}");
  assert.equal(renderText("{docs}", config), "{docs}");
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
  assert.match(current.tekst, /https:\/\/community\.marketingscan\.be\/transparantie$/);
  assert.deepEqual(current.issues.filter((i) => i.niveau === "fout"), []);
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
