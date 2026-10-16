// POST /api/activeer  { wallet, product, nummer, bericht, handtekening }
//   De wallet ondertekent gratis een tekst (geen transactie) en krijgt de activatiecode voor Marketing Scan Pro.
// GET  /api/activeer?code=MSGEN-042-XXXX-XXXX
//   Voor Marketing Scan zelf: is deze code geldig, voor welke pass en hoeveel websites?
import { activate, readActivationCode, passStatus } from "../server/genesis.js";
import { json } from "../server/solana.js";
import { findProduct } from "../shared/genesis.js";
import { readPost, setup, fail, urlLang } from "./_common.js";
import { msg } from "../shared/messages.js";

export async function handle(request, env = process.env, deps = {}) {
  if (request.method === "GET") {
    const lang = urlLang(request);
    const ctx = setup(env, deps, { lang });
    if (ctx.response) return ctx.response;
    const code = new URL(request.url).searchParams.get("code");
    const parsed = readActivationCode(ctx.authority, ctx.cfg, code, env);
    if (!parsed) return json(404, { geldig: false, fout: msg(lang).unknownCode() });
    try {
      const status = await passStatus(ctx.connection, ctx.authority, ctx.cfg, parsed.productId, parsed.number);
      const product = findProduct(ctx.cfg, parsed.productId);
      return json(200, { geldig: status.geldig, product: parsed.productId, nummer: parsed.number, websites: product.websites, wallet: status.wallet, mint: status.mint });
    } catch (err) {
      return fail(err, "code", lang);
    }
  }

  const { body, wallet, lang, response } = await readPost(request);
  if (response) return response;
  const ctx = setup(env, deps, { lang });
  if (ctx.response) return ctx.response;
  let signature;
  try {
    signature = Uint8Array.from(Buffer.from(String(body?.handtekening ?? ""), "base64"));
  } catch {
    return json(400, { fout: msg(lang).badSignature() });
  }
  try {
    const result = await activate({
      ...ctx,
      productId: String(body?.product ?? ""),
      number: Number(body?.nummer),
      wallet: wallet.toBase58(),
      message: String(body?.bericht ?? ""),
      signature,
      env,
      lang,
    });
    return json(200, result);
  } catch (err) {
    return fail(err, "activate", lang);
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
