import { test } from "node:test";
import assert from "node:assert/strict";
import { weightedLength, hasLink, extractLinks, linkHost, approvalHash, normalize } from "../src/text.js";

test("gewone tekst telt per teken", () => {
  assert.equal(weightedLength("Hallo kmo"), 9);
});

test("euroteken en emoji tellen dubbel, zoals op X", () => {
  assert.equal(weightedLength("€1"), 3);
  assert.equal(weightedLength("ok 👍"), 5);
});

test("een link telt altijd als 23 tekens", () => {
  assert.equal(weightedLength("Kijk: https://community.marketingscan.be/een/heel/lang/pad"), 6 + 23);
  assert.equal(weightedLength("www.marketingscan.be"), 23);
});

test("leestekens na een link horen niet bij de link", () => {
  const [link] = extractLinks("Zie marketingscan.be.");
  assert.equal(link.raw, "marketingscan.be");
});

test("linkherkenning en host", () => {
  assert.equal(hasLink("geen link hier"), false);
  assert.equal(hasLink("ga naar marketingscan.be"), true);
  assert.equal(linkHost("https://community.marketingscan.be/x"), "community.marketingscan.be");
  assert.equal(linkHost("marketingscan.be"), "marketingscan.be");
});

test("normalize maakt typografische aanhalingstekens recht", () => {
  assert.equal(normalize("risico’s  \n"), "risico's");
});

test("goedkeuringshash hangt aan de exacte tekst", () => {
  assert.equal(approvalHash("abc"), approvalHash("abc "));
  assert.notEqual(approvalHash("abc"), approvalHash("abd"));
  assert.match(approvalHash("abc"), /^[0-9a-f]{16}$/);
});
