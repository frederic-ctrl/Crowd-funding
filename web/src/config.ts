// Alle configuratie op één plek: de aanbieding, de bedrijfsgegevens en de adressen op Solana.
import offeringJson from "../../shared/aanbod.json";
import companyJson from "../../shared/bedrijf.json";
import metricsJson from "../../shared/cijfers.json";

export type Round = {
  id: string;
  naam: string;
  label: string;
  tokens: number;
  prijsPerTokenMicro: number;
  minimumEur: number;
  maxPerPersoonEur: number | null;
  minimumdoelEur: number | null;
  status: "open" | "gepland" | "gesloten" | "afgerond";
  opent: string | null;
  sluit: string | null;
};

export type Offering = {
  project: string;
  token: { naam: string; symbool: string; decimalen: number; totaal: number; metadataUri: string };
  allocaties: Record<string, number>;
  rondes: Round[];
  betaalmunt: { symbool: string; naam: string; decimalen: number };
};

export type Deployment = {
  network: string;
  rpc: string;
  authority: string;
  founderWallet: string;
  reserveOwner: string;
  recoveryKey?: string;
  tokenMint: string;
  tokenProgram: string;
  paymentMint: string;
  paymentProgram: string;
  escrow: string;
  founderTokenAccount: string;
  vaults: Record<string, string>;
  signatures?: Record<string, string>;
};

export const offering = offeringJson as Offering;
export const company = companyJson as Record<string, string | null>;
export const metrics = metricsJson as { bijgewerkt: string; wekelijkseGebruikers: number; betalendeKlanten: number; mrrEur: number };

const deployments = import.meta.glob<Deployment>("../../shared/deployments/*.json", { eager: true, import: "default" });

export const network: string = import.meta.env.VITE_SOLANA_NETWORK ?? "devnet";
export const deployment: Deployment | null = deployments[`../../shared/deployments/${network}.json`] ?? null;
export const rpcUrl: string = import.meta.env.VITE_SOLANA_RPC_URL ?? deployment?.rpc ?? "https://api.devnet.solana.com";
export const isTestnet = network !== "mainnet-beta";
export const FOUNDER_WALLET = deployment?.founderWallet ?? "JPmYxhBGqt9GMe6kfozUce3EyQRAoQZD1hbLGWJR8T6";

export const activeRound: Round = offering.rondes.find((r) => r.status === "open") ?? offering.rondes[0];

/** Prijs van de meest recente ronde die al gestart is: de referentie voor "wat is mijn deel waard". */
export function referencePriceMicro(): { price: number; round: Round } {
  const started = offering.rondes.filter((r) => r.status === "open" || r.status === "afgerond" || r.status === "gesloten");
  const round = started[started.length - 1] ?? offering.rondes[0];
  return { price: round.prijsPerTokenMicro, round };
}
