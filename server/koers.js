// De koers euro-dollar voor betalingen in USDC: de ECB-referentiekoers van de dag (via Frankfurter),
// 15 minuten in het geheugen. EUR_USD_KOERS zet een vaste koers (voor tests en lokaal werken).
const URL_ECB = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD";
const TTL_MS = 15 * 60_000;

let cached = null;

export class RateError extends Error {}

/** Dollar per euro, bv. 1.1208, met de datum van de ECB-koers. Gooit RateError als er geen geldige koers is. */
export async function eurUsd({ env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  if (env.EUR_USD_KOERS) return { eurUsd: check(Number(env.EUR_USD_KOERS)), datum: null, bron: "vast" };
  if (cached && now - cached.at < TTL_MS) return cached.value;
  let body;
  try {
    const res = await fetchImpl(URL_ECB, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    body = await res.json();
  } catch (err) {
    if (cached && now - cached.at < 24 * 3600_000) return cached.value; // liever een koers van vandaag dan geen
    throw new RateError(`Geen koers euro-dollar: ${err.message}`);
  }
  const value = { eurUsd: check(Number(body?.rates?.USD)), datum: body?.date ?? null, bron: "ECB" };
  cached = { at: now, value };
  return value;
}

function check(rate) {
  if (!(rate > 0.5 && rate < 2)) throw new RateError(`Ongeldige koers euro-dollar: ${rate}`);
  return rate;
}

/** Enkel voor tests: vergeet de bewaarde koers. */
export function resetRateCache() {
  cached = null;
}
