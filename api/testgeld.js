// POST /api/testgeld  { wallet, lang? }
// Enkel voor de demo op devnet: stuurt 1.000 test-euro (tEUR, zonder waarde) naar een wallet.
import { sendTestEuro, FaucetError } from "../server/faucet.js";
import { loadDeployment, loadGenesis, connectionFor, loadAuthority, json } from "../server/solana.js";
import { msg } from "../shared/messages.js";
import { readPost } from "./_common.js";

export async function handle(request, env = process.env, deps = {}) {
  const { wallet: recipient, lang, response } = await readPost(request);
  if (response) return response;
  const m = msg(lang);

  const deployment = deps.deployment ?? loadDeployment(env.SOLANA_NETWORK || "devnet");
  if (!deployment) return json(503, { fout: m.demoNotActive() });
  if (deployment.network === "mainnet-beta") return json(404, { fout: m.faucetMainnet() });

  let authority;
  try {
    authority = deps.authority ?? loadAuthority(env);
  } catch {
    return json(503, { fout: m.demoNotActive() });
  }

  try {
    const result = await sendTestEuro({
      connection: deps.connection ?? connectionFor(deployment, env.SOLANA_RPC_URL),
      deployment,
      cfg: deps.cfg ?? loadGenesis(),
      authority,
      recipient,
      lang,
    });
    return json(200, result);
  } catch (err) {
    if (err instanceof FaucetError) return json(400, { fout: err.message });
    console.error("testgeld mislukt", err);
    return json(500, { fout: m.faucetFailed() });
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
