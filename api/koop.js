// POST /api/koop  { wallet, product: "pass" | "agency" | "steun", munt?: "eurc" | "usdc", bedrag?, naam?, lang? }
// Bereidt een aankoop voor: geeft een transactie terug die de server al ondertekende als betaler
// van de kosten. De koper ondertekent daarna in de eigen wallet en ziet daar het exacte bedrag.
// Wie in USDC betaalt, betaalt de europrijs omgerekend aan de ECB-koers van de dag.
import { buildPassPurchase, buildSupport } from "../server/genesis.js";
import { json } from "../server/solana.js";
import { eurUsd as fetchRate } from "../server/koers.js";
import { parseEuro } from "../shared/genesis.js";
import { coinById } from "../shared/munten.js";
import { msg } from "../shared/messages.js";
import { readPost, setup, fail } from "./_common.js";

export async function handle(request, env = process.env, deps = {}) {
  const { body, wallet, lang, response } = await readPost(request);
  if (response) return response;
  const ctx = setup(env, deps, { lang });
  if (ctx.response) return ctx.response;

  const product = String(body?.product || "pass");
  const munt = String(body?.munt || "eurc");
  let eurUsd = null;
  if (coinById(ctx.deployment, ctx.cfg, munt)?.valuta === "USD") {
    try {
      ({ eurUsd } = await (deps.rate ?? fetchRate)({ env }));
    } catch (err) {
      console.error("koers ophalen mislukt", err);
      return json(503, { fout: msg(lang).rateDown() });
    }
  }
  try {
    const result =
      product === "steun"
        ? await buildSupport({ ...ctx, buyer: wallet, eurMicro: parseEuro(body?.bedrag), name: body?.naam, munt, eurUsd, lang })
        : await buildPassPurchase({ ...ctx, productId: product, buyer: wallet, name: body?.naam, munt, eurUsd, lang });
    return json(200, eurUsd ? { ...result, eurUsd } : result);
  } catch (err) {
    return fail(err, "prepare", lang);
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
