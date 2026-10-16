// GET /api/genesis
// De stand van Genesis, gelezen uit de blockchain: verkochte passen per product, steun, wat er
// opgehaald en teruggestort is, het saldo van de kas en de Genesis-muur. Elke regel heeft de
// handtekening van de transactie, zodat iedereen het zelf kan nakijken.
import { PublicKey } from "@solana/web3.js";
import { unpackAccount } from "@solana/spl-token";
import { json } from "../server/solana.js";
import { fetchEvents, summarize } from "../shared/history.js";
import { setup } from "./_common.js";

const caches = new Map();
let last = { key: "", at: 0, body: null };

export async function handle(request, env = process.env, deps = {}) {
  if (request.method !== "GET") return json(405, { fout: "Gebruik GET." });
  const ctx = setup(env, deps, { needsAuthority: false });
  if (ctx.response) return ctx.response;
  const { deployment, cfg, connection } = ctx;

  const key = `${deployment.network}:${deployment.kas}`;
  if (!deps.fresh && last.key === key && Date.now() - last.at < 5_000) return json(200, last.body, "public, max-age=5");
  try {
    if (!caches.has(key)) caches.set(key, new Map());
    const events = await fetchEvents(connection, deployment, cfg, { cache: caches.get(key) });
    const kas = new PublicKey(deployment.kas);
    const info = await connection.getAccountInfo(kas, "confirmed");
    const kasMicro = info ? Number(unpackAccount(kas, info, new PublicKey(deployment.paymentProgram)).amount) : 0;
    const body = {
      netwerk: deployment.network,
      kasMicro,
      ...summarize(cfg, events),
      gebeurtenissen: events.slice(-100).reverse(),
      bijgewerkt: new Date().toISOString(),
    };
    last = { key, at: Date.now(), body };
    return json(200, body, "public, max-age=5");
  } catch (err) {
    console.error("stand ophalen mislukt", err);
    return json(502, { fout: "De blockchain is even niet bereikbaar. Probeer zo meteen opnieuw." });
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
