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
    writeFileSync(path, readFileSync(path, "utf8").replace("Gratis, zonder account.", "Gegarandeerd rendement."));
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
    const approved = run(dir, ["approve", "2026-10-27-gratis-scan", "--door", "test"]);
    assert.equal(approved.code, 0, approved.out);
    assert.match(readFileSync(join(dir, "kalender.yaml"), "utf8"), /status: goedgekeurd/);
    assert.equal(run(dir, ["lint"]).code, 0);

    const res = run(dir, ["post", "--nu", "2026-10-27T10:05:00+01:00"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /Droogtest/);
    assert.match(res.out, /\[droogtest\] zou nu posten: 2026-10-27-gratis-scan/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "state", "geplaatst.json"), "utf8")).posts, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("echt posten zonder sleutels faalt duidelijk", () => {
  const dir = workspace();
  try {
    run(dir, ["approve", "2026-10-27-gratis-scan", "--door", "test"]);
    const res = run(dir, ["post", "--nu", "2026-10-27T10:05:00+01:00"], { X_POSTING_ENABLED: "true" });
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
    run(dir, ["approve", "2026-10-27-gratis-scan", "--door", "test"]);
    const res = run(dir, ["post", "--nu", "2026-10-27T10:05:00+01:00"], { X_POSTING_ENABLED: "true" });
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
    assert.match(res.out, /2026-10-27-gratis-scan/);
    assert.match(res.out, /geschatte kost: \$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
