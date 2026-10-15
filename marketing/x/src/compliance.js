// Compliance-controle per post. Doel: niets publiceren dat lijkt op een beloofd rendement,
// druk zet, een crypto-hype oproept of een investering aanprijst voor er een geldig aanbod is.
// Dit vervangt geen juridisch nazicht: het vangt de klassieke fouten op vóór een mens goedkeurt.
import { normalize, weightedLength, extractLinks, linkHost, MAX_WEIGHTED_LENGTH } from "./text.js";

export const CATEGORIES = ["product", "ronde", "uitleg", "transparantie", "aanbod"];
export const ABOUT_INVESTING = new Set(["ronde", "uitleg", "transparantie", "aanbod"]);

// Woorden waaruit blijkt dat een post over de investering gaat.
const INVEST_TERMS = [
  /\binvest\w*/,
  /\binleg\b/,
  /\bmede-?eigenaar/,
  /\baandee?l\w*/,
  /\btokens?\b/,
  /\bcommunity-?ronde\b/,
  /\bcrowdfunding\b/,
  /\bwallet\b/,
  /\brendement\b/,
  /\bdividend\w*/,
  /\bescrow\b/,
  /\bfase [123]\b/,
  /\b49 ?%/,
  /\bonafhankelijke waardering\b/,
  /\bkapitaal\w*/,
];

// Altijd verboden. `negatable`: toegestaan als er kort ervoor "geen", "niet", "nooit" of "zonder" staat.
const BANNED = [
  { re: /\bgegarandeerd\b|\bgarantie\b|\bgaranderen\b/, msg: "Beloof geen garanties.", negatable: true },
  { re: /\bzekere? (rendement|winst|opbrengst)\b/, msg: "Beloof geen zeker rendement.", negatable: true },
  { re: /\brisicoloos\b|\bzonder risico('s)?\b|\bgeen risico\b/, msg: "Investeren is nooit zonder risico." },
  { re: /\bpassief inkomen\b|\bsnel rijk\b|\brijk worden\b/, msg: "Geen rijkdomsbeloftes." },
  { re: /\bverdubbel\w*/, msg: "Geen beloftes over waardestijging." },
  { re: /\b(?:[2-9]|[1-9]\d+) ?x\b/, msg: "Geen 'x keer je geld'-taal." },
  { re: /\bmeer waard\b|\bstijgt in waarde\b|\bwaardestijging\b|\bkoersdoel\b|\bkoersstijging\b|\b(zal|gaat) (stijgen|exploderen)\b/, msg: "Geen voorspellingen over de waarde.", negatable: true },
  { re: /\bto the moon\b|\bmoon\b|\blambo\b|\bpump\w*|\bhodl\b|\bwagmi\b|\bape in\b/, msg: "Geen crypto-hypetaal." },
  { re: /\bnu of nooit\b|\blaatste kans\b|\bmis (dit|het) niet\b|\bfomo\b|\bhaast je\b|\bop is op\b/, msg: "Zet geen tijdsdruk." },
  { re: /\bpre-?sale\b|\bico\b|\bido\b|\bairdrop\w*|\btoken ?sale\b|\bwhitelist\w*/, msg: "Geen crypto-verkoopterminologie: dit zijn aandelen." },
  { re: /\broi\b|\bapy\b|\bapr\b|\brendement van\b|\b(jaarlijks|maandelijks) rendement\b/, msg: "Geen rendementscijfers." },
  { re: /\b\d+(?:[.,]\d+)? ?% ?(rendement|return|winst|opbrengst|per jaar|per maand|groei)\b/, msg: "Geen percentages rendement of groei." },
];

// Oproepen om nu te investeren. Enkel toegestaan als het aanbod live is.
const INVEST_CTA = [
  /\binvesteer (nu|vandaag|meteen|direct)\b/,
  /\bnu (investeren|inschrijven|instappen|kopen)\b/,
  /\bschrijf (je )?(nu|vandaag|meteen) in\b/,
  /\binschrijving(en)? (is|zijn) (nu )?(open|geopend)\b/,
  /\bkoop (nu |vandaag )?(je |jouw )?(aandelen|tokens?)\b/,
  /\bstap (nu|vandaag|meteen) in\b/,
];

function isNegated(text, index) {
  const before = text.slice(Math.max(0, index - 40), index);
  return /\b(geen|niet|nooit|zonder)\b(?:\s+\S+){0,3}\s*$/.test(before);
}

function includesPhrase(text, phrase) {
  return phrase ? text.includes(normalize(phrase).toLowerCase()) : true;
}

function hostAllowed(host, allowed) {
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

export function aboutInvesting(text) {
  const lower = normalize(text).toLowerCase();
  return INVEST_TERMS.some((re) => re.test(lower));
}

/**
 * @param {{ id?: string, categorie: string, tekst: string }} post  tekst = definitieve tekst (placeholders ingevuld)
 * @param {object} config  marketing/x/config.json
 * @returns {{ niveau: "fout" | "waarschuwing", regel: string, bericht: string }[]}
 */
export function checkPost(post, config) {
  const issues = [];
  const add = (niveau, regel, bericht) => issues.push({ niveau, regel, bericht });
  const original = normalize(post.tekst ?? "");
  const text = original.toLowerCase();
  const offer = config.offer ?? {};
  const live = offer.status === "live";

  if (!original) add("fout", "leeg", "De post heeft geen tekst.");
  if (!CATEGORIES.includes(post.categorie)) {
    add("fout", "categorie", `Onbekende categorie "${post.categorie}". Kies uit: ${CATEGORIES.join(", ")}.`);
  }

  const length = weightedLength(original);
  if (length > MAX_WEIGHTED_LENGTH) {
    add("fout", "lengte", `Te lang voor X: ${length} van max ${MAX_WEIGHTED_LENGTH} tekens (links tellen als 23).`);
  }

  for (const rule of BANNED) {
    const m = rule.re.exec(text);
    if (m && !(rule.negatable && isNegated(text, m.index))) {
      add("fout", "verboden-taal", `"${m[0]}": ${rule.msg}`);
    }
  }

  if (/(^|\s)\$[a-z][a-z0-9_]{1,10}\b/i.test(original)) {
    add("fout", "cashtag", "Geen cashtags ($...): dat suggereert een verhandelbaar crypto-actief.");
  }

  const investing = aboutInvesting(original);
  if (post.categorie === "product" && investing) {
    add("fout", "categorie", "Deze post gaat over de investering. Kies categorie ronde, uitleg of transparantie.");
  }

  if (!live) {
    if (post.categorie === "aanbod") {
      add("fout", "geen-aanbod", `Categorie "aanbod" kan pas als het aanbod live is (offer.status = live in config.json).`);
    }
    for (const re of INVEST_CTA) {
      const m = re.exec(text);
      if (m) add("fout", "oproep-tot-investeren", `"${m[0]}": geen oproep tot investeren zolang er geen aanbod is.`);
    }
    if (investing || ABOUT_INVESTING.has(post.categorie)) {
      if (!includesPhrase(text, offer.noticeWhenNotLive)) {
        add("fout", "vermelding-ontbreekt", `Vermeld letterlijk "${offer.noticeWhenNotLive}".`);
      }
    }
    if (post.categorie === "ronde" && !includesPhrase(text, offer.riskShort)) {
      add("fout", "risico-ontbreekt", `Vermeld letterlijk "${offer.riskShort}".`);
    }
  } else if (investing || ABOUT_INVESTING.has(post.categorie)) {
    if (!includesPhrase(text, offer.riskLive)) {
      add("fout", "risico-ontbreekt", `Vermeld letterlijk "${offer.riskLive}".`);
    }
    if (!offer.documentsUrl) {
      add("fout", "documenten", "Het aanbod is live maar offer.documentsUrl is leeg in config.json.");
    } else if (!text.includes(normalize(offer.documentsUrl).toLowerCase())) {
      add("fout", "documenten", "Link naar de documenten ontbreekt (gebruik {docs}).");
    }
    if (offer.deMinimisNotice && !includesPhrase(text, offer.deMinimisNotice)) {
      add("fout", "de-minimis", `Vermeld letterlijk "${offer.deMinimisNotice}".`);
    }
  }

  const allowed = config.links?.allowedDomains ?? [];
  for (const link of extractLinks(original)) {
    const host = linkHost(link.raw);
    if (!hostAllowed(host, allowed)) {
      add("fout", "link", `Link naar ${host || link.raw} staat niet op de lijst van toegelaten domeinen.`);
    }
  }

  const hashtags = original.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? [];
  if (hashtags.length > (config.maxHashtags ?? 2)) {
    add("fout", "hashtags", `Max ${config.maxHashtags ?? 2} hashtags.`);
  }
  if (/(^|\s)@\w{1,15}/.test(original)) {
    add("waarschuwing", "vermelding", "Je tagt een account. Doe dat enkel met hun toestemming.");
  }
  if ((original.match(/\p{Extended_Pictographic}/gu) ?? []).length > 2) {
    add("waarschuwing", "emoji", "Meer dan 2 emoji oogt niet professioneel.");
  }
  if ((original.match(/!/g) ?? []).length > 1) {
    add("waarschuwing", "uitroeptekens", "Max 1 uitroepteken.");
  }
  if (/\b[A-Z]{4,}\b(?:\s+[A-Z]{4,}\b)+/.test(original)) {
    add("waarschuwing", "hoofdletters", "Geen woorden in hoofdletters achter elkaar.");
  }

  return issues;
}

export function hasErrors(issues) {
  return issues.some((i) => i.niveau === "fout");
}
