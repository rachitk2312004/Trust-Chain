import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BlockchainAllowedNetworks,
  BlockchainChainIds,
  BlockchainNetworkKeys,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function readDeployedRegistryAddress(): string | null {
  const candidates = [
    process.env.CHAIN_DOCUMENT_REGISTRY_ADDRESS_FILE,
    join(process.cwd(), "blockchain/abis/DocumentRegistry.address.json"),
    join(process.cwd(), "../../blockchain/abis/DocumentRegistry.address.json"),
    join(__dirname, "../../../../../blockchain/abis/DocumentRegistry.address.json"),
  ].filter((value): value is string => Boolean(value));

  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue;
      const parsed = JSON.parse(readFileSync(file, "utf8")) as { address?: string };
      if (parsed.address && /^0x[0-9a-fA-F]{40}$/.test(parsed.address)) {
        return parsed.address;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function getDocumentRegistryAddress(): string {
  const fromEnv = process.env.CHAIN_DOCUMENT_REGISTRY_ADDRESS?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = readDeployedRegistryAddress();
  if (fromFile) return fromFile;
  throw new AppError(503, "CHAIN_NOT_CONFIGURED", "CHAIN_DOCUMENT_REGISTRY_ADDRESS is required");
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
