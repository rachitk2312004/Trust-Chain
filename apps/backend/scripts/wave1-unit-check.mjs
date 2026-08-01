import assert from "node:assert/strict";
import { generateOpaqueToken, hashToken } from "../dist/lib/crypto.js";
import { AppError } from "../dist/lib/errors.js";
import { parseBody } from "../dist/lib/validate.js";
import { registerBodySchema } from "../dist/modules/auth/auth.schemas.js";
import {
  assertAllowedMimeType,
  assertAllowedSize,
  assertObjectKeyPrefix,
  sha256Hex,
} from "../dist/modules/documents/documentFile.js";
import { maxPermission, permissionAtLeast } from "../dist/modules/documents/documents.access.js";
import { confirmVersionBodySchema } from "../dist/modules/documents/documents.schemas.js";
import { DocumentMaxUploadBytes, DocumentPermissions } from "@trustchain/config";

function testCrypto() {
  const token = generateOpaqueToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length > 20);
  const a = hashToken(token);
  const b = hashToken(token);
  assert.equal(a, b);
  assert.notEqual(a, hashToken("other"));
}

function testValidation() {
  const ok = parseBody(registerBodySchema, {
    email: "user@example.com",
    password: "password123",
    firstName: "Ada",
  });
  assert.equal(ok.email, "user@example.com");

  assert.throws(
    () => parseBody(registerBodySchema, { email: "bad", password: "short" }),
    (error) => error instanceof AppError && error.code === "VALIDATION_ERROR",
  );
}

function testDocumentFile() {
  assert.equal(sha256Hex("abc"), sha256Hex(Buffer.from("abc")));
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  assertAllowedMimeType("application/pdf");
  assert.throws(
    () => assertAllowedMimeType("application/x-msdownload"),
    (error) => error instanceof AppError && error.code === "DOC_INVALID_MIME",
  );

  assertAllowedSize(1024);
  assert.throws(
    () => assertAllowedSize(0),
    (error) => error instanceof AppError && error.code === "DOC_TOO_LARGE",
  );
  assert.throws(
    () => assertAllowedSize(DocumentMaxUploadBytes + 1),
    (error) => error instanceof AppError && error.code === "DOC_TOO_LARGE",
  );

  const orgId = "11111111-1111-1111-1111-111111111111";
  assertObjectKeyPrefix(`orgs/${orgId}/documents/doc/file.pdf`, orgId);
  assert.throws(
    () => assertObjectKeyPrefix(`orgs/other/documents/x`, orgId),
    (error) => error instanceof AppError && error.code === "DOC_FORBIDDEN",
  );
}

function testAccessRanks() {
  assert.equal(permissionAtLeast(DocumentPermissions.manage, DocumentPermissions.view), true);
  assert.equal(permissionAtLeast(DocumentPermissions.view, DocumentPermissions.download), false);
  assert.equal(permissionAtLeast(null, DocumentPermissions.view), false);
  assert.equal(
    maxPermission(DocumentPermissions.view, DocumentPermissions.edit),
    DocumentPermissions.edit,
  );
  assert.equal(maxPermission(null, DocumentPermissions.download), DocumentPermissions.download);
}

function testConfirmSchema() {
  const ok = parseBody(confirmVersionBodySchema, {
    uploadSessionId: "11111111-1111-1111-1111-111111111111",
    contentHash: "a".repeat(64),
    mimeType: "application/pdf",
    sizeBytes: 12,
    originalFileName: "a.pdf",
  });
  assert.equal(ok.sizeBytes, 12);

  assert.throws(
    () =>
      parseBody(confirmVersionBodySchema, {
        uploadSessionId: "11111111-1111-1111-1111-111111111111",
        contentHash: "short",
        mimeType: "application/pdf",
        sizeBytes: 12,
        originalFileName: "a.pdf",
      }),
    (error) => error instanceof AppError && error.code === "VALIDATION_ERROR",
  );
}

testCrypto();
testValidation();
testDocumentFile();
testAccessRanks();
testConfirmSchema();
console.log("Wave 1 + Wave 2 unit checks passed");
