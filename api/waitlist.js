// Wachtlijst van Marketing Scan Genesis: bewaart een e-mailadres met toestemming in Supabase.
// Draait als Vercel Function (Web-standaard Request/Response). Zonder SUPABASE_URL en
// SUPABASE_SECRET_KEY antwoordt de functie 503, zodat de site toont dat de lijst nog niet actief is.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LANGS = new Set(["nl", "fr", "en", "de"]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function validate(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "invalid_body" };
  // Honeypot: echte bezoekers zien dit veld niet. Bots krijgen een stil "ok".
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: "spam", silent: true };
  }
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "invalid_email" };
  if (input.consent !== true) return { ok: false, error: "consent_required" };
  const lang = LANGS.has(input.lang) ? input.lang : "nl";
  return { ok: true, value: { email, lang } };
}

export function supabaseHeaders(key) {
  const headers = {
    apikey: key,
    "content-type": "application/json",
    prefer: "resolution=ignore-duplicates,return=minimal",
  };
  // Oude service-role-sleutels zijn JWT's en moeten ook als Bearer mee; nieuwe secret keys niet.
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  return headers;
}

export async function handle(request, env = process.env, fetchImpl = fetch) {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  let input;
  try {
    input = await request.json();
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const check = validate(input);
  if (!check.ok) return check.silent ? json(200, { ok: true }) : json(400, { error: check.error });

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(503, { error: "not_configured" });

  const res = await fetchImpl(`${url.replace(/\/+$/, "")}/rest/v1/waitlist?on_conflict=email`, {
    method: "POST",
    headers: supabaseHeaders(key),
    body: JSON.stringify({
      email: check.value.email,
      lang: check.value.lang,
      source: "site",
      consent_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    console.error("waitlist insert failed", res.status);
    return json(502, { error: "storage_failed" });
  }
  return json(201, { ok: true });
}

export default {
  fetch(request) {
    return handle(request);
  },
};
