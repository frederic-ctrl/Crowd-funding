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
