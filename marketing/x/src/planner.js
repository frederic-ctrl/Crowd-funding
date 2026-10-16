// Beslist welke posts nu geplaatst mogen worden, en waarom de andere (nog) niet.
import { hasErrors, aboutGenesis, ABOUT_GENESIS } from "./compliance.js";
import { hasLink } from "./text.js";
import { minutesOfDay, localDateKey, parseClock } from "./time.js";

export const STATE = {
  geplaatst: "geplaatst",
  geblokkeerd: "geblokkeerd",
  goedkeuring: "wacht op goedkeuring",
  juridisch: "wacht op juridisch nazicht",
  gepland: "gepland",
  gemist: "gemist",
  klaar: "klaar",
  buitenVenster: "buiten postvenster",
  tussentijd: "wacht op tussentijd",
  dagmax: "daglimiet bereikt",
};

// Posts over Genesis (de voorverkoop, passes, wallets) gaan pas de deur uit als iemand bevestigt
// dat ze juridisch nagelezen zijn (offer.legalReviewDone in config.json). Productposts kunnen meteen.
export function needsLegalReview(post, config) {
  if (config.offer?.legalReviewDone === true) return false;
  return ABOUT_GENESIS.has(post.categorie) || aboutGenesis(post.tekst);
}

export function estimateCostUsd(text, pricing) {
  return hasLink(text) ? pricing.postWithUrl : pricing.post;
}

/**
 * @param {{ posts: object[], state: { posts: object[] }, config: object, now: Date }} input
 *   posts: uit reviewCalendar (soort "post") en materializeTemplates (soort "sjabloonpost")
 */
export function plan({ posts, state, config, now }) {
  const s = config.schedule;
  const tz = config.timezone;
  const posted = new Map(state.posts.map((p) => [p.id, p]));
  const maxDelayMs = s.maxDelayHours * 3600000;

  const items = posts
    .filter((p) => p.soort !== "sjabloon")
    .map((p) => {
      let status;
      if (posted.has(p.id)) status = STATE.geplaatst;
      else if (hasErrors(p.issues)) status = STATE.geblokkeerd;
      else if (p.status !== "goedgekeurd") status = STATE.goedkeuring;
      else if (needsLegalReview(p, config)) status = STATE.juridisch;
      else if (!p.moment || p.moment.getTime() > now.getTime()) status = STATE.gepland;
      else if (now.getTime() - p.moment.getTime() > maxDelayMs) status = STATE.gemist;
      else status = STATE.klaar;
      return { ...p, plan: status, kostUsd: estimateCostUsd(p.tekst, config.pricingUsd) };
    })
    .sort((a, b) => (a.moment?.getTime() ?? Infinity) - (b.moment?.getTime() ?? Infinity));

  const ready = items.filter((i) => i.plan === STATE.klaar);
  const toPost = [];

  const from = parseClock(s.postingWindow.from);
  const to = parseClock(s.postingWindow.to);
  const nowMinutes = minutesOfDay(now, tz);
  const inWindow = nowMinutes >= from.hour * 60 + from.minute && nowMinutes <= to.hour * 60 + to.minute;

  const history = state.posts.map((p) => new Date(p.geplaatstOp)).filter((d) => !Number.isNaN(d.getTime()));
  const lastPosted = history.length ? Math.max(...history.map((d) => d.getTime())) : null;
  const today = localDateKey(now, tz);
  let postedToday = history.filter((d) => localDateKey(d, tz) === today).length;
  const gapOk = lastPosted === null || now.getTime() - lastPosted >= s.minGapMinutes * 60000;

  // Met een minimale tussentijd gaat er per run hooguit één post de deur uit.
  const perRun = s.minGapMinutes > 0 ? Math.min(1, s.maxPostsPerRun) : s.maxPostsPerRun;

  for (const item of ready) {
    if (!inWindow) item.plan = STATE.buitenVenster;
    else if (!gapOk || toPost.length >= perRun) item.plan = STATE.tussentijd;
    else if (postedToday >= s.maxPostsPerDay) item.plan = STATE.dagmax;
    else {
      toPost.push(item);
      postedToday += 1;
    }
  }

  return { items, toPost };
}
