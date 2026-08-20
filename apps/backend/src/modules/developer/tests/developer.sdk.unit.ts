import assert from "node:assert/strict";
import {
  buildPublicOpenApiDocument,
  listOpenApiOperationIds,
} from "../developer.openapi.js";
import {
  buildSdkManifest,
  expectedPublicOperationIds,
  renderOpenApiJson,
  renderOpenApiYaml,
  toYaml,
} from "../developer.codegen.js";

export function testOpenApiDocument(): void {
  const doc = buildPublicOpenApiDocument({ version: "0.1.0" });
  assert.equal(doc.openapi, "3.0.3");
  assert.ok(doc.paths["/health"]);
  assert.ok(doc.paths["/documents"]);
  assert.ok(doc.paths["/certificates"]);
  assert.ok(doc.paths["/signatures"]);
  assert.ok(doc.paths["/usage"]);
  assert.ok(doc.components.securitySchemes);

  const ids = listOpenApiOperationIds(doc);
  for (const expected of expectedPublicOperationIds()) {
    assert.ok(ids.includes(expected), `missing operationId ${expected}`);
  }
}

export function testOpenApiCodegen(): void {
  const doc = buildPublicOpenApiDocument();
  const json = renderOpenApiJson(doc);
  assert.ok(json.includes('"openapi": "3.0.3"'));
  JSON.parse(json);

  const yaml = renderOpenApiYaml(doc);
  assert.ok(yaml.includes("openapi:"));
  assert.ok(yaml.includes("paths:"));
  assert.ok(toYaml({ a: 1, b: ["x"] }).includes("a: 1"));

  const manifest = buildSdkManifest(doc);
  assert.equal(manifest.packages.typescript, "@trustchain/sdk");
  assert.equal(manifest.packages.python, "trustchain-sdk");
  assert.ok(manifest.operationIds.includes("getHealth"));
}
