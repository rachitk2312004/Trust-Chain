import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Bundled fonts used for SVG→PNG so serverless hosts without system fonts still render text. */
export const CERTIFICATE_FONT_FAMILY = "Noto Serif";

function candidateFontDirs(): string[] {
  return [
    // Dev / tsx: apps/backend/assets/fonts
    join(moduleDir, "../../../../assets/fonts"),
    // Dist: apps/backend/dist/assets/fonts (copied by prebuild)
    join(moduleDir, "../../../assets/fonts"),
    join(process.cwd(), "assets/fonts"),
    join(process.cwd(), "apps/backend/assets/fonts"),
  ];
}

export function resolveCertificateFontFiles(): string[] {
  const files: string[] = [];
  for (const dir of candidateFontDirs()) {
    const regular = join(dir, "NotoSerif-Regular.ttf");
    const bold = join(dir, "NotoSerif-Bold.ttf");
    if (existsSync(regular) && existsSync(bold)) {
      files.push(regular, bold);
      break;
    }
  }
  return files;
}
