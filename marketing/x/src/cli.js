#!/usr/bin/env node
// Opdrachten voor de X-promotie:
//   lint                      controleer de hele kalender (ook in CI)
//   plan [--dagen 30]         toon wat wanneer gepost wordt, met kostenraming
//   post [--nu <tijdstip>]    plaats wat nu klaar is (droogtest tenzij X_POSTING_ENABLED=true)
//   approve <id> --door <naam>  keur een post of sjabloon goed (gekoppeld aan de exacte tekst)
//   revoke <id>               trek een goedkeuring in
//   cijfers                   werk data/cijfers.json bij met de stand van Genesis op de site
//   stats [--dagen 7] [--alles]  haal weergaven en klikken op van geplaatste testposts (state/statistieken.json)
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCalendar, saveCalendar, reviewCalendar, materializeTemplates, approve, revoke } from "./calendar.js";
import { plan, STATE } from "./planner.js";
import { createXClient, publish } from "./poster.js";
import { fetchWaitlistCount, fetchGenesisState, applyGenesisState } from "./metrics.js";
import { weightedLength, MAX_WEIGHTED_LENGTH } from "./text.js";
import { localDateKey } from "./time.js";
import { hasErrors, saleLive, defaultLang } from "./compliance.js";

const BASE = process.env.X_PROMO_DIR || fileURLToPath(new URL("..", import.meta.url));
const PATHS = {
  config: join(BASE, "config.json"),
  calendar: join(BASE, "kalender.yaml"),
  data: join(BASE, "data", "cijfers.json"),
  state: join(BASE, "state", "geplaatst.json"),
  stats: join(BASE, "state", "statistieken.json"),
};

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback);

function option(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function nowFrom(args) {
  const raw = option(args, "nu");
  const now = raw ? new Date(raw) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Ongeldig tijdstip voor --nu: ${raw}`);
  return now;
}

function fmtMoment(date, tz) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

function cmdLint() {
  const config = readJson(PATHS.config);
  const calendar = loadCalendar(PATHS.calendar);
  const reviewed = reviewCalendar(calendar, config);
  let errors = 0;
  let warnings = 0;
  const offer = config.offer ?? {};
  console.log(
    `Kalender: ${calendar.posts.length} posts, ${calendar.templates.length} sjabloon(en). Standaardtaal: ${defaultLang(config)}. ` +
      `Verkoop: ${saleLive(config) ? "live" : "nog niet live"} (verkoopActief: ${offer.verkoopActief === true}, legalReviewDone: ${offer.legalReviewDone === true}).\n`,
  );
  for (const r of reviewed) {
    const len = weightedLength(r.tekst);
    const bad = hasErrors(r.issues);
    console.log(`${bad ? "FOUT" : "OK  "}  ${r.id}  (${r.soort}, ${r.categorie}, ${r.lang}, ${r.status}, ${len}/${MAX_WEIGHTED_LENGTH})`);
    for (const i of r.issues) {
      console.log(`      ${i.niveau} [${i.regel}] ${i.bericht}`);
      if (i.niveau === "fout") errors += 1;
      else warnings += 1;
    }
  }
  console.log(`\n${errors} fout(en), ${warnings} waarschuwing(en).`);
  summary(`### X-kalender\n${reviewed.length} items, ${errors} fout(en), ${warnings} waarschuwing(en).`);
  return errors > 0 ? 1 : 0;
}

async function gather(now, { live = false, weeksAhead = 0 } = {}) {
  const config = readJson(PATHS.config);
  const calendar = loadCalendar(PATHS.calendar);
  const data = readJson(PATHS.data, {});
  if (live) {
    const count = await fetchWaitlistCount().catch((err) => {
      console.log(`Let op: wachtlijst niet geteld (${err.message}). Ik gebruik data/cijfers.json.`);
      return null;
    });
    if (count !== null) data.wachtlijst = count;
  }
  const state = readJson(PATHS.state, { posts: [] });
  const posts = [
    ...reviewCalendar(calendar, config).filter((r) => r.soort === "post"),
    ...materializeTemplates(calendar.templates, data, config, now, { weeksAhead }),
  ];
  return { config, state, ...plan({ posts, state, config, now }) };
}

async function cmdPlan(args) {
  const now = nowFrom(args);
  const days = Number(option(args, "dagen") ?? 30);
  const { config, items } = await gather(now, { weeksAhead: Math.ceil(days / 7) });
  const horizon = now.getTime() + days * 86400000;
  const stale = now.getTime() - config.schedule.maxDelayHours * 3600000;
  const shown = items.filter(
    (i) =>
      i.plan !== STATE.geplaatst &&
      (!i.moment || i.moment.getTime() <= horizon) &&
      !(i.soort === "sjabloonpost" && i.moment && i.moment.getTime() < stale),
  );
  console.log(`Planning vanaf ${fmtMoment(now, config.timezone)} voor ${days} dagen (${config.timezone}):\n`);
  let cost = 0;
  for (const i of shown) {
    cost += i.kostUsd;
    console.log(`${fmtMoment(i.moment, config.timezone).padEnd(22)} ${i.plan.padEnd(22)} $${i.kostUsd.toFixed(3)}  ${String(i.lang ?? "").padEnd(2)}  ${i.id}`);
  }
  console.log(`\n${shown.length} post(s), geschatte kost: $${cost.toFixed(2)} (link: $${config.pricingUsd.postWithUrl}, zonder link: $${config.pricingUsd.post}).`);
  const done = items.filter((i) => i.plan === STATE.geplaatst).length;
  if (done) console.log(`${done} post(s) al geplaatst.`);
  return 0;
}

async function cmdPost(args) {
  const now = nowFrom(args);
  const { config, state, items, toPost } = await gather(now, { live: true });
  const enabled = process.env.X_POSTING_ENABLED === "true" && config.paused !== true;
  if (!enabled) {
    console.log(
      config.paused
        ? "Gepauzeerd (paused: true in config.json). Droogtest."
        : "Droogtest: zet de repository-variabele X_POSTING_ENABLED op true om echt te posten.",
    );
  }
  const blocked = items.filter((i) => i.plan === STATE.geblokkeerd && i.moment && i.moment <= now);
  for (const b of blocked) console.log(`Geblokkeerd: ${b.id}: ${b.issues.filter((x) => x.niveau === "fout").map((x) => x.bericht).join(" ")}`);
  if (toPost.length === 0) {
    console.log("Niets te posten op dit moment.");
    summary("### X-promotie\nNiets te posten op dit moment.");
    return 0;
  }
  const client = enabled ? createXClient() : null;
  const { geplaatst, fouten } = await publish({ toPost, state, client, enabled, now });
  if (geplaatst.length > 0) writeFileSync(PATHS.state, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const lines = ["### X-promotie"];
  if (!enabled) lines.push(`Droogtest. Zou posten: ${toPost.map((t) => t.id).join(", ")}`);
  for (const g of geplaatst) lines.push(`Geplaatst: [${g.id}](${g.url})`);
  for (const f of fouten) lines.push(`Fout bij ${f.id}: ${f.bericht}`);
  summary(lines.join("\n\n"));
  return fouten.length > 0 ? 1 : 0;
}

function cmdApprove(args) {
  const id = args[0];
  const door = option(args, "door");
  if (!id || !door) throw new Error("Gebruik: approve <id> --door <naam>");
  const config = readJson(PATHS.config);
  const { doc, baseDir } = loadCalendar(PATHS.calendar);
  const res = approve(doc, id, { door, now: new Date(), config, baseDir });
  saveCalendar(PATHS.calendar, doc);
  console.log(`Goedgekeurd: ${res.id} (hash ${res.hash}) door ${door}.`);
  summary(`### Goedgekeurd\n\`${res.id}\` door ${door} (hash \`${res.hash}\`).`);
  return 0;
}

function cmdRevoke(args) {
  const id = args[0];
  if (!id) throw new Error("Gebruik: revoke <id>");
  const { doc } = loadCalendar(PATHS.calendar);
  revoke(doc, id);
  saveCalendar(PATHS.calendar, doc);
  console.log(`Goedkeuring ingetrokken: ${id}.`);
  return 0;
}

async function cmdCijfers() {
  const config = readJson(PATHS.config);
  const state = await fetchGenesisState(config.links.site);
  const data = applyGenesisState(readJson(PATHS.data, {}), state, localDateKey(new Date(), config.timezone));
  writeFileSync(PATHS.data, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const note = state.netwerk === "mainnet-beta" ? "" : ` (netwerk ${state.netwerk}: demo-aankopen tellen niet mee)`;
  console.log(`Cijfers bijgewerkt${note}: ${data.passesGeclaimd} passes, ${data.agencyGeclaimd} agency, ${data.supporters} supporters, €${data.opgehaaldEur}.`);
  return 0;
}

/**
 * Haalt de resultaten op van geplaatste posts van de laatste dagen. Standaard enkel posts uit een
 * test (veld `test` in de kalender): elke gelezen post kost geld ($0.005), dus niet alles elke dag.
 */
async function cmdStats(args) {
  const days = Number(option(args, "dagen") ?? 7);
  const all = args.includes("--alles");
  const state = readJson(PATHS.state, { posts: [] });
  const since = Date.now() - days * 86400000;
  const posts = state.posts.filter((p) => p.tweetId && new Date(p.geplaatstOp).getTime() >= since && (all || p.test));
  if (posts.length === 0) {
    console.log(`Geen ${all ? "" : "testposts "}van de laatste ${days} dagen om op te halen.`);
    return 0;
  }
  if (process.env.X_POSTING_ENABLED !== "true") {
    console.log(`Droogtest: zou de resultaten van ${posts.length} post(s) ophalen (kost ongeveer $${(posts.length * 0.005).toFixed(3)}).`);
    return 0;
  }
  const metrics = await createXClient().metrics(posts.map((p) => p.tweetId));
  const byTweet = new Map(metrics.map((m) => [m.tweetId, m]));
  const stats = readJson(PATHS.stats, { posts: [] });
  const keep = new Map(stats.posts.map((s) => [s.tweetId, s]));
  const nu = new Date().toISOString();
  for (const p of posts) {
    const m = byTweet.get(p.tweetId);
    if (m) keep.set(p.tweetId, { id: p.id, test: p.test ?? null, variant: p.variant ?? null, afbeelding: p.afbeelding ?? null, geplaatstOp: p.geplaatstOp, gemeten: nu, ...m });
  }
  const rows = [...keep.values()].sort((a, b) => (a.test ?? "").localeCompare(b.test ?? "") || (a.variant ?? "").localeCompare(b.variant ?? ""));
  writeFileSync(PATHS.stats, `${JSON.stringify({ bijgewerkt: nu, posts: rows }, null, 2)}\n`, "utf8");
  const pct = (a, b) => (a === null || !b ? "-" : `${((a / b) * 100).toFixed(1)}%`);
  const lines = ["| Test | Variant | Post | Weergaven | Likes | Reposts | Reacties | Linkklikken | Klikratio |", "|---|---|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    lines.push(`| ${r.test ?? ""} | ${r.variant ?? ""} | ${r.id} | ${r.weergaven ?? "-"} | ${r.likes} | ${r.reposts} | ${r.reacties} | ${r.linkklikken ?? "-"} | ${pct(r.linkklikken, r.weergaven)} |`);
  }
  console.log(lines.join("\n"));
  summary(`### Resultaten op X\n${lines.join("\n")}`);
  return 0;
}

const [command, ...rest] = process.argv.slice(2);
const commands = { lint: cmdLint, plan: cmdPlan, post: cmdPost, approve: cmdApprove, revoke: cmdRevoke, cijfers: cmdCijfers, stats: cmdStats };

try {
  if (!commands[command]) {
    console.log("Gebruik: cli.js <lint|plan|post|approve|revoke|cijfers|stats> [opties]");
    process.exit(2);
  }
  process.exitCode = await commands[command](rest);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
