import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { DocumentMaxUploadBytes, DocumentPermissions } from "@trustchain/config";
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
import {
  assertSupportedNetwork,
  resolveConfiguredNetwork,
} from "../dist/modules/blockchain/chainConfig.js";
import { sha256HexToBytes32, uuidToBytes32 } from "../dist/modules/blockchain/chainProvider.js";
import {
  buildIntentDomain,
  hashChainIntent,
  verifyChainIntentSignature,
} from "../dist/modules/blockchain/signatures.js";

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

async function testBlockchainHelpers() {
  process.env.CHAIN_NETWORK = "hardhat";
  assert.equal(resolveConfiguredNetwork(), "hardhat");
  process.env.CHAIN_NETWORK = "localhost";
  assert.equal(resolveConfiguredNetwork(), "hardhat");
  process.env.CHAIN_NETWORK = "sepolia";
  assert.equal(resolveConfiguredNetwork(), "sepolia");
  assert.throws(
    () => assertSupportedNetwork("mainnet"),
    (error) => error instanceof AppError && error.code === "CHAIN_NETWORK_MISMATCH",
  );

  const orgBytes = uuidToBytes32("11111111-1111-1111-1111-111111111111");
  assert.equal(orgBytes.length, 66);
  assert.ok(orgBytes.startsWith("0x"));

  const hash = "a".repeat(64);
  assert.equal(sha256HexToBytes32(hash), `0x${hash}`);

  const wallet = Wallet.createRandom();
  const domain = buildIntentDomain({
    chainId: 31337,
    verifyingContract: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  });
  const message = {
    organizationId: orgBytes,
    documentId: orgBytes,
    versionNumber: 1,
    contentHash: sha256HexToBytes32(hash),
    operation: "anchor",
    intentNonce: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  };
  assert.equal(typeof hashChainIntent(domain, message), "string");

  const signature = await wallet.signTypedData(
    domain,
    {
      ChainIntent: [
        { name: "organizationId", type: "bytes32" },
        { name: "documentId", type: "bytes32" },
        { name: "versionNumber", type: "uint32" },
        { name: "contentHash", type: "bytes32" },
        { name: "operation", type: "string" },
        { name: "intentNonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    message,
  );

  verifyChainIntentSignature({
    domain,
    message,
    signature,
    expectedSigner: wallet.address,
  });
  assert.throws(
    () =>
      verifyChainIntentSignature({
        domain,
        message,
        signature,
        expectedSigner: Wallet.createRandom().address,
      }),
    (error) => error instanceof AppError && error.code === "CHAIN_SIGNATURE_INVALID",
  );
}

async function main() {
  testCrypto();
  testValidation();
  testDocumentFile();
  testAccessRanks();
  testConfirmSchema();
  await testBlockchainHelpers();
  const { testVerificationCodeFormat, testOutcomePrecedence, testReportProofFields } = await import(
    "../dist/modules/verification/tests/verification.unit.js"
  );
  testVerificationCodeFormat();
  testOutcomePrecedence();
  testReportProofFields();
  const { testPublicCodes, testReportSigning, testVisibilityAndLinkState } = await import(
    "../dist/modules/public-verification/tests/publicVerification.unit.js"
  );
  testPublicCodes();
  testReportSigning();
  testVisibilityAndLinkState();
  const { testQrPublicCodes, testQrPayloadVersions, testQrStatusEvaluation } = await import(
    "../dist/modules/qr/tests/qr.unit.js"
  );
  testQrPublicCodes();
  testQrPayloadVersions();
  testQrStatusEvaluation();
  console.log("Wave 1–6 unit checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
