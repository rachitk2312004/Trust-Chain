#!/usr/bin/env node
/**
 * Writes docs/api/openapi.json + openapi.yaml from the OpenAPI builder.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeOpenApiArtifacts } from "../dist/modules/developer/developer.codegen.js";
import { buildPublicOpenApiDocument } from "../dist/modules/developer/developer.openapi.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "..", "docs", "api");
const paths = writeOpenApiArtifacts(outDir, buildPublicOpenApiDocument());
console.log(`Wrote ${paths.jsonPath}`);
console.log(`Wrote ${paths.yamlPath}`);
console.log(`Wrote ${paths.manifestPath}`);
