import {
  BlockchainAllowedNetworks,
  BlockchainChainIds,
  BlockchainNetworkKeys,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type SupportedChainNetwork = (typeof BlockchainAllowedNetworks)[number];

export function assertSupportedNetwork(network: string): SupportedChainNetwork {
  if (!(BlockchainAllowedNetworks as readonly string[]).includes(network)) {
    throw new AppError(
      400,
      "CHAIN_NETWORK_MISMATCH",
      `Unsupported network '${network}'. Wave 3 allows hardhat and sepolia only.`,
      { allowed: BlockchainAllowedNetworks },
    );
  }
  return network as SupportedChainNetwork;
}

export function resolveConfiguredNetwork(): SupportedChainNetwork {
  const raw = (process.env.CHAIN_NETWORK ?? BlockchainNetworkKeys.hardhat).toLowerCase();
  // Map localhost → hardhat for local nodes
  const normalized = raw === "localhost" ? BlockchainNetworkKeys.hardhat : raw;
  return assertSupportedNetwork(normalized);
}

export function isChainEnabled(): boolean {
  const value = (process.env.CHAIN_ENABLED ?? "true").toLowerCase();
  return value !== "false" && value !== "0";
}

export function assertChainEnabled(): void {
  if (!isChainEnabled()) {
    throw new AppError(503, "CHAIN_NOT_CONFIGURED", "Blockchain writes are disabled");
  }
}

export function getConfirmationsRequired(): number {
  const n = Number(process.env.CHAIN_CONFIRMATIONS ?? "1");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

export function getDocumentRegistryAddress(): string {
  const address = process.env.CHAIN_DOCUMENT_REGISTRY_ADDRESS;
  if (!address) {
    throw new AppError(503, "CHAIN_NOT_CONFIGURED", "CHAIN_DOCUMENT_REGISTRY_ADDRESS is required");
  }
  return address;
}

export function expectedChainId(network: SupportedChainNetwork): number {
  return BlockchainChainIds[network];
}

export function explorerTxUrl(network: SupportedChainNetwork, txHash: string): string | null {
  if (network === BlockchainNetworkKeys.sepolia) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  return null;
}
