// Teksthulpen: normaliseren, lengte zoals X ze telt, links herkennen en een hash voor goedkeuringen.
import { createHash } from "node:crypto";

// X telt elke link als 23 tekens, ongeacht de echte lengte.
export const URL_WEIGHT = 23;
export const MAX_WEIGHTED_LENGTH = 280;

// Links met protocol, of domeinen die X automatisch klikbaar maakt.
const URL_RE =
  /\bhttps?:\/\/[^\s]+|\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:be|com|net|org|io|eu|nl|fr|de|app|dev|co|ai)(?:\/[^\s]*)?/gi;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

export function normalize(text) {
  return String(text)
    .normalize("NFC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// Zelfde gewichten als twitter-text v3: deze bereiken tellen als 1, de rest (emoji, €, CJK) als 2.
function charWeight(codePoint) {
  if (codePoint <= 4351) return 1;
  if (codePoint >= 8192 && codePoint <= 8205) return 1;
  if (codePoint >= 8208 && codePoint <= 8223) return 1;
  if (codePoint >= 8242 && codePoint <= 8247) return 1;
  return 2;
}

function plainLength(text) {
  let n = 0;
  for (const ch of text) n += charWeight(ch.codePointAt(0));
  return n;
}

export function extractLinks(text) {
  const links = [];
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(TRAILING_PUNCT, "");
    links.push({ raw, index: m.index, length: raw.length });
  }
  return links;
}

export function weightedLength(text) {
  const t = normalize(text);
  let total = 0;
  let last = 0;
  for (const link of extractLinks(t)) {
    total += plainLength(t.slice(last, link.index)) + URL_WEIGHT;
    last = link.index + link.length;
  }
  return total + plainLength(t.slice(last));
}

export function hasLink(text) {
  return extractLinks(normalize(text)).length > 0;
}

export function linkHost(raw) {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function approvalHash(text) {
  return createHash("sha256").update(normalize(text), "utf8").digest("hex").slice(0, 16);
}
