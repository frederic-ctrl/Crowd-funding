// Optioneel: haalt het aantal inschrijvingen op de wachtlijst live uit Supabase,
// zodat de wekelijkse transparantiepost altijd het echte aantal toont.

export async function fetchWaitlistCount(env = process.env, fetchImpl = fetch) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const headers = { apikey: key, prefer: "count=exact" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  const res = await fetchImpl(
    `${url.replace(/\/+$/, "")}/rest/v1/waitlist?select=id&unsubscribed_at=is.null&limit=1`,
    { method: "GET", headers },
  );
  if (!res.ok) throw new Error(`Supabase antwoordde ${res.status} bij het tellen van de wachtlijst.`);
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

/** Haalt de stand van Genesis op bij de site (dezelfde cijfers als op /transparantie). */
export async function fetchGenesisState(site, fetchImpl = fetch) {
  const res = await fetchImpl(`${site.replace(/\/+$/, "")}/api/genesis?lang=en`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`De site antwoordde ${res.status} bij het ophalen van de stand van Genesis.`);
  return res.json();
}

/**
 * Zet de stand van Genesis om naar de velden van data/cijfers.json. Enkel echte verkoop (mainnet)
 * telt: op het testnet zijn het demo-aankopen, die tellen niet als passes of supporters.
 */
export function applyGenesisState(data, state, today) {
  const real = state.netwerk === "mainnet-beta";
  const claimed = (id) => {
    const p = state.producten?.[id];
    return real && p ? p.verkocht - p.teruggegeven : 0;
  };
  return {
    ...data,
    bijgewerkt: today,
    passesGeclaimd: claimed("pass"),
    agencyGeclaimd: claimed("agency"),
    supporters: real ? (state.steun?.wallets ?? 0) : 0,
    opgehaaldEur: real ? Math.round((state.opgehaaldMicro ?? 0) / 10_000) / 100 : 0,
  };
}
