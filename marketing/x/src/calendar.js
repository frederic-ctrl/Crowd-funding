// De contentkalender (kalender.yaml): inlezen, controleren, sjablonen invullen en goedkeuren.
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { normalize, approvalHash } from "./text.js";
import { CATEGORIES, checkPost } from "./compliance.js";
import { zonedToUtc, isoWeek, addDays, parseClock } from "./time.js";

export const STATUSES = ["concept", "goedgekeurd"];
const WEEKDAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const ID_RE = /^[a-z0-9][a-z0-9-]{2,80}$/;
const MOMENT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/;
const LINK_KEYS = ["site", "scan", "genesis", "transparantie", "voorwaarden"];
// Hoe oud de cijfers voor een sjabloonpost maximaal mogen zijn.
const MAX_DATA_AGE_DAYS = 8;

// Sjabloonvariabelen en het veld in data/cijfers.json waar ze vandaan komen.
// `max`: hoger kan niet (zie shared/genesis.json), dus dan is het een tikfout en blijft de post geblokkeerd.
const METRICS = [
  { key: "passes", veld: "passesGeclaimd", geheel: true, max: 250 },
  { key: "agency", veld: "agencyGeclaimd", geheel: true, max: 25 },
  { key: "supporters", veld: "supporters", geheel: true },
  { key: "opgehaald", veld: "opgehaaldEur", geheel: false },
  { key: "gebruikers", veld: "wekelijkseGebruikers", geheel: true },
  { key: "wachtlijst", veld: "wachtlijst", geheel: true },
];
export const TEMPLATE_KEYS = ["week", ...METRICS.map((m) => m.key), "stand"];

// Voorbeeldwaarden om een sjabloon al bij het schrijven en goedkeuren te controleren.
export const SAMPLE_VARS = {
  week: 44,
  passes: "123",
  agency: "12",
  supporters: "1.234",
  opgehaald: "23.456",
  gebruikers: "1.234",
  wachtlijst: "1.234",
  stand: "rechtsvorm bij de boekhouder",
};

export function loadCalendar(path) {
  const doc = YAML.parseDocument(readFileSync(path, "utf8"));
  if (doc.errors.length > 0) {
    throw new Error(`kalender.yaml is geen geldige YAML: ${doc.errors[0].message}`);
  }
  const data = doc.toJS() ?? {};
  return { doc, posts: data.posts ?? [], templates: data.sjablonen ?? [] };
}

export function saveCalendar(path, doc) {
  writeFileSync(path, doc.toString({ lineWidth: 0 }), "utf8");
}

/** Vult {site}, {scan}, {genesis}, {transparantie} en {voorwaarden} in uit config, plus eventuele sjabloonvariabelen. */
export function renderText(text, config, vars = {}) {
  const site = String(config.links?.site ?? "").replace(/\/+$/, "");
  const links = {
    site,
    scan: config.links?.scan ?? "",
    genesis: config.links?.genesis ?? (site ? `${site}/genesis` : ""),
    transparantie: config.links?.transparantie ?? (site ? `${site}/transparantie` : ""),
    voorwaarden: config.offer?.voorwaardenUrl ?? "",
  };
  return normalize(
    String(text ?? "").replace(/\{(\w+)\}/g, (all, key) => {
      if (Object.hasOwn(vars, key)) return String(vars[key]);
      if (Object.hasOwn(links, key) && links[key]) return links[key];
      return all;
    }),
  );
}

function unknownPlaceholders(text, allowed) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !allowed.includes(k));
}

function approvalIssue(entry, rendered) {
  if (entry.status !== "goedgekeurd") return null;
  const hash = entry.goedkeuring?.hash;
  if (!hash) return "Status is goedgekeurd, maar er is geen goedkeuringshash. Keur goed via de workflow.";
  if (hash !== approvalHash(rendered)) return "Goedkeuring vervallen: de tekst is gewijzigd na de goedkeuring.";
  return null;
}

/**
 * Controleert de hele kalender. Geeft per post de ingevulde tekst en alle problemen terug.
 * @returns {{ id: string, soort: "post" | "sjabloon", categorie: string, status: string, moment: Date | null, tekst: string, issues: object[] }[]}
 */
export function reviewCalendar({ posts, templates }, config) {
  const reviewed = [];
  const seenIds = new Set();
  const seenTexts = new Map();

  const common = (entry, soort) => {
    const issues = [];
    const add = (niveau, regel, bericht) => issues.push({ niveau, regel, bericht });
    if (!ID_RE.test(String(entry.id ?? ""))) add("fout", "id", "Id: kleine letters, cijfers en streepjes (3 tot 80 tekens).");
    if (seenIds.has(entry.id)) add("fout", "id", `Id "${entry.id}" komt meer dan eens voor.`);
    seenIds.add(entry.id);
    if (!STATUSES.includes(entry.status)) add("fout", "status", `Status moet ${STATUSES.join(" of ")} zijn.`);
    if (!CATEGORIES.includes(entry.categorie)) add("fout", "categorie", `Onbekende categorie "${entry.categorie}".`);
    const allowed = soort === "post" ? LINK_KEYS : [...LINK_KEYS, ...TEMPLATE_KEYS];
    for (const key of unknownPlaceholders(entry.tekst, allowed)) add("fout", "placeholder", `Onbekende placeholder {${key}}.`);
    if (/\{voorwaarden\}/.test(String(entry.tekst)) && !config.offer?.voorwaardenUrl) {
      add("fout", "placeholder", "{voorwaarden} gebruikt, maar offer.voorwaardenUrl is leeg.");
    }
    return { issues, add };
  };

  for (const post of posts) {
    const { issues, add } = common(post, "post");
    const moment = MOMENT_RE.test(String(post.moment ?? "")) ? new Date(post.moment) : null;
    if (!moment || Number.isNaN(moment.getTime())) {
      add("fout", "moment", "Moment ontbreekt of heeft geen tijdzone, bv. 2026-10-27T10:00:00+01:00.");
    }
    const tekst = renderText(post.tekst, config);
    const approval = approvalIssue(post, tekst);
    if (approval) add("fout", "goedkeuring", approval);
    const key = tekst.toLowerCase();
    if (tekst && seenTexts.has(key)) add("fout", "dubbel", `Zelfde tekst als "${seenTexts.get(key)}". X weigert dubbele posts.`);
    seenTexts.set(key, post.id);
    issues.push(...checkPost({ categorie: post.categorie, tekst }, config));
    reviewed.push({ id: post.id, soort: "post", categorie: post.categorie, status: post.status, moment, tekst, issues });
  }

  for (const template of templates) {
    const { issues, add } = common(template, "sjabloon");
    if (!WEEKDAYS.includes(template.elke)) add("fout", "elke", `"elke" moet een weekdag zijn: ${WEEKDAYS.join(", ")}.`);
    if (!parseClock(template.om)) add("fout", "om", `"om" moet een uur zijn zoals "10:00".`);
    const tekst = renderText(template.tekst, config);
    const approval = approvalIssue(template, tekst);
    if (approval) add("fout", "goedkeuring", approval);
    // Controleer het sjabloon met voorbeeldwaarden, zodat fouten al bij het schrijven opvallen.
    const sample = renderText(template.tekst, config, SAMPLE_VARS);
    issues.push(...checkPost({ categorie: template.categorie, tekst: sample }, config));
    reviewed.push({ id: template.id, soort: "sjabloon", categorie: template.categorie, status: template.status, moment: null, tekst, issues });
  }

  return reviewed;
}

const nlNumber = (n, decimals = 0) =>
  new Intl.NumberFormat("nl-BE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

/**
 * Zet de cijfers uit data/cijfers.json om naar sjabloonvariabelen in Belgische notatie ("1.234", "12.345,50").
 * Een ontbrekend of onmogelijk cijfer wordt "" met een reden in `problems`, zodat de post geblokkeerd blijft.
 */
export function templateVars(data, week) {
  const vars = { week };
  const problems = {};
  for (const m of METRICS) {
    const raw = data?.[m.veld];
    vars[m.key] = "";
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    const valid = typeof raw === "number" && Number.isFinite(n) && n >= 0 && (!m.geheel || Number.isInteger(n)) && (m.max === undefined || n <= m.max);
    if (!valid) {
      const range = m.max === undefined ? "0 of meer" : `0 tot ${m.max}`;
      problems[m.key] = `"${m.veld}" in data/cijfers.json moet een ${m.geheel ? "geheel " : ""}getal zijn van ${range}.`;
      continue;
    }
    vars[m.key] = nlNumber(n, Number.isInteger(n) ? 0 : 2);
  }
  vars.stand = typeof data?.stand === "string" ? normalize(data.stand).replace(/[.\s]+$/, "") : "";
  return { vars, problems };
}

/**
 * Maakt van elk sjabloon een concrete post voor vorige week, deze week en eventueel komende weken.
 * Cijfers komen uit data/cijfers.json en moeten recent zijn, anders blijft de post geblokkeerd.
 */
export function materializeTemplates(templates, data, config, now, { weeksAhead = 0 } = {}) {
  const tz = config.timezone;
  const out = [];
  const weeks = [];
  for (let offset = -1; offset <= weeksAhead; offset += 1) {
    weeks.push(isoWeek(new Date(now.getTime() + offset * 7 * 86400000), tz));
  }

  for (const template of templates) {
    const clock = parseClock(template.om);
    const dayIndex = WEEKDAYS.indexOf(template.elke);
    if (!clock || dayIndex < 0) continue;
    for (const w of weeks) {
      const date = addDays(w.monday, dayIndex);
      const moment = zonedToUtc({ ...date, ...clock }, tz);
      const id = `${template.id}-${w.year}-w${String(w.week).padStart(2, "0")}`;
      const issues = [];
      const updated = data?.bijgewerkt ? new Date(`${data.bijgewerkt}T00:00:00Z`) : null;
      if (!updated || Number.isNaN(updated.getTime())) {
        issues.push({ niveau: "fout", regel: "cijfers", bericht: "data/cijfers.json heeft geen datum 'bijgewerkt'." });
      } else if (moment.getTime() - updated.getTime() > MAX_DATA_AGE_DAYS * 86400000) {
        issues.push({ niveau: "fout", regel: "cijfers", bericht: `De cijfers zijn ouder dan ${MAX_DATA_AGE_DAYS} dagen. Werk data/cijfers.json bij.` });
      }
      const { vars, problems } = templateVars(data, w.week);
      for (const key of TEMPLATE_KEYS) {
        if (String(template.tekst).includes(`{${key}}`) && vars[key] === "") {
          const bericht = problems[key] ?? `Waarde voor {${key}} ontbreekt in data/cijfers.json.`;
          issues.push({ niveau: "fout", regel: "cijfers", bericht });
        }
      }
      const base = renderText(template.tekst, config);
      const tekst = renderText(template.tekst, config, vars);
      const approval = approvalIssue(template, base);
      if (approval) issues.push({ niveau: "fout", regel: "goedkeuring", bericht: approval });
      issues.push(...checkPost({ categorie: template.categorie, tekst }, config));
      out.push({ id, soort: "sjabloonpost", categorie: template.categorie, status: template.status, moment, tekst, issues });
    }
  }
  return out;
}

function findEntry(doc, id) {
  for (const key of ["posts", "sjablonen"]) {
    const seq = doc.get(key);
    if (!seq || !seq.items) continue;
    for (const item of seq.items) {
      if (item.get && item.get("id") === id) return { map: item, soort: key === "posts" ? "post" : "sjabloon" };
    }
  }
  return null;
}

/** Zet een post of sjabloon op goedgekeurd, gekoppeld aan exact deze tekst. */
export function approve(doc, id, { door, now, config }) {
  const found = findEntry(doc, id);
  if (!found) throw new Error(`Geen post of sjabloon met id "${id}".`);
  const entry = found.map.toJSON();
  const tekst = renderText(entry.tekst, config);
  const toCheck =
    found.soort === "post"
      ? tekst
      : renderText(entry.tekst, config, SAMPLE_VARS);
  const errors = checkPost({ categorie: entry.categorie, tekst: toCheck }, config).filter((i) => i.niveau === "fout");
  if (errors.length > 0) {
    throw new Error(`Kan "${id}" niet goedkeuren:\n- ${errors.map((e) => e.bericht).join("\n- ")}`);
  }
  found.map.set("status", "goedgekeurd");
  found.map.set("goedkeuring", doc.createNode({ door, op: now.toISOString(), hash: approvalHash(tekst) }));
  return { id, hash: approvalHash(tekst) };
}

export function revoke(doc, id) {
  const found = findEntry(doc, id);
  if (!found) throw new Error(`Geen post of sjabloon met id "${id}".`);
  found.map.set("status", "concept");
  found.map.delete("goedkeuring");
  return { id };
}
