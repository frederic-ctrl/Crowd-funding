// Betaalmunten van Genesis: EURC (euro) en USDC (dollar). Op het testnet heten ze tEUR en tUSD.
// Prijzen staan altijd in euro. Wie in USDC betaalt, betaalt het bedrag in dollar volgens de
// ECB-referentiekoers van die dag, naar boven afgerond op een cent. Elke munt heeft een eigen kas;
// geld terug gebeurt altijd in dezelfde munt en voor hetzelfde bedrag als de aankoop.
// Gedeeld door de website, de server en de scripts.

export const MUNT_IDS = ["eurc", "usdc"];

/**
 * De betaalmunten van een deployment, met de gegevens uit genesis.json.
 * @returns {{ id: string, symbool: string, naam: string, valuta: "EUR" | "USD", decimalen: number,
 *   mint: string, program: string, kas: string, founderAccount: string }[]}
 */
export function coinsOf(deployment, cfg) {
  const main = deployment?.network === "mainnet-beta";
  return (cfg.betaalmunten ?? [])
    .filter((c) => deployment?.munten?.[c.id])
    .map((c) => ({
      id: c.id,
      symbool: main ? c.symbool : c.testSymbool,
      naam: main ? c.naam : c.testNaam,
      valuta: c.valuta,
      decimalen: c.decimalen,
      ...deployment.munten[c.id],
    }));
}

export function coinById(deployment, cfg, id) {
  return coinsOf(deployment, cfg).find((c) => c.id === id) ?? null;
}

/** Alle adressen van de kassen (één per munt). */
export function kasAddresses(deployment, cfg) {
  return coinsOf(deployment, cfg).map((c) => c.kas);
}

/**
 * Een bedrag in euro (basiseenheden, 6 decimalen) omgezet naar de munt. EURC: hetzelfde bedrag.
 * USDC: euro maal de koers (dollar per euro), naar boven afgerond op een hele cent. Null zonder geldige koers.
 */
export function toCoinMicro(eurMicro, coin, eurUsd) {
  if (coin.valuta === "EUR") return eurMicro;
  if (!(eurUsd > 0)) return null;
  const cents = Math.ceil(Math.round(eurMicro * eurUsd) / 10_000 - 1e-9);
  return cents * 10_000;
}

/** Een bedrag in de munt terug naar euro, afgerond op een cent (enkel voor opnames in USDC). */
export function toEurMicro(coinMicro, coin, eurUsd) {
  if (coin.valuta === "EUR") return coinMicro;
  if (!(eurUsd > 0)) return null;
  return Math.round(coinMicro / eurUsd / 10_000) * 10_000;
}

/** "107.25 USDC" of "99.00 EURC": bedrag in de munt, met punt als decimaalteken zoals in wallets. */
export function formatCoin(micro, coin) {
  return `${(micro / 10 ** coin.decimalen).toFixed(2)} ${coin.symbool}`;
}
