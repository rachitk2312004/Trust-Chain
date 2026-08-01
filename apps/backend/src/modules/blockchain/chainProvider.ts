import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getBytes,
  hexlify,
  zeroPadValue,
  type InterfaceAbi,
} from "ethers";
import { AppError } from "../../lib/errors.js";
import {
  expectedChainId,
  getDocumentRegistryAddress,
  resolveConfiguredNetwork,
  type SupportedChainNetwork,
} from "./chainConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadAbi(): InterfaceAbi {
  const path = join(__dirname, "abi", "DocumentRegistry.abi.json");
  return JSON.parse(readFileSync(path, "utf8")) as InterfaceAbi;
}

export interface RelayerKeyProvider {
  getPrivateKey(): string;
}

export class EnvRelayerKeyProvider implements RelayerKeyProvider {
  getPrivateKey(): string {
    const key = process.env.CHAIN_PRIVATE_KEY;
    if (!key) {
      throw new AppError(503, "CHAIN_NOT_CONFIGURED", "CHAIN_PRIVATE_KEY is required");
    }
    return key;
  }
}

let providerSingleton: JsonRpcProvider | undefined;
let walletSingleton: Wallet | undefined;
let networkSingleton: SupportedChainNetwork | undefined;

export function resetChainClients(): void {
  providerSingleton = undefined;
  walletSingleton = undefined;
  networkSingleton = undefined;
}

export async function getChainProvider(): Promise<{
  provider: JsonRpcProvider;
  network: SupportedChainNetwork;
  chainId: number;
}> {
  const network = resolveConfiguredNetwork();
  const rpcUrl = process.env.CHAIN_RPC_URL;
  if (!rpcUrl) {
    throw new AppError(503, "CHAIN_NOT_CONFIGURED", "CHAIN_RPC_URL is required");
  }

  if (!providerSingleton || networkSingleton !== network) {
    providerSingleton = new JsonRpcProvider(rpcUrl);
    networkSingleton = network;
    walletSingleton = undefined;
  }

  const detected = await providerSingleton.getNetwork();
  const expected = expectedChainId(network);
  if (Number(detected.chainId) !== expected) {
    throw new AppError(
      503,
      "CHAIN_NETWORK_MISMATCH",
      `RPC chainId ${detected.chainId} does not match configured network ${network} (${expected})`,
    );
  }

  return { provider: providerSingleton, network, chainId: expected };
}

export async function getRelayerWallet(
  keyProvider: RelayerKeyProvider = new EnvRelayerKeyProvider(),
): Promise<Wallet> {
  const { provider, network } = await getChainProvider();
  if (!walletSingleton || networkSingleton !== network) {
    walletSingleton = new Wallet(keyProvider.getPrivateKey(), provider);
    networkSingleton = network;
  }
  return walletSingleton;
}

export async function getDocumentRegistryContract(keyProvider?: RelayerKeyProvider): Promise<{
  contract: Contract;
  wallet: Wallet;
  provider: JsonRpcProvider;
  network: SupportedChainNetwork;
  address: string;
}> {
  const { provider, network } = await getChainProvider();
  const wallet = await getRelayerWallet(keyProvider);
  const address = getDocumentRegistryAddress();
  const contract = new Contract(address, loadAbi(), wallet);
  return { contract, wallet, provider, network, address };
}

/** Encode a UUID string as bytes32 (strip dashes, left-pad to 32 bytes). */
export function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid UUID for bytes32 encoding");
  }
  return zeroPadValue(`0x${hex}`, 32);
}

/** Encode a SHA-256 hex digest as bytes32. */
export function sha256HexToBytes32(hash: string): string {
  const hex = hash.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new AppError(400, "VALIDATION_ERROR", "contentHash must be 32-byte hex");
  }
  return hexlify(getBytes(`0x${hex}`));
}
