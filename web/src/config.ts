// Alle configuratie op één plek: Genesis, de bedrijfsgegevens en de adressen op Solana.
import genesisJson from "../../shared/genesis.json";
import companyJson from "../../shared/bedrijf.json";
import metricsJson from "../../shared/cijfers.json";
import { coinsOf } from "../../shared/munten.js";

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
  betaalmunten: { id: CoinId; symbool: string; naam: string; testSymbool: string; testNaam: string; valuta: "EUR" | "USD"; decimalen: number }[];
};

export type CoinId = "eurc" | "usdc";

/** Een betaalmunt met haar adressen op dit netwerk: EURC en USDC (op het testnet tEUR en tUSD). */
export type Coin = {
  id: CoinId;
  symbool: string;
  naam: string;
  valuta: "EUR" | "USD";
  decimalen: number;
  mint: string;
  program: string;
  kas: string;
  founderAccount: string;
};

export type Deployment = {
  network: string;
  rpc: string;
  authority: string;
  founderWallet: string;
  munten: Partial<Record<CoinId, { mint: string; program: string; kas: string; founderAccount: string }>>;
  supporterMint: string;
  passProgram: string;
  signatures?: Record<string, string>;
};

export const genesis = genesisJson as Genesis;
export const company = companyJson as Record<string, string | null>;
export const metrics = metricsJson as { bijgewerkt: string; wekelijkseGebruikers: number; betalendeKlanten: number; mrrEur: number };

export const PASS = genesis.producten.find((p) => p.id === "pass")!;
export const AGENCY = genesis.producten.find((p) => p.id === "agency")!;

const deployments = import.meta.glob<Deployment>("../../shared/deployments/*.json", { eager: true, import: "default" });

export const network: string = import.meta.env.VITE_SOLANA_NETWORK ?? "devnet";
export const deployment: Deployment | null = deployments[`../../shared/deployments/${network}.json`] ?? null;
export const rpcUrl: string = import.meta.env.VITE_SOLANA_RPC_URL ?? deployment?.rpc ?? "https://api.devnet.solana.com";
export const isTestnet = network !== "mainnet-beta";
export const FOUNDER_WALLET = deployment?.founderWallet ?? "JPmYxhBGqt9GMe6kfozUce3EyQRAoQZD1hbLGWJR8T6";
export const COINS = coinsOf(deployment, genesis) as Coin[];
export function coinOf(id: string | null | undefined): Coin | null {
  return COINS.find((c) => c.id === id) ?? null;
}
