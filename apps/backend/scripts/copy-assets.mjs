import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcAbi = join(root, "src", "modules", "blockchain", "abi");
const destAbi = join(root, "dist", "modules", "blockchain", "abi");

mkdirSync(destAbi, { recursive: true });
cpSync(srcAbi, destAbi, { recursive: true });
console.log("Copied blockchain ABI assets to dist/");
