// Alle configuratie op één plek: Genesis, de bedrijfsgegevens en de adressen op Solana.
import genesisJson from "../../shared/genesis.json";
import companyJson from "../../shared/bedrijf.json";
import metricsJson from "../../shared/cijfers.json";

export type Tier = { tot: number; prijsEur: number };

export type Product = {
  id: "pass" | "agency";
  naam: string;
  tokenNaam: string;
  symbool: string;
  beschrijving: string;
  max: number;
  maxPerWallet: number;
  websites: number;
  prijsladder: Tier[];
  voordelen: string[];
};

export type Genesis = {
  project: string;
  naam: string;
  verkoopActief: boolean;
  opent: string | null;
  sluit: string | null;
  doelEur: number;
  bedenktijdDagen: number;
  metadataBasis: string;
  producten: Product[];
  steun: { id: "steun"; naam: string; tokenNaam: string; symbool: string; beschrijving: string; minimumEur: number; maximumEur: number; voordelen: string[] };
  betaalmunt: { symbool: string; naam: string; decimalen: number };
};

export type Deployment = {
  network: string;
  rpc: string;
  authority: string;
  founderWallet: string;
  paymentMint: string;
  paymentProgram: string;
  kas: string;
  founderPaymentAccount: string;
  supporterMint: string;
  passProgram: string;
  signatures?: Record<string, string>;
};

export const genesis = genesisJson as Genesis;
export const company = companyJson as Record<string, string | null>;
export const metrics = metricsJson as { bijgewerkt: string; wekelijkseGebruikers: number; betalendeKlanten: number; mrrEur: number };

export const PASS = genesis.producten.find((p) => p.id === "pass")!;
export const AGENCY = genesis.producten.find((p) => p.id === "agency")!;
export const SYMBOL = genesis.betaalmunt.symbool;

const deployments = import.meta.glob<Deployment>("../../shared/deployments/*.json", { eager: true, import: "default" });

export const network: string = import.meta.env.VITE_SOLANA_NETWORK ?? "devnet";
export const deployment: Deployment | null = deployments[`../../shared/deployments/${network}.json`] ?? null;
export const rpcUrl: string = import.meta.env.VITE_SOLANA_RPC_URL ?? deployment?.rpc ?? "https://api.devnet.solana.com";
export const isTestnet = network !== "mainnet-beta";
export const FOUNDER_WALLET = deployment?.founderWallet ?? "JPmYxhBGqt9GMe6kfozUce3EyQRAoQZD1hbLGWJR8T6";
