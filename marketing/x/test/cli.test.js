// Volledige doorloop via de opdrachtregel, op een kopie van de map (de echte kalender blijft onaangeroerd).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const base = fileURLToPath(new URL("..", import.meta.url));
const cli = join(base, "src", "cli.js");

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "x-promo-"));
  for (const f of ["config.json", "kalender.yaml", "data", "state"]) cpSync(join(base, f), join(dir, f), { recursive: true });
  return dir;
}

function run(dir, args, env = {}) {
  const res = spawnSync(process.execPath, [cli, ...args], {
    env: { PATH: process.env.PATH, X_PROMO_DIR: dir, ...env },
    encoding: "utf8",
  });
  return { code: res.status, out: res.stdout + res.stderr };
}

test("lint slaagt op de meegeleverde kalender en faalt op een foute post", () => {
  const dir = workspace();
  try {
    assert.equal(run(dir, ["lint"]).code, 0);
    const path = join(dir, "kalender.yaml");
    writeFileSync(path, readFileSync(path, "utf8").replace("Free, no account.", "Guaranteed returns."));
    const res = run(dir, ["lint"]);
    assert.equal(res.code, 1);
    assert.match(res.out, /verboden-taal/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("goedkeuren en posten: droogtest zonder X_POSTING_ENABLED", () => {
  const dir = workspace();
  try {
    const approved = run(dir, ["approve", "2026-10-27-free-scan", "--door", "test"]);
    assert.equal(approved.code, 0, approved.out);
    assert.match(readFileSync(join(dir, "kalender.yaml"), "utf8"), /status: goedgekeurd/);
    assert.equal(run(dir, ["lint"]).code, 0);

    const res = run(dir, ["post", "--nu", "2026-10-27T15:05:00+01:00"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /Droogtest/);
    assert.match(res.out, /\[droogtest\] zou nu posten: 2026-10-27-free-scan/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "state", "geplaatst.json"), "utf8")).posts, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("echt posten zonder sleutels faalt duidelijk", () => {
  const dir = workspace();
  try {
    run(dir, ["approve", "2026-10-27-free-scan", "--door", "test"]);
    const res = run(dir, ["post", "--nu", "2026-10-27T15:05:00+01:00"], { X_POSTING_ENABLED: "true" });
    assert.equal(res.code, 1);
    assert.match(res.out, /X-sleutels ontbreken/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pauze in config houdt alles in droogtest", () => {
  const dir = workspace();
  try {
    const cfgPath = join(dir, "config.json");
    writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(readFileSync(cfgPath, "utf8")), paused: true }));
    run(dir, ["approve", "2026-10-27-free-scan", "--door", "test"]);
    const res = run(dir, ["post", "--nu", "2026-10-27T15:05:00+01:00"], { X_POSTING_ENABLED: "true" });
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /Gepauzeerd/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("plan toont de kalender met kostenraming", () => {
  const dir = workspace();
  try {
    const res = run(dir, ["plan", "--nu", "2026-10-26T09:00:00+01:00", "--dagen", "14"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /\$0\.200\s+en\s+2026-10-27-free-scan/);
    assert.match(res.out, /\$0\.200\s+nl\s+2026-11-03-google-bedrijfsprofiel/);
    assert.match(res.out, /geschatte kost: \$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verkooppost: lint faalt tot verkoopActief en legalReviewDone allebei true zijn", () => {
  const dir = workspace();
  try {
    const path = join(dir, "kalender.yaml");
    const verkoop = [
      "  - id: 2026-12-15-sale-open",
      "    moment: 2026-12-15T15:00:00+01:00",
      "    categorie: verkoop",
      "    status: concept",
      "    tekst: |-",
      "      Claim your Genesis Pass: lifetime Marketing Scan Pro, 14 days to get your money back with one click.",
      "",
      "      Not an investment. {genesis} Terms: {voorwaarden}",
      "",
      "  - id: 2026-12-15-verkoop-open",
      "    moment: 2026-12-15T10:00:00+01:00",
      "    categorie: verkoop",
      "    status: concept",
      "    lang: nl",
      "    tekst: |-",
      "      Claim je Genesis Pass: levenslang Marketing Scan Pro, 14 dagen geld terug met één klik.",
      "",
      "      Geen investering. {genesis} Voorwaarden: {voorwaarden}",
      "",
    ].join("\n");
    writeFileSync(path, readFileSync(path, "utf8").replace("\n# Sjablonen", `\n${verkoop}\n# Sjablonen`));
    const closed = run(dir, ["lint"]);
    assert.equal(closed.code, 1);
    assert.match(closed.out, /verkoop-gesloten/);
    assert.match(closed.out, /"claim your genesis pass": geen koopoproep/);
    assert.match(closed.out, /"claim je": geen koopoproep/);

    const cfgPath = join(dir, "config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    writeFileSync(cfgPath, JSON.stringify({ ...cfg, offer: { ...cfg.offer, verkoopActief: true } }));
    assert.match(run(dir, ["lint"]).out, /verkoop-gesloten/);

    writeFileSync(cfgPath, JSON.stringify({ ...cfg, offer: { ...cfg.offer, verkoopActief: true, legalReviewDone: true } }));
    const open = run(dir, ["lint"]);
    assert.equal(open.code, 0, open.out);
    assert.match(open.out, /Verkoop: live/);
    assert.match(open.out, /vermelding-verouderd/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("goedgekeurde Genesis-post wacht op juridisch nazicht", () => {
  const dir = workspace();
  try {
    const approved = run(dir, ["approve", "2026-10-29-why-genesis", "--door", "test"]);
    assert.equal(approved.code, 0, approved.out);
    const res = run(dir, ["post", "--nu", "2026-10-29T15:05:00+01:00"]);
    assert.equal(res.code, 0, res.out);
    assert.doesNotMatch(res.out, /zou nu posten: 2026-10-29-why-genesis/);
    const planned = run(dir, ["plan", "--nu", "2026-10-29T09:00:00+01:00", "--dagen", "2"]);
    assert.match(planned.out, /wacht op juridisch nazicht\s+\$0\.200\s+en\s+2026-10-29-why-genesis/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lint toont de taal per post en de standaardtaal", () => {
  const dir = workspace();
  try {
    const res = run(dir, ["lint"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /Standaardtaal: en/);
    assert.match(res.out, /OK {4}2026-10-27-free-scan {2}\(post, product, en, concept, \d+\/280\)/);
    assert.match(res.out, /OK {4}2026-11-03-google-bedrijfsprofiel {2}\(post, product, nl, concept, \d+\/280\)/);
    assert.match(res.out, /transparantie-wekelijks {2}\(sjabloon, transparantie, en, concept/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("oude config met gewone strings: de Nederlandse posts blijven slagen, de Engelse gebruiken de standaardteksten", () => {
  const dir = workspace();
  try {
    const cfgPath = join(dir, "config.json");
    const { defaultLang, ...cfg } = JSON.parse(readFileSync(cfgPath, "utf8"));
    assert.equal(defaultLang, "en");
    const offer = { ...cfg.offer, required: "Geen investering", noticeWhenNotLive: "Nog geen verkoop" };
    writeFileSync(cfgPath, JSON.stringify({ ...cfg, offer }));
    const res = run(dir, ["lint"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /Standaardtaal: en/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
