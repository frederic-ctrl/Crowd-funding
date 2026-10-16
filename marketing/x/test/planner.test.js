import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { plan, STATE, needsLegalReview } from "../src/planner.js";

const config = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));

const item = (id, iso, extra = {}) => ({
  id,
  soort: "post",
  categorie: "product",
  status: "goedgekeurd",
  moment: new Date(iso),
  tekst: `Tekst ${id} https://www.marketingscan.be`,
  issues: [],
  ...extra,
});

const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i.plan]));

test("een goedgekeurde post op tijd wordt geplaatst, de rest krijgt een reden", () => {
  const now = new Date("2026-10-27T09:15:00Z"); // 10:15 in Brussel
  const posts = [
    item("klaar", "2026-10-27T09:00:00Z"),
    item("concept", "2026-10-27T09:00:00Z", { status: "concept" }),
    item("fout", "2026-10-27T09:00:00Z", { issues: [{ niveau: "fout", regel: "x", bericht: "x" }] }),
    item("later", "2026-10-29T09:00:00Z"),
    item("gemist", "2026-10-25T09:00:00Z"),
  ];
  const { items, toPost } = plan({ posts, state: { posts: [] }, config, now });
  assert.deepEqual(toPost.map((p) => p.id), ["klaar"]);
  assert.deepEqual(byId(items), {
    klaar: STATE.klaar,
    concept: STATE.goedkeuring,
    fout: STATE.geblokkeerd,
    later: STATE.gepland,
    gemist: STATE.gemist,
  });
  assert.equal(toPost[0].kostUsd, config.pricingUsd.postWithUrl);
});

test("al geplaatste posts worden niet opnieuw geplaatst", () => {
  const now = new Date("2026-10-27T09:15:00Z");
  const state = { posts: [{ id: "klaar", geplaatstOp: "2026-10-27T09:01:00Z" }] };
  const { items, toPost } = plan({ posts: [item("klaar", "2026-10-27T09:00:00Z")], state, config, now });
  assert.equal(toPost.length, 0);
  assert.equal(items[0].plan, STATE.geplaatst);
});

test("maximaal één post per run en minimale tussentijd", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const posts = [item("a", "2026-10-27T09:00:00Z"), item("b", "2026-10-27T10:00:00Z")];
  const first = plan({ posts, state: { posts: [] }, config, now });
  assert.deepEqual(first.toPost.map((p) => p.id), ["a"]);
  assert.equal(byId(first.items).b, STATE.tussentijd);

  const state = { posts: [{ id: "a", geplaatstOp: "2026-10-27T11:30:00Z" }] };
  const second = plan({ posts, state, config, now });
  assert.equal(second.toPost.length, 0);
  assert.equal(byId(second.items).b, STATE.tussentijd);

  const later = plan({ posts, state, config, now: new Date("2026-10-27T13:31:00Z") });
  assert.deepEqual(later.toPost.map((p) => p.id), ["b"]);
});

test("buiten het postvenster wordt er niets geplaatst", () => {
  const now = new Date("2026-10-27T05:30:00Z"); // 06:30 in Brussel
  const { items, toPost } = plan({ posts: [item("vroeg", "2026-10-27T05:00:00Z")], state: { posts: [] }, config, now });
  assert.equal(toPost.length, 0);
  assert.equal(items[0].plan, STATE.buitenVenster);
});

test("daglimiet", () => {
  const now = new Date("2026-10-27T18:00:00Z");
  const state = {
    posts: [
      { id: "x", geplaatstOp: "2026-10-27T08:00:00Z" },
      { id: "y", geplaatstOp: "2026-10-27T12:00:00Z" },
      { id: "w", geplaatstOp: "2026-10-27T14:30:00Z" },
    ],
  };
  const { items, toPost } = plan({ posts: [item("z", "2026-10-27T17:00:00Z")], state, config, now });
  assert.equal(toPost.length, 0);
  assert.equal(items[0].plan, STATE.dagmax);
});

test("posts over Genesis wachten op juridisch nazicht, productposts niet", () => {
  const now = new Date("2026-10-27T09:15:00Z");
  const posts = [
    item("product", "2026-10-27T09:00:00Z"),
    item("genesis", "2026-10-27T09:05:00Z", { categorie: "genesis", tekst: "De Genesis Pass. Geen investering. Nog geen verkoop." }),
  ];
  const blocked = plan({ posts, state: { posts: [] }, config: { ...config, offer: { ...config.offer, legalReviewDone: false } }, now });
  assert.equal(byId(blocked.items).genesis, STATE.juridisch);
  assert.deepEqual(blocked.toPost.map((p) => p.id), ["product"]);

  const reviewed = plan({
    posts: [posts[1]],
    state: { posts: [] },
    config: { ...config, offer: { ...config.offer, legalReviewDone: true } },
    now,
  });
  assert.deepEqual(reviewed.toPost.map((p) => p.id), ["genesis"]);
});

test("juridisch nazicht geldt voor alle Genesis-categorieën en voor Genesis-woorden in elke post", () => {
  const offer = { ...config.offer, legalReviewDone: false };
  for (const categorie of ["genesis", "uitleg", "transparantie", "verkoop"]) {
    assert.equal(needsLegalReview({ categorie, tekst: "Tekst" }, { ...config, offer }), true, categorie);
  }
  assert.equal(needsLegalReview({ categorie: "product", tekst: "Verbind je wallet" }, { ...config, offer }), true);
  assert.equal(needsLegalReview({ categorie: "product", tekst: "Gratis scan" }, { ...config, offer }), false);
  assert.equal(needsLegalReview({ categorie: "genesis", tekst: "Tekst" }, { ...config, offer: { ...offer, legalReviewDone: true } }), false);
});

test("drie posts per dag: om 10:00, 15:00 en 20:00 gaan ze alle drie de deur uit", () => {
  const at = (h, m) => new Date(Date.UTC(2026, 10, 3, h - 1, m)); // november: Brussel = UTC+1
  const posts = [10, 15, 20].map((h, i) => item(`p${i}`, at(h, 0).toISOString()));
  const state = { posts: [] };
  for (const h of [10, 15, 20]) {
    const { toPost } = plan({ posts, state, config, now: at(h, 17) });
    assert.deepEqual(toPost.map((p) => p.id), [`p${[10, 15, 20].indexOf(h)}`], `om ${h}:17`);
    state.posts.push({ id: toPost[0].id, geplaatstOp: at(h, 17).toISOString() });
  }
  assert.equal(config.schedule.maxPostsPerDay, 3);
});
