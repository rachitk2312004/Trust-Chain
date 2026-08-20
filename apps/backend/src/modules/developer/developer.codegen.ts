/**
 * Phase F Step 4 — OpenAPI codegen helpers.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPublicOpenApiDocument,
  listOpenApiOperationIds,
  type OpenApiDocument,
} from "./developer.openapi.js";

export type SdkManifest = {
  name: string;
  version: string;
  languages: string[];
  packages: Record<string, string>;
  publicBasePath: string;
  operationIds: string[];
  generatedAt: string;
};

export function buildSdkManifest(doc?: OpenApiDocument): SdkManifest {
  const openapi = doc ?? buildPublicOpenApiDocument();
  return {
    name: "@trustchain/sdk",
    version: String((openapi.info as { version?: string }).version ?? "0.1.0"),
    languages: ["typescript", "javascript", "python"],
    packages: {
      typescript: "@trustchain/sdk",
      javascript: "@trustchain/sdk",
      python: "trustchain-sdk",
    },
    publicBasePath: "/api/public/v1",
    operationIds: listOpenApiOperationIds(openapi),
    generatedAt: new Date().toISOString(),
  };
}

export function renderOpenApiJson(doc?: OpenApiDocument): string {
  return `${JSON.stringify(doc ?? buildPublicOpenApiDocument(), null, 2)}\n`;
}

/** Simple YAML emitter sufficient for OpenAPI documents. */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (value === null) return `${pad}null\n`;
  if (typeof value === "boolean") return `${pad}${value ? "true" : "false"}\n`;
  if (typeof value === "number") {
    return `${pad}${Number.isFinite(value) ? String(value) : "null"}\n`;
  }
  if (typeof value === "string") return `${pad}${yamlScalar(value)}\n`;

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    return value
      .map((item) => {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length === 0) return `${pad}- {}\n`;
          const [firstKey, firstVal] = entries[0]!;
          let out = `${pad}- ${firstKey}:`;
          if (firstVal !== null && typeof firstVal === "object") {
            out += `\n${toYaml(firstVal, indent + 2)}`;
          } else {
            out += ` ${formatInline(firstVal)}\n`;
          }
          for (const [k, v] of entries.slice(1)) {
            if (v !== null && typeof v === "object") {
              out += `${pad}  ${k}:\n${toYaml(v, indent + 2)}`;
            } else {
              out += `${pad}  ${k}: ${formatInline(v)}\n`;
            }
          }
          return out;
        }
        if (Array.isArray(item)) {
          return `${pad}-\n${toYaml(item, indent + 1)}`;
        }
        return `${pad}- ${formatInline(item)}\n`;
      })
      .join("");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{}\n`;
    return entries
      .map(([key, val]) => {
        if (val !== null && typeof val === "object") {
          const nested = toYaml(val, indent + 1);
          if (nested.trim() === "{}" || nested.trim() === "[]") {
            return `${pad}${key}: ${nested.trim()}\n`;
          }
          return `${pad}${key}:\n${nested}`;
        }
        return `${pad}${key}: ${formatInline(val)}\n`;
      })
      .join("");
  }

  return `${pad}${yamlScalar(String(value))}\n`;
}

function formatInline(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return yamlScalar(value);
  return JSON.stringify(value);
}

function yamlScalar(value: string): string {
  if (value === "") return '""';
  if (/^[\w./:@+-]+$/.test(value) && !/^(true|false|null|yes|no)$/i.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

export function renderOpenApiYaml(doc?: OpenApiDocument): string {
  return toYaml(doc ?? buildPublicOpenApiDocument(), 0);
}

export function writeOpenApiArtifacts(
  outputDir: string,
  doc?: OpenApiDocument,
): { jsonPath: string; yamlPath: string; manifestPath: string } {
  const openapi = doc ?? buildPublicOpenApiDocument();
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = join(outputDir, "openapi.json");
  const yamlPath = join(outputDir, "openapi.yaml");
  const manifestPath = join(outputDir, "sdk-manifest.json");
  writeFileSync(jsonPath, renderOpenApiJson(openapi), "utf8");
  writeFileSync(yamlPath, renderOpenApiYaml(openapi), "utf8");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(buildSdkManifest(openapi), null, 2)}\n`,
    "utf8",
  );
  return { jsonPath, yamlPath, manifestPath };
}

/** Operation ids expected by generated clients. */
export function expectedPublicOperationIds(): string[] {
  return [
    "createCertificate",
    "createDocument",
    "createSignature",
    "getCertificate",
    "getDocument",
    "getHealth",
    "getSignature",
    "getUsage",
  ];
}
