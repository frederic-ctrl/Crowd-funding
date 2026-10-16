// Compliance-controle per post. Marketing Scan Genesis is een voorverkoop van levenslange
// abonnementen, geen investering. Doel: niets publiceren dat lijkt op een investering of een
// effect, druk zet, crypto-hype oproept of tot kopen aanzet voor de verkoop echt open is.
// Elke post heeft een taal (Engels of Nederlands). De verboden woorden gelden altijd in beide
// talen; de verplichte vermeldingen moeten in de taal van de post staan.
// Dit vervangt geen juridisch nazicht: het vangt de klassieke fouten op voor een mens goedkeurt.
import { normalize, weightedLength, extractLinks, linkHost, MAX_WEIGHTED_LENGTH } from "./text.js";

export const CATEGORIES = ["product", "genesis", "uitleg", "transparantie", "verkoop", "steun"];
// Categorieën over Genesis of crypto: verplichte vermeldingen en wachten op juridisch nazicht.
// "steun" is een oproep tot een gift in crypto via de steunpagina (/steun): geen verkoop, dus in
// plaats van "Not on sale yet" de vermelding dat het een gift is zonder iets terug.
export const ABOUT_GENESIS = new Set(["genesis", "uitleg", "transparantie", "verkoop", "steun"]);

// Talen. Een post kiest zijn taal met het veld `lang`, anders geldt `defaultLang` uit config.json.
export const LANGS = ["en", "nl"];
export const DEFAULT_LANG = "en";

// Vaste standaardteksten per taal, zodat een vergeten sleutel in config.json nooit een vermelding uitschakelt.
export const DEFAULT_REQUIRED = { en: "Not an investment", nl: "Geen investering" };
export const DEFAULT_NOTICE = { en: "Not on sale yet", nl: "Nog geen verkoop" };
export const DEFAULT_GIFT = { en: "A gift, nothing in return", nl: "Een gift, zonder iets terug" };

export function defaultLang(config) {
  return config?.defaultLang ?? DEFAULT_LANG;
}

/** Taal van een post of sjabloon: het veld `lang`, anders `defaultLang` uit config.json. */
export function postLang(post, config) {
  return post?.lang ?? defaultLang(config);
}

// Een vermelding in config.json is { "en": "...", "nl": "..." }. De oude vorm, een gewone
// string, blijft geldig en telt als de Nederlandse tekst.
function localized(value, lang, defaults) {
  const byLang = typeof value === "string" ? { nl: value } : value && typeof value === "object" ? value : {};
  const text = byLang[lang];
  return typeof text === "string" && text.trim() ? text.trim() : defaults[lang];
}

/**
 * De verplichte vermeldingen in een taal: `required` (altijd), `notice` (zolang de verkoop niet
 * live is) en `gift` (in categorie steun, in plaats van `notice`).
 */
export function offerTexts(config, lang) {
  const offer = config?.offer ?? {};
  return {
    required: localized(offer.required, lang, DEFAULT_REQUIRED),
    notice: localized(offer.noticeWhenNotLive, lang, DEFAULT_NOTICE),
    gift: localized(offer.giftNotice, lang, DEFAULT_GIFT),
  };
}

// Woorden waaruit blijkt dat een post over Genesis, de voorverkoop, wallets of passes gaat.
const GENESIS_TERMS = [
  /\bgenesis\b/,
  /\bpass(?:es)?\b/,
  /\b(?:agency|test)-?pass\w*/,
  /\bvoorverkoop\b/,
  /\bearly access\b/,
  /\bfounding members?\b/,
  /\bsupporter\w*/,
  /\blevenslang\w*/,
  /\blifetime\b/,
  /\bprijsladder\b/,
  /\bprice ladder\b/,
  /\bwallets?\b/,
  /\bsolana\b/,
  /\bsoulbound\b/,
  /\btokens?\b/,
  /\bmint(?:s|ed|ing)?\b/,
  /\bblockchain\b/,
  /\bon-?chain\b/,
  /\b(?:dev|test)net\b/,
  /\bcrypto\w*/,
  /\bnfts?\b/,
  /\bgeld terug\b/,
  /\bmoney back\b/,
  /\bterugbetal\w*/,
  /\brefund\w*/,
  /\bcrowdfunding\b/,
  /\btreasury\b/,
  // Alles wat naar een investering verwijst, ook ontkend ("geen aandelen", "no shares"), hoort niet in een productpost.
  /\binvest\w*/,
  /\bbelegg\w*/,
  /\baandee?l\w*/,
  /\bmede-?eigena\w*/,
  /\bshares\b/,
  /\bequity\b/,
  /\brendement\w*/,
  /\bprofit\w*/,
  /\byield\w*/,
  /\bdividend\w*/,
];

// Altijd verboden, in beide talen. `negatable`: toegestaan als er vlak ervoor een ontkenning staat
// ("geen investering", "not an investment", "niet verhandelbaar", "no shares"). Bewust strikt: hooguit
// een lidwoord tussen de ontkenning en het woord, zodat "geen gedoe, wel rendement" en
// "not an investment, but huge returns" geblokkeerd blijven.
const BANNED = [
  {
    re: /\binvest\w*|\bbelegg\w*/g,
    msg: 'Genesis is geen investering. Gebruik dit woord enkel ontkend, zoals in "Not an investment" of "Geen investering".',
    negatable: true,
  },
  {
    re: /\baandee?l\w*|\bshares\b|\bshareholders?\b|\bequity\b|\bmede-?eigena\w*|\bco-?owners?\w*|\bown (?:a )?(?:piece|part|share|stake) (?:of|in)\b|\ba share (?:of|in)\b|\bstake in\b|\bsecurity tokens?\b|\bsecurities\b/g,
    msg: "Geen aandelen of eigendom: een pass is een abonnement.",
    negatable: true,
  },
  {
    re: /\brendement\w*|(?<!\bin )\breturns?\b|\broi\b|\bapy\b|\bapr\b|\byield\w*|\bwinst\w*|\bprofit\w*|\bdividend\w*|\brevenue[- ]?shar\w*|\bstaking\b|\binterest rates?\b|\brente\b/g,
    msg: "Geen rendement, winst of dividend: een pass is een abonnement.",
    negatable: true,
  },
  {
    re: /\bwaardering\w*|\bvaluation\w*|\bwaardestijging\w*|\bmeer waard\b|\bin waarde\b|\bwaarde\b[^.!?\n]{0,25}?\b(?:stijg\w*|groei\w*|hoger|omhoog|verdubbel\w*|toenem\w*|neemt toe)|\bin value\b|\bworth more\b|\bwill be worth\b|\b(?:gain|gains|gaining) value\b|\bvalue\b[^.!?\n]{0,25}?\b(?:go(?:es)? up|going up|ris(?:e|es|ing)|increas\w*|grow\w*)|\bupside\b|\bmarket ?cap\w*|\bprice targets?\b|\bkoersdoel\w*|\bkoersstijging\w*|\b(?:zal|gaat|zullen|gaan) exploderen\b|\b(?:will|going to|gonna) (?:explode|skyrocket)\b|\bskyrocket\w*|\bparabolic\b/g,
    msg: "Geen uitspraken over waarde of waardestijging. De aankoopprijzen van de prijsladder mag je wel noemen.",
    negatable: true,
  },
  {
    re: /\bdoorverk\w*|\bdoor te verkopen\b|\bherverk\w*|\bresell\w*|\bresale\w*|\bflip\w*|\bsecondary market\b|\bsecundaire markt\b|\bverhandel\w*|\bspecul\w*|\btrad(?:e)?able\b|\btransferable\b|\btrad(?:e|es|ing)\b(?!-)|\bsell (?:it|them|yours|your (?:pass\w*|number|spot))\b|\bfloor ?price\b|\bfloorprijs\b|\bopensea\b|\bmagic ?eden\b/g,
    msg: "Geen taal over doorverkopen, verhandelen of speculeren: passes zijn soulbound.",
    negatable: true,
  },
  {
    re: /\bbeursnotering\w*|\bop de beurs\b|\bexchange listing\b|\blisted on\b|\blisting on\b|\bon (?:an? )?exchanges?\b|\bdex\b|\bcex\b/g,
    msg: "Geen beursnotering of listing: passes zijn niet verhandelbaar.",
    negatable: true,
  },
  {
    re: /\bgegarandeerd\w*|\bgaranderen\b|\bgarandeert\b|\bguarantee[sd]?\b/g,
    msg: "Beloof geen garanties.",
    negatable: true,
  },
  {
    re: /\brisicoloos\b|\bzonder risico(?:'s)?\b|\bgeen risico(?:'s)?\b|\brisk-?free\b|\bno risk\b|\bzero risk\b|\bwithout (?:any )?risks?\b|\bnothing to lose\b|\bcan'?t lose\b|\bsafe bet\b/g,
    msg: "Beloof niet dat iets zonder risico is.",
  },
  {
    re: /\bpassief inkomen\b|\bpassive income\b|\bsnel rijk\b|\brijk worden\b|\bget rich\b|\bfinancial freedom\b|\bgenerational wealth\b|\bearn (?:passive|money|crypto|rewards|yield)\b/g,
    msg: "Geen rijkdomsbeloftes.",
  },
  {
    re: /\b(?:[2-9]|[1-9]\d+) ?x\b(?! per\b)|\b(?:keer|maal) (?:je|jouw|uw) (?:geld|inleg|inzet)\b|\bverdubbel\w* (?:je|jouw|uw) (?:geld|inleg|inzet)\b|\b(?:geld|inleg|inzet) verdubbel\w*|\b(?:double|triple|multiply|\d+x) your (?:money|stake)\b|\b\w+ times your (?:money|stake)\b/g,
    msg: "Geen 'x keer je geld'-taal.",
  },
  {
    re: /\bto the moon\b|\bmoon\w*|\blambo\w*|\bpump\w*|\bhodl\w*|\bwagmi\b|\bngmi\b|\bape[ds]? in\b|\baping\b|\bdegen\w*|\bbullish\b|\blfg\b|\b(?:diamond|paper) hands\b|\bhidden gems?\b|\bnext big thing\b/g,
    msg: "Geen crypto-hypetaal.",
  },
  {
    re: /\bnu of nooit\b|\bnow or never\b|\blaatste kans\b|\blast chance\b|\bmis (?:dit|het|je kans) niet\b|\bdon'?t miss\b|\bfomo\b|\bhaast je\b|\bhurry\b|\bop is op\b|\bwees er (?:snel|vlug) bij\b|\bvoor het te laat is\b|\bbefore it'?s too late\b|\bbeperkte tijd\b|\bnog maar \d+ (?:\w+ )?over\b|\bbijna uitverkocht\b|\bwacht niet\b|\blimited time\b|\bact (?:now|fast|quickly)\b|\b(?:selling|going) fast\b|\bselling out\b|\bwhile (?:supplies|stocks?|they) last\b|\bonly \d+ (?:\w+ )?left\b|\balmost (?:gone|sold out)\b|\brunning out\b|\bdon'?t wait\b|\bdon'?t sleep on\b|\bends? soon\b/g,
    msg: "Zet geen tijdsdruk.",
  },
  {
    re: /\bpre[- ]?sale\w*|\bico\b|\bido\b|\bieo\b|\btge\b|\btoken ?sale\b|\btoken-?verkoop\b|\btoken launch\b|\bfair launch\b|\bfree mint\b|\bairdrop\w*|\bwhite-?list\w*|\ballow-?list\w*|\bwl\b|\blaunchpad\w*|\b(?:private|public|seed) (?:sale|round)\b/g,
    msg: 'Geen crypto-verkooptermen. In het Nederlands is het een "voorverkoop" van een abonnement; in het Engels zeg je "early access" of "founding members", niet "presale".',
  },
  {
    re: /\b\d+(?:[.,]\d+)? ?% ?(?:rendement|returns?|winst|opbrengst|rente|per jaar|per maand|per year|per month|a year|a month|annually|yearly|monthly|apy|apr|interest|yield|profit|gains?)\b/g,
    msg: "Geen rendementspercentages.",
  },
];

// Koopoproepen, in beide talen. Enkel toegestaan in categorie "verkoop", en pas als de verkoop live is.
// De demo uitleggen ("mint a test pass on devnet") is geen koopoproep.
const BUY_CTA = [
  // Nederlands
  /\b(?:koop|bestel|claim|reserveer|mint|bemachtig) (?:hem |ze |er een )?(?:nu|vandaag|meteen|direct|snel)\b/,
  /\bnu (?:kopen|aankopen|bestellen|claimen|reserveren|minten|bemachtigen)\b/,
  /\b(?:claim|bestel|reserveer|bemachtig|mint) (?:je|jouw|uw|een)\b/,
  /\bkoop (?:je|jouw|uw|een|de) \w*\s*(?:genesis|pass\w*|agency|supporter\w*|nummer|abonnement)\b/,
  /\bword (?:nu |vandaag |meteen )?supporter\b/,
  /\bsteun (?:ons )?(?:nu|vandaag|meteen)\b/,
  /\b(?:verkoop|voorverkoop|sale|mint) (?:is |staat )?(?:nu |vanaf nu )?(?:open|geopend|live|gestart|begonnen)\b/,
  /\b(?:verkoop|voorverkoop) (?:opent|start|begint) (?:nu|vandaag)\b/,
  // Engels
  /\b(?:buy|mint|claim|order|grab|get|secure) (?:now|today|yours|your (?:pass|spot|number))\b/,
  /\b(?:buy|mint|claim|order|grab|secure|reserve|pre-?order|lock in|pick up) (?:it |one |yours |your \w+ )?(?:now|today|right now)\b/,
  /\b(?:buy|mint|claim|order|grab|secure|reserve|pre-?order|lock in|pick up) (?:yours|your (?:pass\w*|spot|number|seat|badge|genesis|price))\b/,
  /(?:^|[.!?:\n]\s*)(?:buy|mint|claim|order|grab|get|secure|reserve|pre-?order|lock in|pick up) (?:your|a|an|one|the) (?!test|demo|devnet)(?:\w+ )?(?:genesis|pass\w*|agency|supporter\w*|number|subscription|badge|spot|price)\b/,
  /\bbecome a (?:genesis )?(?:supporter|founding member|founder|member|holder)\b/,
  /\b(?:support|back|join) us (?:now|today)\b/,
  /\bjoin (?:now|today)\b/,
  /\bget in (?:early|now|first)\b/,
  /\b(?:sales?|mint|minting|early access) (?:is |are )?(?:now |officially )?(?:open|live)\b/,
  /\b(?:sales?|mint|minting|early access) (?:opens|starts|begins|goes live) (?:now|today)\b/,
  /\bon sale (?:now|today)\b|\bnow on sale\b/,
];

// Een ontkenning vlak voor het woord, met hooguit een lidwoord ertussen. "non-" mag er direct aan vast.
const NEGATION =
  /(?:\bnon[- ]?|\b(?:geen|niet|nooit|niets|zonder|noch|no|not|never|nothing|without|nor|zero|isn't|aren't|wasn't|won't|can't|cannot|don't|doesn't)\s+(?:(?:een|de|het|enkele?|enige|echte|a|an|any|the|real)\s+)?)$/;

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
 * @param {{ id?: string, categorie: string, tekst: string, lang?: string }} post
 *   tekst = definitieve tekst (placeholders ingevuld); lang = "en" of "nl" (standaard: config.defaultLang)
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

  const lang = postLang(post, config);
  if (!LANGS.includes(lang)) {
    add("fout", "taal", `Onbekende taal "${lang}". Kies uit: ${LANGS.join(", ")} (veld lang, of defaultLang in config.json).`);
  }
  const textLang = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const { required, notice, gift } = offerTexts(config, textLang);
  const isGift = post.categorie === "steun";

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
    add("fout", "disclaimer-ontbreekt", `Vermeld letterlijk "${required}" (taal van de post: ${textLang}).`);
  }

  if (post.categorie === "verkoop" && !live) {
    const missing = ["verkoopActief", "legalReviewDone"].filter((k) => offer[k] !== true).map((k) => `offer.${k}`);
    add("fout", "verkoop-gesloten", `Categorie "verkoop" kan pas als de verkoop live is: zet ${missing.join(" en ")} op true in config.json.`);
  }

  const ctas = new Set();
  for (const re of BUY_CTA) {
    const m = re.exec(text);
    if (!m) continue;
    const phrase = m[0].replace(/^[.!?:\s]+/, "");
    if (ctas.has(phrase)) continue;
    ctas.add(phrase);
    if (!live) add("fout", "koopoproep", `"${phrase}": geen koopoproep zolang de verkoop niet live is.`);
    else if (post.categorie !== "verkoop") add("fout", "koopoproep", `"${phrase}": koopoproepen horen in categorie "verkoop".`);
  }

  if (isGift) {
    if (!includesPhrase(text, gift)) add("fout", "gift-ontbreekt", `Vermeld letterlijk "${gift}" (taal van de post: ${textLang}).`);
    const site = String(config.links?.site ?? "").replace(/\/+$/, "").toLowerCase();
    if (site && !text.includes(`${normalize(site).toLowerCase()}/steun`) && !/\blink in (?:bio|profile)\b|\blink in (?:mijn|ons) profiel\b/.test(text)) {
      add("fout", "steun-link", "Een steunpost linkt naar de steunpagina ({steun}) of verwijst naar de link in het profiel.");
    }
  }
  if (!live) {
    if (needsNotices && !isGift && !includesPhrase(text, notice)) {
      add("fout", "vermelding-ontbreekt", `Vermeld letterlijk "${notice}" (taal van de post: ${textLang}).`);
    }
  } else {
    // Ook een vergeten vermelding in de andere taal klopt niet meer.
    const stale = LANGS.map((l) => offerTexts(config, l).notice).find((n) => includesPhrase(text, n));
    if (needsNotices && stale) {
      add("waarschuwing", "vermelding-verouderd", `"${stale}" klopt niet meer: de verkoop is live.`);
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
