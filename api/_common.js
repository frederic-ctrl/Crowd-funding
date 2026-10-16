// Gedeeld door de API-functies: aanvraag lezen, deployment en sleutel laden, fouten vertalen.
// De site stuurt de taal mee ("lang": "en" of "nl"); zonder taal antwoorden we in het Nederlands.
import { PurchaseError } from "../server/genesis.js";
import { loadDeployment, loadGenesis, connectionFor, loadAuthority, json, walletFrom } from "../server/solana.js";
import { msg, langOf } from "../shared/messages.js";

export function urlLang(request) {
  try {
    return langOf(new URL(request.url).searchParams.get("lang"));
  } catch {
    return "nl";
  }
}

/** Leest een POST-aanvraag met een walletadres. Geeft { body, wallet, lang } of { response } bij een fout. */
export async function readPost(request) {
  let lang = urlLang(request);
  if (request.method !== "POST") return { response: json(405, { fout: msg(lang).usePost() }) };
  let body;
  try {
    body = await request.json();
  } catch {
    return { response: json(400, { fout: msg(lang).badRequest() }) };
  }
  if (body?.lang) lang = langOf(body.lang);
  const wallet = walletFrom(body?.wallet);
  if (!wallet) return { response: json(400, { fout: msg(lang).badWallet() }) };
  return { body, wallet, lang };
}

/** Deployment, Genesis-config, verbinding en serversleutel. Geeft { response } als Genesis niet actief is. */
export function setup(env, deps, { needsAuthority = true, lang = "nl" } = {}) {
  const deployment = deps.deployment ?? loadDeployment(env.SOLANA_NETWORK || "devnet");
  if (!deployment) return { response: json(503, { fout: msg(lang).notActive() }) };
  let authority = null;
  if (needsAuthority) {
    try {
      authority = deps.authority ?? loadAuthority(env);
    } catch {
      return { response: json(503, { fout: msg(lang).notActive() }) };
    }
  }
  return {
    deployment,
    authority,
    cfg: deps.cfg ?? loadGenesis(),
    connection: deps.connection ?? connectionFor(deployment, env.SOLANA_RPC_URL),
  };
}

export function fail(err, what, lang = "nl") {
  if (err instanceof PurchaseError) return json(400, { fout: err.message, fouten: err.messages });
  console.error(`${what} mislukt`, err);
  return json(500, { fout: msg(lang).failed(what) });
}
