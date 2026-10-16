// POST /api/koop  { wallet, product: "pass" | "agency" | "steun", bedrag?, naam? }
// Bereidt een aankoop voor: geeft een transactie terug die de server al ondertekende als betaler
// van de kosten. De koper ondertekent daarna in de eigen wallet.
import { buildPassPurchase, buildSupport } from "../server/genesis.js";
import { json } from "../server/solana.js";
import { parseEuro } from "../shared/genesis.js";
import { readPost, setup, fail } from "./_common.js";

export async function handle(request, env = process.env, deps = {}) {
  const { body, wallet, response } = await readPost(request);
  if (response) return response;
  const ctx = setup(env, deps);
  if (ctx.response) return ctx.response;

  const product = String(body?.product || "pass");
  try {
    const result =
      product === "steun"
        ? await buildSupport({ ...ctx, buyer: wallet, eurMicro: parseEuro(body?.bedrag), name: body?.naam })
        : await buildPassPurchase({ ...ctx, productId: product, buyer: wallet, name: body?.naam });
    return json(200, result);
  } catch (err) {
    return fail(err, "het voorbereiden van je aankoop");
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
