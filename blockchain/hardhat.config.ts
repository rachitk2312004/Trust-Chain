import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const sepoliaKey = process.env.CHAIN_PRIVATE_KEY;
const sepoliaRpc = process.env.CHAIN_RPC_URL;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Wave 3: Sepolia only besides Hardhat — no other networks.
    sepolia: {
      url: sepoliaRpc ?? "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: sepoliaKey ? [sepoliaKey] : [],
    },
  },
};

export default config;
