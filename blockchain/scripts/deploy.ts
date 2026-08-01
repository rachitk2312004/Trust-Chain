import { ethers } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Deploy DocumentRegistry and write address + ABI for backend consumption.
 * Supported networks: hardhat / localhost / sepolia only.
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== 31337 && chainId !== 11155111) {
    throw new Error(
      `Unsupported chainId ${chainId}. Wave 3 allows Hardhat (31337) and Sepolia (11155111) only.`,
    );
  }

  const factory = await ethers.getContractFactory("DocumentRegistry");
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "DocumentRegistry.sol",
    "DocumentRegistry.json",
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
    abi: unknown[];
  };

  const outDir = path.join(__dirname, "..", "abis");
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    contractName: "DocumentRegistry",
    address,
    chainId,
    network: chainId === 31337 ? "hardhat" : chainId === 11155111 ? "sepolia" : "unknown",
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  fs.writeFileSync(
    path.join(outDir, "DocumentRegistry.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );

  fs.writeFileSync(
    path.join(outDir, "DocumentRegistry.address.json"),
    `${JSON.stringify({ address, chainId, network: payload.network }, null, 2)}\n`,
  );

  console.log(`DocumentRegistry deployed at ${address} (chainId=${chainId})`);
  console.log(`ABI written to blockchain/abis/DocumentRegistry.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
