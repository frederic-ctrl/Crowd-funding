// Tijdzone-hulpen zonder externe bibliotheek (Intl volstaat). Alles in de tijdzone uit config.json.

const formatters = new Map();
function formatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  }
  return formatters.get(tz);
}

export function localParts(date, tz) {
  const parts = Object.fromEntries(formatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMs(date, tz) {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Lokale kalenderdatum + uur in `tz` naar een echt tijdstip (houdt rekening met zomeruur). */
export function zonedToUtc({ year, month, day, hour, minute }, tz) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - offsetMs(new Date(guess), tz);
  ts = guess - offsetMs(new Date(ts), tz);
  return new Date(ts);
}

export function minutesOfDay(date, tz) {
  const p = localParts(date, tz);
  return p.hour * 60 + p.minute;
}

export function localDateKey(date, tz) {
  const p = localParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseClock(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm));
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** ISO-weeknummer van de lokale datum, plus de maandag van die week (lokale datum). */
export function isoWeek(date, tz) {
  const p = localParts(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const weekday = (d.getUTCDay() + 6) % 7; // maandag = 0
  const monday = new Date(d.getTime() - weekday * 86400000);
  const thursday = new Date(monday.getTime() + 3 * 86400000);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000);
  const week = 1 + Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86400000));
  return {
    year,
    week,
    monday: { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() },
  };
}

export function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month - 1, day) + n * 86400000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
