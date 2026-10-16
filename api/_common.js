// Gedeeld door de API-functies: aanvraag lezen, deployment en sleutel laden, fouten vertalen.
import { PurchaseError } from "../server/genesis.js";
import { loadDeployment, loadGenesis, connectionFor, loadAuthority, json, walletFrom } from "../server/solana.js";

/** Leest een POST-aanvraag met een walletadres. Geeft { body, wallet } of { response } bij een fout. */
export async function readPost(request) {
  if (request.method !== "POST") return { response: json(405, { fout: "Gebruik POST." }) };
  let body;
  try {
    body = await request.json();
  } catch {
    return { response: json(400, { fout: "Ongeldige aanvraag." }) };
  }
  const wallet = walletFrom(body?.wallet);
  if (!wallet) return { response: json(400, { fout: "Ongeldig walletadres." }) };
  return { body, wallet };
}

/** Deployment, Genesis-config, verbinding en serversleutel. Geeft { response } als de verkoop niet geactiveerd is. */
export function setup(env, deps, { needsAuthority = true } = {}) {
  const deployment = deps.deployment ?? loadDeployment(env.SOLANA_NETWORK || "devnet");
  if (!deployment) return { response: json(503, { fout: "Genesis is nog niet geactiveerd op dit netwerk." }) };
  let authority = null;
  if (needsAuthority) {
    try {
      authority = deps.authority ?? loadAuthority(env);
    } catch {
      return { response: json(503, { fout: "Genesis is nog niet geactiveerd op dit netwerk." }) };
    }
  }
  return {
    deployment,
    authority,
    cfg: deps.cfg ?? loadGenesis(),
    connection: deps.connection ?? connectionFor(deployment, env.SOLANA_RPC_URL),
  };
}

export function fail(err, what) {
  if (err instanceof PurchaseError) return json(400, { fout: err.message, fouten: err.messages });
  console.error(`${what} mislukt`, err);
  return json(500, { fout: `Er ging iets mis bij ${what}. Probeer opnieuw.` });
}
