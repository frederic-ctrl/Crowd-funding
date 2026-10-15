// Rekenregels van de aanbieding. Gedeeld door de website, de server en de scripts,
// zodat iedereen exact hetzelfde rekent. Bedragen in euro staan in basiseenheden
// van 6 decimalen (1 euro = 1.000.000), zoals tEUR, EURC en USDC op Solana.

export const EUR = 1_000_000;

/** Tekst of getal ("1", "2,50", "1.000") naar basiseenheden, afgerond op hele centen. NaN als het geen bedrag is. */
export function parseEuro(input) {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) * 10_000 : NaN;
  let s = String(input ?? "").replace(/[\s€]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return NaN;
  return Math.round(Number(s) * 100) * 10_000;
}

export function findRound(offering, roundId) {
  return offering.rondes.find((r) => r.id === roundId) ?? null;
}

/** Hoeveel hele tokens je krijgt voor een bedrag, en wat je daar exact voor betaalt. */
export function quote(round, eurMicro) {
  const tokens = Math.floor(eurMicro / round.prijsPerTokenMicro);
  const cost = tokens * round.prijsPerTokenMicro;
  return { tokens, cost, rest: eurMicro - cost };
}

export function percentOfCompany(tokens, totalSupply) {
  return (tokens / totalSupply) * 100;
}

/** Waardering van het hele bedrijf bij een prijs per token (in basiseenheden). */
export function valuationMicro(priceMicro, totalSupply) {
  return priceMicro * totalSupply;
}

export function roundIsOpen(round, now = new Date()) {
  if (round.status !== "open") return false;
  if (round.opent && now < new Date(round.opent)) return false;
  if (round.sluit && now > new Date(round.sluit)) return false;
  return true;
}

/**
 * Controleert een aankoop. Geeft een lijst met fouten in gewone taal terug (leeg = in orde).
 * @param {{ round: object, eurMicro: number, heldTokens: number, vaultRemaining: number, balanceMicro?: number, now?: Date }} p
 */
export function checkPurchase({ round, eurMicro, heldTokens, vaultRemaining, balanceMicro, now = new Date() }) {
  const errors = [];
  if (!roundIsOpen(round, now)) {
    errors.push(`${round.naam} is niet open voor inschrijvingen.`);
    return errors;
  }
  if (!Number.isFinite(eurMicro) || eurMicro <= 0) {
    errors.push("Vul een bedrag in.");
    return errors;
  }
  const { tokens, cost } = quote(round, eurMicro);
  if (cost < round.minimumEur * EUR || tokens === 0) {
    errors.push(`Het minimum is €${round.minimumEur}.`);
  }
  if (round.maxPerPersoonEur) {
    const alreadyMicro = heldTokens * round.prijsPerTokenMicro;
    const maxMicro = round.maxPerPersoonEur * EUR;
    if (alreadyMicro + cost > maxMicro) {
      const left = Math.max(0, maxMicro - alreadyMicro) / EUR;
      errors.push(`Het maximum is €${round.maxPerPersoonEur.toLocaleString("nl-BE")} per persoon. Je kan nog €${left.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} inleggen.`);
    }
  }
  if (tokens > vaultRemaining) {
    errors.push(`Er zijn nog maar ${vaultRemaining.toLocaleString("nl-BE")} aandelen beschikbaar in ${round.naam}.`);
  }
  if (balanceMicro !== undefined && cost > balanceMicro) {
    errors.push("Je hebt niet genoeg saldo voor deze aankoop.");
  }
  return errors;
}
