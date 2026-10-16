// TIJDELIJK: toont welke module bij het opstarten faalt op Vercel. Wordt weer verwijderd.
import { readdirSync } from "node:fs";

async function probe(out, name, load) {
  try {
    await load();
    out[name] = "ok";
  } catch (e) {
    out[name] = String(e?.stack ?? e).split("\n").slice(0, 3).join(" | ");
  }
}

export default {
  async fetch() {
    const out = { node: process.version };
    try {
      out.task = readdirSync("/var/task");
      out.modules = readdirSync("/var/task/node_modules").slice(0, 60);
    } catch (e) {
      out.task = String(e);
    }
    await probe(out, "web3", () => import("@solana/web3.js"));
    await probe(out, "spl-token", () => import("@solana/spl-token"));
    await probe(out, "metadata", () => import("@solana/spl-token-metadata"));
    await probe(out, "bs58", () => import("bs58"));
    await probe(out, "server/solana", () => import("../server/solana.js"));
    await probe(out, "server/genesis", () => import("../server/genesis.js"));
    await probe(out, "api/genesis", () => import("./genesis.js"));
    return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  },
};
