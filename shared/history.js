// Leest de volledige geschiedenis van Genesis uit de blockchain: elke aankoop, steun,
// terugbetaling en opname loopt via de kas en draagt een vaste memo. Enkel transacties die
// de serversleutel ondertekende tellen mee, zodat niemand valse aankopen kan toevoegen.
// Gedeeld door de server en de website (de site kan alles zelf in de browser nalezen).
import { PublicKey } from "@solana/web3.js";
import { parseMemo } from "./genesis.js";

const MEMO_PROGRAMS = new Set(["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"]);

function memoOf(tx) {
  for (const ix of tx.transaction.message.instructions) {
    const programId = typeof ix.programId === "string" ? ix.programId : ix.programId.toBase58();
    if (MEMO_PROGRAMS.has(programId) && "parsed" in ix && typeof ix.parsed === "string") return ix.parsed;
  }
  return null;
}

/** Saldowijziging per token-account: { mint, owner, delta } (ook voor accounts die in de transactie gesloten werden). */
function balanceChanges(tx) {
  const rows = new Map();
  const add = (b, sign) => {
    const row = rows.get(b.accountIndex) ?? { mint: b.mint, owner: b.owner ?? "", delta: 0 };
    row.delta += sign * Number(b.uiTokenAmount.amount);
    if (b.owner) row.owner = b.owner;
    rows.set(b.accountIndex, row);
  };
  for (const b of tx.meta?.preTokenBalances ?? []) add(b, -1);
  for (const b of tx.meta?.postTokenBalances ?? []) add(b, 1);
  return [...rows.values()].filter((r) => r.delta !== 0);
}

/**
 * Eén gebeurtenis uit een geparste transactie, of null als het geen geldige Genesis-transactie is.
 * @returns {{ kind: "aankoop"|"steun"|"terugbetaling"|"opname", productId: string|null, number: number|null, name: string,
 *   wallet: string, mint: string|null, amountMicro: number, signature: string, time: number|null, slot: number } | null}
 */
export function parseGenesisTx(tx, deployment, cfg, signature, time = null) {
  if (!tx || tx.meta?.err) return null;
  const payer = tx.transaction.message.accountKeys[0];
  const payerKey = typeof payer.pubkey === "string" ? payer.pubkey : payer.pubkey.toBase58();
  if (payerKey !== deployment.authority || !payer.signer) return null;
  const memo = parseMemo(cfg, memoOf(tx));
  if (!memo) return null;

  const changes = balanceChanges(tx);
  const kas = changes.filter((c) => c.mint === deployment.paymentMint && c.owner === deployment.authority).reduce((s, c) => s + c.delta, 0);
  const base = { kind: memo.kind, productId: memo.productId, number: memo.number, name: memo.name, signature, time, slot: tx.slot ?? 0 };

  if (memo.kind === "aankoop") {
    const pass = changes.find((c) => c.mint !== deployment.paymentMint && c.mint !== deployment.supporterMint && c.delta === 1);
    if (!pass || kas <= 0) return null;
    return { ...base, wallet: pass.owner, mint: pass.mint, amountMicro: kas };
  }
  if (memo.kind === "steun") {
    const payerAccount = changes.find((c) => c.mint === deployment.paymentMint && c.owner !== deployment.authority && c.delta < 0);
    if (!payerAccount || kas <= 0) return null;
    return { ...base, wallet: payerAccount.owner, mint: null, amountMicro: kas };
  }
  if (memo.kind === "terugbetaling") {
    const burned = changes.find((c) => c.mint !== deployment.paymentMint && c.delta === -1);
    const receiver = changes.find((c) => c.mint === deployment.paymentMint && c.owner !== deployment.authority && c.delta > 0);
    if (!burned || !receiver || kas >= 0) return null;
    return { ...base, wallet: receiver.owner, mint: burned.mint, amountMicro: -kas };
  }
  // opname: van de kas naar de oprichterswallet
  const founder = changes.find((c) => c.mint === deployment.paymentMint && c.owner === deployment.founderWallet && c.delta > 0);
  if (!founder || kas >= 0) return null;
  return { ...base, wallet: founder.owner, mint: null, amountMicro: -kas };
}

/** Totalen, de stand per product en de Genesis-muur, uit een lijst gebeurtenissen (oudste eerst). */
export function summarize(cfg, events) {
  const refunded = new Set(events.filter((e) => e.kind === "terugbetaling").map((e) => `${e.productId}:${e.number}`));
  const producten = {};
  for (const p of cfg.producten) {
    const bought = events.filter((e) => e.kind === "aankoop" && e.productId === p.id);
    const used = bought.reduce((m, e) => Math.max(m, e.number ?? 0), 0);
    producten[p.id] = {
      verkocht: bought.length,
      teruggegeven: bought.filter((e) => refunded.has(`${p.id}:${e.number}`)).length,
      hoogsteNummer: used,
    };
  }
  const sum = (kind) => events.filter((e) => e.kind === kind).reduce((s, e) => s + e.amountMicro, 0);
  const steun = events.filter((e) => e.kind === "steun");
  const binnenMicro = sum("aankoop") + sum("steun");
  const terugMicro = sum("terugbetaling");
  const opgenomenMicro = sum("opname");
  const muur = events
    .filter((e) => e.kind === "aankoop" || e.kind === "steun")
    .map((e) => ({ ...e, teruggegeven: e.kind === "aankoop" && refunded.has(`${e.productId}:${e.number}`) }))
    .reverse();
  return {
    producten,
    steun: { aantal: steun.length, totaalMicro: sum("steun"), wallets: new Set(steun.map((e) => e.wallet)).size },
    opgehaaldMicro: binnenMicro - terugMicro,
    terugbetaaldMicro: terugMicro,
    opgenomenMicro,
    verwachteKasMicro: binnenMicro - terugMicro - opgenomenMicro,
    muur,
  };
}

/**
 * Alle Genesis-gebeurtenissen, oudste eerst. Bladert door de volledige geschiedenis van de kas.
 * `cache` (een Map van handtekening naar gebeurtenis) maakt herhaalde oproepen goedkoop: transacties veranderen nooit.
 */
export async function fetchEvents(connection, deployment, cfg, { cache = new Map(), batch = 50 } = {}) {
  const kas = new PublicKey(deployment.kas);
  const sigs = [];
  let before;
  for (;;) {
    const page = await connection.getSignaturesForAddress(kas, { limit: 1000, before }, "confirmed");
    sigs.push(...page);
    const reachedCache = page.some((s) => cache.has(s.signature));
    if (page.length < 1000 || reachedCache) break;
    before = page[page.length - 1].signature;
  }
  const todo = sigs.filter((s) => !s.err && !cache.has(s.signature));
  for (let i = 0; i < todo.length; i += batch) {
    const slice = todo.slice(i, i + batch);
    const txs = await connection.getParsedTransactions(slice.map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    txs.forEach((tx, j) => {
      if (!tx) return; // nog niet beschikbaar: volgende keer opnieuw
      cache.set(slice[j].signature, parseGenesisTx(tx, deployment, cfg, slice[j].signature, slice[j].blockTime ?? tx.blockTime ?? null));
    });
  }
  return [...cache.values()].filter(Boolean).sort((a, b) => a.slot - b.slot);
}
