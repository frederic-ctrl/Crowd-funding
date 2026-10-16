// GET /api/genesis
// De stand van Genesis, gelezen uit de blockchain: verkochte passen per product, steun, wat er
// opgehaald en teruggestort is, het saldo van elke kas (EURC en USDC) en de Genesis-muur. Elke
// regel heeft de handtekening van de transactie, zodat iedereen het zelf kan nakijken. Met de
// koers euro-dollar van vandaag, zodat de site de prijs in USDC kan tonen.
import { PublicKey } from "@solana/web3.js";
import { unpackAccount } from "@solana/spl-token";
import { json } from "../server/solana.js";
import { eurUsd as fetchRate } from "../server/koers.js";
import { fetchEvents, summarize } from "../shared/history.js";
import { coinsOf } from "../shared/munten.js";
import { setup, urlLang } from "./_common.js";
import { msg } from "../shared/messages.js";

const caches = new Map();
let last = { key: "", at: 0, body: null };

export async function handle(request, env = process.env, deps = {}) {
  const lang = urlLang(request);
  if (request.method !== "GET") return json(405, { fout: msg(lang).useGet() });
  const ctx = setup(env, deps, { needsAuthority: false, lang });
  if (ctx.response) return ctx.response;
  const { deployment, cfg, connection } = ctx;

  const coins = coinsOf(deployment, cfg);
  const key = `${deployment.network}:${coins.map((c) => c.kas).join(",")}`;
  if (!deps.fresh && last.key === key && Date.now() - last.at < 5_000) return json(200, last.body, "public, max-age=5");
  try {
    if (!caches.has(key)) caches.set(key, new Map());
    const [events, infos, koers] = await Promise.all([
      fetchEvents(connection, deployment, cfg, { cache: caches.get(key) }),
      connection.getMultipleAccountsInfo(coins.map((c) => new PublicKey(c.kas)), "confirmed"),
      (deps.rate ?? fetchRate)({ env }).catch(() => null),
    ]);
    const kassen = Object.fromEntries(
      coins.map((c, i) => [c.id, infos[i] ? Number(unpackAccount(new PublicKey(c.kas), infos[i], new PublicKey(c.program)).amount) : 0]),
    );
    const body = {
      netwerk: deployment.network,
      kassen,
      koers: koers ? { eurUsd: koers.eurUsd, datum: koers.datum } : null,
      ...summarize(cfg, events),
      gebeurtenissen: events.slice(-100).reverse(),
      bijgewerkt: new Date().toISOString(),
    };
    last = { key, at: Date.now(), body };
    return json(200, body, "public, max-age=5");
  } catch (err) {
    console.error("stand ophalen mislukt", err);
    return json(502, { fout: msg(lang).chainDown() });
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
