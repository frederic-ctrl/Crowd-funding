// Leest alle aankopen uit de geschiedenis van de escrow-rekening op de blockchain.
import { PublicKey } from "@solana/web3.js";

function delta(tx, mint, predicate) {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  let owner = "";
  let total = 0;
  for (const p of post) {
    if (p.mint !== mint || !p.owner || !predicate(p.owner)) continue;
    const before = pre.find((b) => b.accountIndex === p.accountIndex);
    const d = Number(p.uiTokenAmount.amount) - Number(before?.uiTokenAmount.amount ?? 0);
    if (d !== 0) {
      owner = p.owner;
      total += d;
    }
  }
  return { owner, total };
}

/** Eén aankoop uit een geparste transactie, of null als het geen aankoop is. */
export function parsePurchase(tx, deployment, signature, time = null) {
  if (!tx || tx.meta?.err) return null;
  const shares = delta(tx, deployment.tokenMint, (o) => o !== deployment.authority && o !== deployment.reserveOwner);
  const paid = delta(tx, deployment.paymentMint, (o) => o === deployment.authority);
  if (!shares.owner || shares.total <= 0 || paid.total <= 0) return null;
  return { signature, time, buyer: shares.owner, tokens: shares.total, paidMicro: paid.total };
}

/** Alle aankopen ooit (bladert door de volledige geschiedenis van de escrow). */
export async function allPurchases(connection, deployment) {
  const escrow = new PublicKey(deployment.escrow);
  const purchases = [];
  let before;
  for (;;) {
    const sigs = await connection.getSignaturesForAddress(escrow, { limit: 500, before }, "confirmed");
    if (sigs.length === 0) break;
    for (let i = 0; i < sigs.length; i += 50) {
      const batch = sigs.slice(i, i + 50);
      const txs = await connection.getParsedTransactions(batch.map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      txs.forEach((tx, j) => {
        const p = parsePurchase(tx, deployment, batch[j].signature, batch[j].blockTime ?? null);
        if (p) purchases.push(p);
      });
    }
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < 500) break;
  }
  return purchases.reverse();
}

/** Per koper: totaal betaald en totaal aantal aandelen. */
export function totalsPerBuyer(purchases) {
  const map = new Map();
  for (const p of purchases) {
    const t = map.get(p.buyer) ?? { buyer: p.buyer, tokens: 0, paidMicro: 0, purchases: 0 };
    t.tokens += p.tokens;
    t.paidMicro += p.paidMicro;
    t.purchases += 1;
    map.set(p.buyer, t);
  }
  return [...map.values()];
}
