import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedToUtc, isoWeek, minutesOfDay, localDateKey, parseClock } from "../src/time.js";

const TZ = "Europe/Brussels";

test("zomeruur: 10:00 in Brussel is 08:00 UTC", () => {
  assert.equal(zonedToUtc({ year: 2026, month: 10, day: 19, hour: 10, minute: 0 }, TZ).toISOString(), "2026-10-19T08:00:00.000Z");
});

test("winteruur (na 25 oktober 2026): 10:00 in Brussel is 09:00 UTC", () => {
  assert.equal(zonedToUtc({ year: 2026, month: 10, day: 26, hour: 10, minute: 0 }, TZ).toISOString(), "2026-10-26T09:00:00.000Z");
});

test("ISO-week en maandag van die week", () => {
  const w = isoWeek(new Date("2026-10-29T12:00:00Z"), TZ);
  assert.equal(w.year, 2026);
  assert.equal(w.week, 44);
  assert.deepEqual(w.monday, { year: 2026, month: 10, day: 26 });
  assert.equal(isoWeek(new Date("2027-01-01T12:00:00Z"), TZ).week, 53);
});

test("lokale tijd en datum", () => {
  const d = new Date("2026-10-26T22:30:00Z");
  assert.equal(minutesOfDay(d, TZ), 23 * 60 + 30);
  assert.equal(localDateKey(d, TZ), "2026-10-26");
  assert.equal(localDateKey(new Date("2026-10-26T23:30:00Z"), TZ), "2026-10-27");
});

test("uren inlezen", () => {
  assert.deepEqual(parseClock("09:05"), { hour: 9, minute: 5 });
  assert.equal(parseClock("25:00"), null);
});
