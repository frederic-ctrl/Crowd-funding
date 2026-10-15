import { network, rpcUrl } from "../config";

function clusterQuery(): string {
  if (network === "mainnet-beta") return "";
  if (network === "localnet") return `?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;
  return `?cluster=${network}`;
}

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}${clusterQuery()}`;
}

export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${clusterQuery()}`;
}
