// Wat de site rechtstreeks van de blockchain leest, zonder tussenkomst van onze server.
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, getNonTransferable, unpackAccount, unpackMint } from "@solana/spl-token";
import type { Deployment, Genesis } from "../config";
import { fetchEvents, summarize } from "../../../shared/history.js";
import type { GenesisEvent, GenesisState } from "./api";

/** Saldo van de betaalmunt (tEUR of EURC) in de wallet. */
export async function fetchPaymentBalance(connection: Connection, dep: Deployment, owner: PublicKey): Promise<number> {
  const program = new PublicKey(dep.paymentProgram);
  const account = getAssociatedTokenAddressSync(new PublicKey(dep.paymentMint), owner, false, program);
  const info = await connection.getAccountInfo(account, "confirmed");
  return info ? Number(unpackAccount(account, info, program).amount) : 0;
}

/** Staat deze pass (nog) in de wallet? Rechtstreeks van de keten. */
export async function holdsPass(connection: Connection, owner: PublicKey, mint: string): Promise<boolean> {
  const account = getAssociatedTokenAddressSync(new PublicKey(mint), owner, false, TOKEN_2022_PROGRAM_ID);
  const info = await connection.getAccountInfo(account, "confirmed");
  return info ? unpackAccount(account, info, TOKEN_2022_PROGRAM_ID).amount === 1n : false;
}

/** Leest de volledige geschiedenis van de kas in de browser en rekent alles zelf na. */
export async function verifyInBrowser(connection: Connection, dep: Deployment, cfg: Genesis): Promise<Omit<GenesisState, "netwerk" | "kasMicro" | "gebeurtenissen" | "bijgewerkt">> {
  const events = (await fetchEvents(connection, dep, cfg, { batch: 20 })) as GenesisEvent[];
  return summarize(cfg, events) as unknown as Omit<GenesisState, "netwerk" | "kasMicro" | "gebeurtenissen" | "bijgewerkt">;
}

export function decodeTransaction(base64: string): Transaction {
  return Transaction.from(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/** Wacht tot een transactie bevestigd is, zonder websockets (werkt overal, ook achter strikte netwerken). */
export async function confirmSignature(connection: Connection, signature: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error("De transactie werd geweigerd door het netwerk.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("De bevestiging duurt langer dan verwacht. Kijk zo meteen opnieuw bij Mijn pass.");
}

/** Vertaalt fouten van de wallet en het netwerk naar gewone taal. */
export function explainError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/reject|declin|cancel|denied/i.test(msg)) return "Je hebt het geannuleerd in je wallet. Er is niets gebeurd.";
  if (/already in use/i.test(msg)) return "Iemand anders was je net voor met dit nummer. Probeer opnieuw: je krijgt het volgende vrije nummer.";
  if (/blockhash not found|block height exceeded|expired/i.test(msg)) return "De aanvraag is verlopen. Probeer opnieuw.";
  return msg || "Er ging iets mis. Er is niets afgeschreven.";
}

export type PassCheck = { checked: number; ok: number; problems: string[] };

/**
 * Controleert elke verkochte pass rechtstreeks op de keten: voorraad 1 (of 0 als hij teruggegeven
 * is), geen muntrecht meer, geen bevriesrecht, en niet overdraagbaar.
 */
export async function verifyPasses(connection: Connection, passes: { mint: string; teruggegeven?: boolean; label: string }[]): Promise<PassCheck> {
  const problems: string[] = [];
  let ok = 0;
  for (let i = 0; i < passes.length; i += 100) {
    const slice = passes.slice(i, i + 100);
    const infos = await connection.getMultipleAccountsInfo(slice.map((p) => new PublicKey(p.mint)), "confirmed");
    infos.forEach((info, j) => {
      const p = slice[j];
      if (!info) return problems.push(`${p.label}: munt niet gevonden`);
      const mint = unpackMint(new PublicKey(p.mint), info, TOKEN_2022_PROGRAM_ID);
      const supply = p.teruggegeven ? 0n : 1n;
      if (mint.supply !== supply) return problems.push(`${p.label}: voorraad ${mint.supply}, verwacht ${supply}`);
      if (mint.mintAuthority) return problems.push(`${p.label}: muntrecht niet ingetrokken`);
      if (mint.freezeAuthority) return problems.push(`${p.label}: kan bevroren worden`);
      if (!getNonTransferable(mint)) return problems.push(`${p.label}: is overdraagbaar`);
      ok += 1;
    });
  }
  return { checked: passes.length, ok, problems };
}
