// POST /api/terugbetaling  { wallet, product, nummer, lang? }
// Geld terug binnen de bedenktijd: de koper verbrandt de pass en krijgt in dezelfde transactie
// het volledige bedrag terug uit de kas.
import { buildRefund } from "../server/genesis.js";
import { json } from "../server/solana.js";
import { readPost, setup, fail } from "./_common.js";

export async function handle(request, env = process.env, deps = {}) {
  const { body, wallet, lang, response } = await readPost(request);
  if (response) return response;
  const ctx = setup(env, deps, { lang });
  if (ctx.response) return ctx.response;
  try {
    return json(200, await buildRefund({ ...ctx, productId: String(body?.product ?? ""), number: Number(body?.nummer), buyer: wallet, lang }));
  } catch (err) {
    return fail(err, "refund", lang);
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
