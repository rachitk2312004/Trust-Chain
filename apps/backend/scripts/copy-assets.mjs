import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcAbi = join(root, "src", "modules", "blockchain", "abi");
const destAbi = join(root, "dist", "modules", "blockchain", "abi");
const srcFonts = join(root, "assets", "fonts");
const destFonts = join(root, "dist", "assets", "fonts");

mkdirSync(destAbi, { recursive: true });
cpSync(srcAbi, destAbi, { recursive: true });
console.log("Copied blockchain ABI assets to dist/");

mkdirSync(destFonts, { recursive: true });
cpSync(srcFonts, destFonts, { recursive: true });
console.log("Copied certificate fonts to dist/assets/fonts/");
