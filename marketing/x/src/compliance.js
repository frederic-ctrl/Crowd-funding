// Compliance-controle per post. Marketing Scan Genesis is een voorverkoop van levenslange
// abonnementen, geen investering. Doel: niets publiceren dat lijkt op een investering of een
// effect, druk zet, crypto-hype oproept of tot kopen aanzet voor de verkoop echt open is.
// Dit vervangt geen juridisch nazicht: het vangt de klassieke fouten op voor een mens goedkeurt.
import { normalize, weightedLength, extractLinks, linkHost, MAX_WEIGHTED_LENGTH } from "./text.js";

export const CATEGORIES = ["product", "genesis", "uitleg", "transparantie", "verkoop"];
// Categorieën over Genesis: verplichte vermeldingen en wachten op juridisch nazicht.
export const ABOUT_GENESIS = new Set(["genesis", "uitleg", "transparantie", "verkoop"]);

// Vaste standaardteksten, zodat een vergeten sleutel in config.json nooit een vermelding uitschakelt.
export const DEFAULT_REQUIRED = "Geen investering";
export const DEFAULT_NOTICE = "Nog geen verkoop";

// Woorden waaruit blijkt dat een post over Genesis, de voorverkoop, wallets of passes gaat.
const GENESIS_TERMS = [
  /\bgenesis\b/,
  /\bpass(?:es)?\b/,
  /\b(?:agency|test)-?pass\w*/,
  /\bvoorverkoop\b/,
  /\bsupporter\w*/,
  /\blevenslang\w*/,
  /\blifetime\b/,
  /\bprijsladder\b/,
  /\bwallets?\b/,
  /\bsolana\b/,
  /\bsoulbound\b/,
  /\btokens?\b/,
  /\bblockchain\b/,
  /\bon-?chain\b/,
  /\bcrypto\w*/,
  /\bnfts?\b/,
  /\bgeld terug\b/,
  /\bterugbetal\w*/,
  /\bcrowdfunding\b/,
  /\btreasury\b/,
  // Alles wat naar een investering verwijst, ook ontkend ("geen aandelen"), hoort niet in een productpost.
  /\binvest\w*/,
  /\bbelegg\w*/,
  /\baandee?l\w*/,
  /\bmede-?eigena\w*/,
  /\bshares\b/,
  /\bequity\b/,
  /\brendement\w*/,
  /\bdividend\w*/,
];

// Altijd verboden. `negatable`: toegestaan als er vlak ervoor een ontkenning staat
// ("geen investering", "not an investment", "niet verhandelbaar"). Bewust strikt: hooguit
// een lidwoord tussen de ontkenning en het woord, zodat "geen gedoe, wel rendement" geblokkeerd blijft.
const BANNED = [
  {
    re: /\binvest\w*|\bbelegg\w*/g,
    msg: 'Genesis is geen investering. Gebruik dit woord enkel ontkend, zoals in "Geen investering".',
    negatable: true,
  },
  {
    re: /\baandee?l\w*|\bshares\b|\bshareholders?\b|\bequity\b|\bmede-?eigena\w*|\bco-?owners?\w*|\bsecurity tokens?\b|\bsecurities\b/g,
    msg: "Geen aandelen of eigendom: een pass is een abonnement.",
    negatable: true,
  },
  {
    re: /\brendement\w*|\breturns?\b|\broi\b|\bapy\b|\bapr\b|\byield\w*|\bwinst\w*|\bprofit\w*|\bdividend\w*/g,
    msg: "Geen rendement, winst of dividend: een pass is een abonnement.",
    negatable: true,
  },
  {
    re: /\bwaardering\w*|\bvaluation\w*|\bwaardestijging\w*|\bmeer waard\b|\bin waarde\b|\bwaarde\b[^.!?\n]{0,25}?\b(?:stijg\w*|groei\w*|hoger|omhoog|verdubbel\w*|toenem\w*|neemt toe)|\bin value\b|\bworth more\b|\bvalue\b[^.!?\n]{0,25}?\b(?:go(?:es)? up|going up|ris(?:e|es|ing)|increas\w*|grow\w*)|\bkoersdoel\w*|\bkoersstijging\w*|\b(?:zal|gaat|zullen|gaan) exploderen\b/g,
    msg: "Geen uitspraken over waarde of waardestijging. De aankoopprijzen van de prijsladder mag je wel noemen.",
    negatable: true,
  },
  {
    re: /\bdoorverk\w*|\bdoor te verkopen\b|\bherverk\w*|\bresell\w*|\bresale\w*|\bflip\w*|\bsecondary market\b|\bsecundaire markt\b|\bverhandel\w*|\bspecul\w*|\btrad(?:e)?able\b|\bfloor ?price\b|\bfloorprijs\b|\bopensea\b|\bmagic ?eden\b/g,
    msg: "Geen taal over doorverkopen, verhandelen of speculeren: passes zijn soulbound.",
    negatable: true,
  },
  {
    re: /\bbeursnotering\w*|\bop de beurs\b|\bexchange listing\b|\blisted on\b/g,
    msg: "Geen beursnotering of listing: passes zijn niet verhandelbaar.",
    negatable: true,
  },
  {
    re: /\bgegarandeerd\w*|\bgaranderen\b|\bgarandeert\b|\bguaranteed\b/g,
    msg: "Beloof geen garanties.",
    negatable: true,
  },
  {
    re: /\brisicoloos\b|\bzonder risico(?:'s)?\b|\bgeen risico(?:'s)?\b|\brisk-?free\b|\bno risk\b/g,
    msg: "Beloof niet dat iets zonder risico is.",
  },
  {
    re: /\bpassief inkomen\b|\bpassive income\b|\bsnel rijk\b|\brijk worden\b|\bget rich\b/g,
    msg: "Geen rijkdomsbeloftes.",
  },
  {
    re: /\b(?:[2-9]|[1-9]\d+) ?x\b(?! per\b)|\b(?:keer|maal) (?:je|jouw|uw) (?:geld|inleg|inzet)\b|\bverdubbel\w* (?:je|jouw|uw) (?:geld|inleg|inzet)\b|\b(?:geld|inleg|inzet) verdubbel\w*|\b(?:double|triple|\d+x) your money\b/g,
    msg: "Geen 'x keer je geld'-taal.",
  },
  {
    re: /\bto the moon\b|\bmoon\w*|\blambo\w*|\bpump\w*|\bhodl\w*|\bwagmi\b|\bngmi\b|\bape[ds]? in\b|\baping\b|\bdegen\w*|\bbullish\b|\blfg\b|\b(?:diamond|paper) hands\b/g,
    msg: "Geen crypto-hypetaal.",
  },
  {
    re: /\bnu of nooit\b|\bnow or never\b|\blaatste kans\b|\blast chance\b|\bmis (?:dit|het|je kans) niet\b|\bdon'?t miss\b|\bfomo\b|\bhaast je\b|\bhurry\b|\bop is op\b|\bwees er (?:snel|vlug) bij\b|\bvoor het te laat is\b|\bbefore it'?s too late\b/g,
    msg: "Zet geen tijdsdruk.",
  },
  {
    re: /\bpre-?sale\w*|\bico\b|\bido\b|\bieo\b|\btge\b|\btoken ?sale\b|\btoken-?verkoop\b|\bairdrop\w*|\bwhitelist\w*|\ballowlist\w*|\blaunchpad\w*/g,
    msg: 'Geen crypto-verkooptermen: het is een "voorverkoop" van een abonnement.',
  },
  {
    re: /\b\d+(?:[.,]\d+)? ?% ?(?:rendement|return|winst|opbrengst|rente|per jaar|per maand|per year|per month|apy|apr)\b/g,
    msg: "Geen rendementspercentages.",
  },
];

// Koopoproepen. Enkel toegestaan in categorie "verkoop", en pas als de verkoop live is.
const BUY_CTA = [
  /\b(?:koop|bestel|claim|reserveer|mint|bemachtig) (?:hem |ze |er een )?(?:nu|vandaag|meteen|direct|snel)\b/,
  /\bnu (?:kopen|aankopen|bestellen|claimen|reserveren|minten|bemachtigen)\b/,
  /\b(?:claim|bestel|reserveer|bemachtig|mint) (?:je|jouw|uw|een)\b/,
  /\bkoop (?:je|jouw|uw|een|de) \w*\s*(?:genesis|pass\w*|agency|supporter\w*|nummer|abonnement)\b/,
  /\b(?:buy|mint|claim|order|grab|get|secure) (?:now|today|yours|your (?:pass|spot|number))\b/,
  /\bword (?:nu |vandaag |meteen )?supporter\b/,
  /\bsteun (?:ons )?(?:nu|vandaag|meteen)\b/,
  /\b(?:verkoop|voorverkoop|sale|mint) (?:is |staat )?(?:nu |vanaf nu )?(?:open|geopend|live|gestart|begonnen)\b/,
  /\b(?:verkoop|voorverkoop) (?:opent|start|begint) (?:nu|vandaag)\b/,
];

const NEGATION =
  /\b(?:geen|niet|nooit|niets|zonder|noch|no|not|never|nothing|without|nor|isn't|aren't|wasn't|won't|can't|cannot)\s+(?:(?:een|de|het|enkele?|enige|echte|a|an|any|the|real)\s+)?$/;

function isNegated(text, index) {
  return NEGATION.test(text.slice(Math.max(0, index - 40), index));
}

function includesPhrase(text, phrase) {
  return text.includes(normalize(phrase).toLowerCase());
}

function hostAllowed(host, allowed) {
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Verkoop is pas live als de verkoop actief is en het juridisch nazicht gebeurd is. */
export function saleLive(config) {
  const offer = config.offer ?? {};
  return offer.verkoopActief === true && offer.legalReviewDone === true;
}

export function aboutGenesis(text) {
  const lower = normalize(text).toLowerCase();
  return GENESIS_TERMS.some((re) => re.test(lower));
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
  const live = saleLive(config);
  const required = offer.required || DEFAULT_REQUIRED;
  const notice = offer.noticeWhenNotLive || DEFAULT_NOTICE;

  if (!original) add("fout", "leeg", "De post heeft geen tekst.");
  if (!CATEGORIES.includes(post.categorie)) {
    add("fout", "categorie", `Onbekende categorie "${post.categorie}". Kies uit: ${CATEGORIES.join(", ")}.`);
  }

  const length = weightedLength(original);
  if (length > MAX_WEIGHTED_LENGTH) {
    add("fout", "lengte", `Te lang voor X: ${length} van max ${MAX_WEIGHTED_LENGTH} tekens (links tellen als 23).`);
  }

  for (const rule of BANNED) {
    for (const m of text.matchAll(rule.re)) {
      if (rule.negatable && isNegated(text, m.index)) continue;
      add("fout", "verboden-taal", `"${m[0]}": ${rule.msg}`);
      break;
    }
  }

  if (/(^|\s)\$[a-z][a-z0-9_]{1,10}\b/i.test(original)) {
    add("fout", "cashtag", "Geen cashtags ($...): dat suggereert een verhandelbaar crypto-actief.");
  }

  const genesis = aboutGenesis(original);
  if (post.categorie === "product" && genesis) {
    add("fout", "categorie", "Deze post gaat over Genesis. Kies categorie genesis, uitleg, transparantie of verkoop.");
  }
  const needsNotices = genesis || ABOUT_GENESIS.has(post.categorie);

  if (needsNotices && !includesPhrase(text, required)) {
    add("fout", "disclaimer-ontbreekt", `Vermeld letterlijk "${required}".`);
  }

  if (post.categorie === "verkoop" && !live) {
    const missing = ["verkoopActief", "legalReviewDone"].filter((k) => offer[k] !== true).map((k) => `offer.${k}`);
    add("fout", "verkoop-gesloten", `Categorie "verkoop" kan pas als de verkoop live is: zet ${missing.join(" en ")} op true in config.json.`);
  }

  for (const re of BUY_CTA) {
    const m = re.exec(text);
    if (!m) continue;
    if (!live) add("fout", "koopoproep", `"${m[0]}": geen koopoproep zolang de verkoop niet live is.`);
    else if (post.categorie !== "verkoop") add("fout", "koopoproep", `"${m[0]}": koopoproepen horen in categorie "verkoop".`);
  }

  if (!live) {
    if (needsNotices && !includesPhrase(text, notice)) {
      add("fout", "vermelding-ontbreekt", `Vermeld letterlijk "${notice}".`);
    }
  } else {
    if (needsNotices && includesPhrase(text, notice)) {
      add("waarschuwing", "vermelding-verouderd", `"${notice}" klopt niet meer: de verkoop is live.`);
    }
    if (post.categorie === "verkoop") {
      if (!offer.voorwaardenUrl) {
        add("fout", "voorwaarden", "De verkoop is live maar offer.voorwaardenUrl is leeg in config.json.");
      } else if (!text.includes(normalize(offer.voorwaardenUrl).toLowerCase())) {
        add("fout", "voorwaarden", "Link naar de voorwaarden ontbreekt (gebruik {voorwaarden}).");
      }
    }
  }

  const allowed = config.links?.allowedDomains ?? [];
  for (const link of extractLinks(original)) {
    const host = linkHost(link.raw);
    if (!hostAllowed(host, allowed)) {
      add("fout", "link", `Link naar ${host || link.raw} staat niet op de lijst van toegelaten domeinen.`);
    }
  }

  // X maakt enkel een hashtag van # met minstens een letter: "#001" telt dus niet mee.
  const hashtags = original.match(/(^|\s)#(?=[\p{N}_]*\p{L})[\p{L}\p{N}_]+/gu) ?? [];
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
