import { test } from "node:test";
import assert from "node:assert/strict";
import { publish, createXClient } from "../src/poster.js";

const item = { id: "a", tekst: "Hallo", kostUsd: 0.015 };
const now = new Date("2026-10-27T09:15:00Z");

test("droogtest stuurt niets naar X en wijzigt de status niet", async () => {
  const state = { posts: [] };
  let calls = 0;
  const client = { post: async () => { calls += 1; return { id: "1" }; } };
  const res = await publish({ toPost: [item], state, client, enabled: false, now, log: () => {} });
  assert.equal(calls, 0);
  assert.deepEqual(state.posts, []);
  assert.deepEqual(res.geplaatst, []);
});

test("echte run plaatst en registreert de post", async () => {
  const state = { posts: [] };
  const sent = [];
  const client = { post: async (t) => { sent.push(t); return { id: "1849" }; } };
  const res = await publish({ toPost: [item], state, client, enabled: true, now, log: () => {} });
  assert.deepEqual(sent, ["Hallo"]);
  assert.equal(state.posts.length, 1);
  assert.equal(state.posts[0].url, "https://x.com/i/web/status/1849");
  assert.equal(state.posts[0].geplaatstOp, now.toISOString());
  assert.equal(res.geplaatst.length, 1);
});

test("een fout van X wordt gemeld en niet als geplaatst geregistreerd", async () => {
  const state = { posts: [] };
  const client = { post: async () => { const e = new Error("403"); e.data = { detail: "You are not permitted" }; throw e; } };
  const res = await publish({ toPost: [item], state, client, enabled: true, now, log: () => {} });
  assert.deepEqual(state.posts, []);
  assert.deepEqual(res.fouten, [{ id: "a", bericht: "You are not permitted" }]);
});

test("zonder sleutels geen client", () => {
  assert.throws(() => createXClient({}), /X-sleutels ontbreken: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET/);
  assert.ok(createXClient({ X_API_KEY: "a", X_API_SECRET: "b", X_ACCESS_TOKEN: "c", X_ACCESS_SECRET: "d" }).post);
});
