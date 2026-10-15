// POST /api/koop  { wallet, bedrag, ronde }
// Bereidt een aankoop voor: geeft een transactie terug die de server al ondertekende als
// betaler van de kosten en beheerder van de verkoopkluis. De investeerder ondertekent in de eigen wallet.
import { PublicKey } from "@solana/web3.js";
import { buildPurchase, PurchaseError } from "../server/purchase.js";
import { loadDeployment, loadOffering, connectionFor, loadAuthority, json } from "../server/solana.js";
import { parseEuro } from "../shared/offering.js";

export async function handle(request, env = process.env, deps = {}) {
  if (request.method !== "POST") return json(405, { fout: "Gebruik POST." });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { fout: "Ongeldige aanvraag." });
  }

  let buyer;
  try {
    buyer = new PublicKey(String(body?.wallet ?? ""));
    if (!PublicKey.isOnCurve(buyer.toBytes())) throw new Error("niet ondertekenbaar");
  } catch {
    return json(400, { fout: "Ongeldig walletadres." });
  }

  const deployment = deps.deployment ?? loadDeployment(env.SOLANA_NETWORK || "devnet");
  if (!deployment) return json(503, { fout: "De verkoop is nog niet geactiveerd." });

  let authority;
  try {
    authority = deps.authority ?? loadAuthority(env);
  } catch {
    return json(503, { fout: "De verkoop is nog niet geactiveerd." });
  }

  try {
    const result = await buildPurchase({
      connection: deps.connection ?? connectionFor(deployment, env.SOLANA_RPC_URL),
      deployment,
      offering: deps.offering ?? loadOffering(),
      roundId: String(body?.ronde || "ronde-1"),
      buyer,
      eurMicro: parseEuro(body?.bedrag),
      authority,
    });
    return json(200, result);
  } catch (err) {
    if (err instanceof PurchaseError) return json(400, { fout: err.message, fouten: err.messages });
    console.error("koop mislukt", err);
    return json(500, { fout: "Er ging iets mis bij het voorbereiden van je aankoop. Probeer opnieuw." });
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
