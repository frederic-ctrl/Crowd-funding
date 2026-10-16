// TIJDELIJK: toont welke module bij het opstarten faalt op Vercel. Wordt weer verwijderd.
export default {
  async fetch() {
    const out = { node: process.version };
    for (const m of ["@solana/web3.js", "@solana/spl-token", "@solana/spl-token-metadata", "bs58", "../server/solana.js", "../shared/genesis.js", "../shared/history.js", "../server/genesis.js", "../server/faucet.js", "./_common.js", "./genesis.js"]) {
      try {
        await import(m);
        out[m] = "ok";
      } catch (e) {
        out[m] = String(e?.stack ?? e).split("\n").slice(0, 4).join(" | ");
      }
    }
    return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  },
};
