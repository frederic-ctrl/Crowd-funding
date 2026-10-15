import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { reviewCalendar, materializeTemplates, renderText, approve, revoke } from "../src/calendar.js";
import { approvalHash } from "../src/text.js";

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

test("de meegeleverde kalender heeft geen fouten", () => {
  const doc = YAML.parse(readFileSync(new URL("../kalender.yaml", import.meta.url), "utf8"));
  const reviewed = reviewCalendar({ posts: doc.posts, templates: doc.sjablonen }, config);
  for (const r of reviewed) assert.deepEqual(errors(r), [], `${r.id}: ${JSON.stringify(r.issues)}`);
});

test("placeholders worden ingevuld vanuit config", () => {
  assert.equal(renderText("Scan: {scan}", config), `Scan: ${config.links.scan}`);
  assert.equal(renderText("{onbekend}", config), "{onbekend}");
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
    `posts:\n  - id: slecht-1\n    moment: 2026-10-27T10:00:00+01:00\n    categorie: product\n    status: concept\n    tekst: Gegarandeerd rendement op je aandelen!\n`,
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
  tekst: "Week {week}: {wachtlijst} mensen op de wachtlijst. Juridisch: {juridisch}. Volgende stap: {volgende_stap}.\n\nNog geen aanbod.",
};

test("sjabloon wordt ingevuld met recente cijfers", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  const data = { bijgewerkt: "2026-10-23", wachtlijst: 1234, juridisch: "statuten bij de notaris", volgende_stap: "waardering" };
  const items = materializeTemplates([template], data, config, now);
  const current = items.find((i) => i.id === "transparantie-wekelijks-2026-w44");
  assert.ok(current);
  assert.equal(current.moment.toISOString(), "2026-10-26T09:00:00.000Z");
  assert.match(current.tekst, /Week 44: 1\.234 mensen/);
  assert.deepEqual(current.issues.filter((i) => i.niveau === "fout"), []);
});

test("sjabloon blokkeert bij verouderde of ontbrekende cijfers", () => {
  const now = new Date("2026-10-26T09:30:00Z");
  const stale = materializeTemplates([template], { bijgewerkt: "2026-10-01", wachtlijst: 5, juridisch: "a", volgende_stap: "b" }, config, now);
  assert.ok(stale.every((i) => i.issues.some((x) => x.regel === "cijfers")));
  const empty = materializeTemplates([template], {}, config, now);
  assert.ok(empty.every((i) => i.issues.some((x) => x.regel === "cijfers")));
});

test("sjabloon kan vooruit plannen", () => {
  const items = materializeTemplates([template], {}, config, new Date("2026-10-26T09:30:00Z"), { weeksAhead: 2 });
  assert.deepEqual(
    items.map((i) => i.id),
    ["transparantie-wekelijks-2026-w43", "transparantie-wekelijks-2026-w44", "transparantie-wekelijks-2026-w45", "transparantie-wekelijks-2026-w46"],
  );
});
