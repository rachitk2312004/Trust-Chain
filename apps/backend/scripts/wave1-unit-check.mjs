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
  const {
    testAiPublicCodes,
    testConfidenceAndCost,
    testForbiddenOperations,
    testStubProcessorsRemoved,
    testJobAndReviewStates,
    testProductionConfigValidation,
    testMemoryClientForbiddenInProduction,
    testLineageAndValidationFields,
  } = await import("../dist/modules/ai/tests/ai.unit.js");
  testAiPublicCodes();
  testConfidenceAndCost();
  testForbiddenOperations();
  testStubProcessorsRemoved();
  testJobAndReviewStates();
  testProductionConfigValidation();
  await testMemoryClientForbiddenInProduction();
  await testLineageAndValidationFields();

  const {
    testRouteValidationSchemas,
    testCompatibilityMapping,
    testPhase2PublicCodePrefixes,
    testMemoryExecutionClientQueueSubmit,
    testHealthAndModelsViaMemoryClient,
    testGatewayDoesNotImportWorkers,
  } = await import("../dist/modules/ai/tests/gateway.unit.js");
  testRouteValidationSchemas();
  testCompatibilityMapping();
  testPhase2PublicCodePrefixes();
  await testMemoryExecutionClientQueueSubmit();
  await testHealthAndModelsViaMemoryClient();
  testGatewayDoesNotImportWorkers();

  const {
    testExpressRouteSurfaceWiring,
    testCompatibilityIdPrefixesRemainValid,
    testSecurityRbacAndForbiddenOps,
    testAiModuleForbidsBlockchainVerificationImports,
    testExecutionClientNetworkFailure,
    testExecutionClientHttpErrorStatus,
    testGatewayHealthModelsViaMemory,
    testMemoryPipelineLoad,
    testProductionConfigHardening,
    testDeadCodeAuditMarkersAbsentFromGateway,
  } = await import("../dist/modules/ai/tests/step7.unit.js");
  testExpressRouteSurfaceWiring();
  testCompatibilityIdPrefixesRemainValid();
  testSecurityRbacAndForbiddenOps();
  testAiModuleForbidsBlockchainVerificationImports();
  await testExecutionClientNetworkFailure();
  await testExecutionClientHttpErrorStatus();
  await testGatewayHealthModelsViaMemory();
  await testMemoryPipelineLoad();
  testProductionConfigHardening();
  testDeadCodeAuditMarkersAbsentFromGateway();

  const { testOpsPublicCodes, testOpsStatesAndScores, testForbiddenOpsOperations } = await import(
    "../dist/modules/ops/tests/ops.unit.js"
  );
  testOpsPublicCodes();
  testOpsStatesAndScores();
  testForbiddenOpsOperations();

  process.env.PUBLIC_VERIFY_SIGNING_SECRET ??= "test-public-verify-signing-secret";
  process.env.JWT_ACCESS_SECRET ??= "test-jwt-access-secret";
  process.env.DATABASE_URL ??= "postgresql://trustchain:trustchain@127.0.0.1:5432/trustchain";
  process.env.DOCUMENT_KEY_V1 ??= "a".repeat(64);
  process.env.DOCUMENT_ACTIVE_KEY_VERSION ??= "1";
  process.env.MALWARE_SCANNER ??= "mock";

  const {
    testStreamingHashHelperShape,
    testEnvelopeKeyWrap,
    testMalwareAdapterInterface,
    testPublicVerifySecretNoFallback,
    testLayeredRateLimitMemoryFallback,
    testEvidenceImmutableGuard,
  } = await import("../dist/modules/documents/tests/phase1.security.unit.js");
  testStreamingHashHelperShape();
  testEnvelopeKeyWrap();
  testMalwareAdapterInterface();
  testPublicVerifySecretNoFallback();
  await testLayeredRateLimitMemoryFallback();
  testEvidenceImmutableGuard();

  const {
    testNotificationPayloadShape,
    testPreferenceFiltering,
    testEventCreationAndOutbox,
    testDuplicateProtection,
    testTransactionRollback,
    testPreferenceSkipsChannels,
  } = await import("../dist/modules/notifications/tests/notification.publish.unit.js");
  testNotificationPayloadShape();
  testPreferenceFiltering();
  await testEventCreationAndOutbox();
  await testDuplicateProtection();
  await testTransactionRollback();
  await testPreferenceSkipsChannels();

  const {
    testTemplateRendering,
    testRetryLogic,
    testDigestGeneration,
    testDeliverySuccess,
    testDeadLetterLogic,
    testRetryThenSucceed,
    testSchedulerExecution,
    testMetrics,
  } = await import("../dist/modules/notifications/tests/notification.delivery.unit.js");
  testTemplateRendering();
  testRetryLogic();
  testDigestGeneration();
  testDeliverySuccess();
  testDeadLetterLogic();
  testRetryThenSucceed();
  await testSchedulerExecution();
  await testMetrics();

  const {
    testStreamConnection,
    testStaleConnectionCleanup,
    testDuplicateEventIds,
    testUnreadUpdatesViaStream,
    testReconnectSupportEnvelope,
    testMultiTabConnections,
  } = await import("../dist/modules/notifications/tests/notification.stream.unit.js");
  testStreamConnection();
  testStaleConnectionCleanup();
  testDuplicateEventIds();
  testUnreadUpdatesViaStream();
  testReconnectSupportEnvelope();
  testMultiTabConnections();

  const {
    testStatisticsGeneration,
    testLatencyCalculations,
    testRetentionCleanupHelpers,
    testDeadLetterRecoveryLogic,
    testAdministrativeAnalyses,
    testAdministrativeMetricsSnapshot,
  } = await import("../dist/modules/notifications/tests/notification.analytics.unit.js");
  testStatisticsGeneration();
  testLatencyCalculations();
  testRetentionCleanupHelpers();
  testDeadLetterRecoveryLogic();
  testAdministrativeAnalyses();
  await testAdministrativeMetricsSnapshot();

  const {
    testCertificateIssuanceIdentity,
    testCertificateVerification,
    testCertificateRevocationSemantics,
    testTemplateHandling,
    testCertificateEventCreationShape,
  } = await import("../dist/modules/certificates/tests/certificates.unit.js");
  testCertificateIssuanceIdentity();
  testCertificateVerification();
  testCertificateRevocationSemantics();
  testTemplateHandling();
  testCertificateEventCreationShape();

  const {
    testPlaceholderReplacement,
    testLayoutRendering,
    testSvgGeneration,
    testPdfGeneration,
    testPngGeneration,
    testQrEmbedding,
  } = await import("../dist/modules/certificates/tests/certificates.render.unit.js");
  testPlaceholderReplacement();
  testLayoutRendering();
  await testSvgGeneration();
  await testPdfGeneration();
  await testPngGeneration();
  await testQrEmbedding();

  const {
    testCsvParsing,
    testJsonParsingAndValidation,
    testBulkIssuancePlanShape,
    testBulkCancellationAndProgress,
  } = await import("../dist/modules/certificates/tests/certificates.bulk.unit.js");
  testCsvParsing();
  testJsonParsingAndValidation();
  testBulkIssuancePlanShape();
  testBulkCancellationAndProgress();

  const {
    testStatisticsGeneration: testCertificateStatisticsGeneration,
    testTemplateMetrics: testCertificateTemplateMetrics,
    testDownloadMetrics: testCertificateDownloadMetrics,
    testCleanupHelpers: testCertificateCleanupHelpers,
    testAdministrativeOperationsShape: testCertificateAdminOperations,
  } = await import("../dist/modules/certificates/tests/certificates.analytics.unit.js");
  testCertificateStatisticsGeneration();
  testCertificateTemplateMetrics();
  testCertificateDownloadMetrics();
  testCertificateCleanupHelpers();
  testCertificateAdminOperations();

  const {
    testSignatureCreation,
    testSignatureVerification,
    testSignatureRevocation,
    testSignatureHistoryShape,
    testAlgorithmSelection,
  } = await import("../dist/modules/signatures/tests/signatures.unit.js");
  testSignatureCreation();
  testSignatureVerification();
  testSignatureRevocation();
  testSignatureHistoryShape();
  testAlgorithmSelection();

  const {
    testDocumentSigningPolicy,
    testCertificateSigningPolicy,
    testDetachedSignatures,
    testExpirationHandling,
    testRevocationHandling,
    testPolicyValidation,
  } = await import("../dist/modules/signatures/tests/signatures.workflow.unit.js");
  testDocumentSigningPolicy();
  testCertificateSigningPolicy();
  testDetachedSignatures();
  testExpirationHandling();
  testRevocationHandling();
  testPolicyValidation();

  const {
    testSequentialWorkflows,
    testParallelWorkflows,
    testThresholdWorkflows,
    testApprovalHandling,
    testRejectionHandling,
    testCancellationHandling,
    testExpirationHandling: testApprovalExpirationHandling,
  } = await import("../dist/modules/signatures/tests/signatures.approval.unit.js");
  testSequentialWorkflows();
  testParallelWorkflows();
  testThresholdWorkflows();
  testApprovalHandling();
  testRejectionHandling();
  testCancellationHandling();
  testApprovalExpirationHandling();

  const {
    testAnalyticsGeneration: testSignatureAnalyticsGeneration,
    testWorkflowMetrics: testSignatureWorkflowMetrics,
    testAlgorithmMetrics: testSignatureAlgorithmMetrics,
    testCleanupHelpers: testSignatureCleanupHelpers,
    testAdministrationOperations: testSignatureAdminOperations,
  } = await import("../dist/modules/signatures/tests/signatures.analytics.unit.js");
  testSignatureAnalyticsGeneration();
  testSignatureWorkflowMetrics();
  testSignatureAlgorithmMetrics();
  testSignatureCleanupHelpers();
  testSignatureAdminOperations();

  const {
    testPermissionAssignment,
    testRoleAssignment,
    testFeatureFlags,
    testConfigurationUpdates,
    testAuditLogging,
  } = await import("../dist/modules/admin/tests/admin.unit.js");
  testPermissionAssignment();
  testRoleAssignment();
  testFeatureFlags();
  testConfigurationUpdates();
  testAuditLogging();

  const {
    testTenantSuspension,
    testTenantRestoration,
    testTenantArchival,
    testTenantTransfer,
    testQuotaEnforcement,
  } = await import("../dist/modules/admin/tests/admin.tenants.unit.js");
  testTenantSuspension();
  testTenantRestoration();
  testTenantArchival();
  testTenantTransfer();
  testQuotaEnforcement();

  const {
    testInspectionLogic,
    testRollbackHandling,
    testConfigurationHistory,
    testAuditFiltering,
    testHealthReporting,
  } = await import("../dist/modules/admin/tests/admin.portal.unit.js");
  testInspectionLogic();
  testRollbackHandling();
  testConfigurationHistory();
  testAuditFiltering();
  testHealthReporting();

  const {
    testPolicyAssignment,
    testPolicyInheritance,
    testPolicyEvaluation,
    testConflictDetection,
    testRetentionRules,
    testQuotaRules,
  } = await import("../dist/modules/admin/tests/admin.policy.unit.js");
  testPolicyAssignment();
  testPolicyInheritance();
  testPolicyEvaluation();
  testConflictDetection();
  testRetentionRules();
  testQuotaRules();

  const {
    testAnalyticsGeneration,
    testQuotaMetrics,
    testAuditMetrics,
    testRetention,
    testAdministrationOperations,
  } = await import("../dist/modules/admin/tests/admin.analytics.unit.js");
  testAnalyticsGeneration();
  testQuotaMetrics();
  testAuditMetrics();
  testRetention();
  testAdministrationOperations();

  const {
    testKeyGeneration,
    testKeyRotation,
    testKeyRevocation,
    testWebhookRegistration,
    testServiceAccounts,
    testRateLimits,
  } = await import("../dist/modules/developer/tests/developer.unit.js");
  testKeyGeneration();
  testKeyRotation();
  testKeyRevocation();
  testWebhookRegistration();
  testServiceAccounts();
  testRateLimits();

  const {
    testWebhookSigning,
    testWebhookRetries,
    testWebhookReplayProtection,
    testWebhookDeadLetters,
    testEventPublicationTypes,
  } = await import("../dist/modules/developer/tests/developer.delivery.unit.js");
  testWebhookSigning();
  testWebhookRetries();
  testWebhookReplayProtection();
  testWebhookDeadLetters();
  testEventPublicationTypes();

  const {
    testPublicApiAuthentication,
    testPublicApiAuthorizationScopes,
    testPublicApiIdempotency,
    testPublicApiRateLimitingHelpers,
  } = await import("../dist/modules/developer/tests/developer.public.unit.js");
  testPublicApiAuthentication();
  testPublicApiAuthorizationScopes();
  testPublicApiIdempotency();
  testPublicApiRateLimitingHelpers();

  const { testOpenApiDocument, testOpenApiCodegen } = await import(
    "../dist/modules/developer/tests/developer.sdk.unit.js"
  );
  testOpenApiDocument();
  testOpenApiCodegen();

  const {
    testQuotaEnforcement: testDeveloperQuotaEnforcement,
    testAnalyticsAggregation: testDeveloperAnalyticsAggregation,
    testAnomalyDetection: testDeveloperAnomalyDetection,
    testAuditQueries: testDeveloperAuditQueries,
    testDashboardCalculations: testDeveloperDashboardCalculations,
  } = await import("../dist/modules/developer/tests/developer.ops.unit.js");
  testDeveloperQuotaEnforcement();
  testDeveloperAnalyticsAggregation();
  testDeveloperAnomalyDetection();
  testDeveloperAuditQueries();
  testDeveloperDashboardCalculations();

  const {
    testIndexing,
    testFiltering,
    testRanking,
    testPagination,
    testSuggestions,
  } = await import("../dist/modules/search/tests/search.unit.js");
  testIndexing();
  testFiltering();
  testRanking();
  testPagination();
  testSuggestions();

  const {
    testEventCreation,
    testCorrelation,
    testTimelineGeneration,
    testFiltering: testPlatformAuditFiltering,
    testExportGeneration,
  } = await import("../dist/modules/audit/tests/audit.unit.js");
  testEventCreation();
  testCorrelation();
  testTimelineGeneration();
  testPlatformAuditFiltering();
  testExportGeneration();

  const {
    testRuleExecution,
    testScoreCalculation,
    testReporting,
    testFrameworkMapping,
    testRemediationTracking,
  } = await import("../dist/modules/compliance/tests/compliance.unit.js");
  testRuleExecution();
  testScoreCalculation();
  testReporting();
  testFrameworkMapping();
  testRemediationTracking();

  const {
    testValidation: testEvidenceValidation,
    testVersioning: testEvidenceVersioning,
    testLinking: testEvidenceLinking,
    testExportGeneration: testEvidenceExportGeneration,
    testChainOfCustodyTracking,
  } = await import("../dist/modules/evidence/tests/evidence.unit.js");
  testEvidenceValidation();
  testEvidenceVersioning();
  testEvidenceLinking();
  testEvidenceExportGeneration();
  testChainOfCustodyTracking();

  const {
    testPolicyEvaluation: testRetentionPolicyEvaluation,
    testHoldEnforcement: testRetentionHoldEnforcement,
    testArchivalLogic: testRetentionArchivalLogic,
    testPurgeLogic: testRetentionPurgeLogic,
    testChainVerification: testRetentionChainVerification,
  } = await import("../dist/modules/retention/tests/retention.unit.js");
  testRetentionPolicyEvaluation();
  testRetentionHoldEnforcement();
  testRetentionArchivalLogic();
  testRetentionPurgeLogic();
  testRetentionChainVerification();

  const {
    testSamlConfiguration,
    testScimProvisioning,
    testRoleInheritance,
    testAbacEvaluation,
    testAccessReviews,
  } = await import("../dist/modules/enterprise/tests/enterprise.unit.js");
  testSamlConfiguration();
  testScimProvisioning();
  testRoleInheritance();
  testAbacEvaluation();
  testAccessReviews();

  const {
    testHierarchyConstruction,
    testInheritanceResolution,
    testApprovalWorkflows,
    testOwnershipValidation,
    testOrganizationalReporting,
  } = await import("../dist/modules/organization/tests/organization.unit.js");
  testHierarchyConstruction();
  testInheritanceResolution();
  testApprovalWorkflows();
  testOwnershipValidation();
  testOrganizationalReporting();

  const {
    testRegionSelection,
    testResidencyEnforcement,
    testFailoverHandling,
    testReplicationPolicies,
    testRoutingDecisions,
  } = await import("../dist/modules/region/tests/region.unit.js");
  testRegionSelection();
  testResidencyEnforcement();
  testFailoverHandling();
  testReplicationPolicies();
  testRoutingDecisions();

  const {
    testBackupCreation,
    testRestoreValidation,
    testFailbackProcedures,
    testRpoCalculations,
    testRtoCalculations,
  } = await import("../dist/modules/recovery/tests/recovery.unit.js");
  testBackupCreation();
  testRestoreValidation();
  testFailbackProcedures();
  testRpoCalculations();
  testRtoCalculations();

  const {
    testRiskScoring,
    testControlEvaluation,
    testAssessmentWorkflows,
    testOwnershipValidation: testGovernanceOwnershipValidation,
    testReporting: testGovernanceReporting,
  } = await import("../dist/modules/governance/tests/governance.unit.js");
  testRiskScoring();
  testControlEvaluation();
  testAssessmentWorkflows();
  testGovernanceOwnershipValidation();
  testGovernanceReporting();

  const {
    testWalletLinking,
    testChallengeGeneration,
    testOwnershipVerification,
    testSynchronization,
    testConflictResolution,
  } = await import("../dist/modules/walletsync/tests/walletsync.unit.js");
  testWalletLinking();
  testChallengeGeneration();
  testOwnershipVerification();
  testSynchronization();
  testConflictResolution();

  const {
    testConnectorRegistration,
    testOAuthHandling,
    testSynchronizationJobs,
    testEventSubscriptions,
    testCredentialRotation,
  } = await import("../dist/modules/integration/tests/integration.unit.js");
  testConnectorRegistration();
  testOAuthHandling();
  testSynchronizationJobs();
  testEventSubscriptions();
  testCredentialRotation();

  const {
    testConnectorPublication,
    testConnectorInstallation,
    testCompatibilityChecks,
    testVersionResolution,
    testReviewAggregation,
  } = await import("../dist/modules/marketplace/tests/marketplace.unit.js");
  testConnectorPublication();
  testConnectorInstallation();
  testCompatibilityChecks();
  testVersionResolution();
  testReviewAggregation();

  const {
    testTrustScoring,
    testAnomalyDetection,
    testFraudDetection,
    testHistoricalCalculations,
    testLeaderboardGeneration,
  } = await import("../dist/modules/reputation/tests/reputation.unit.js");
  testTrustScoring();
  testAnomalyDetection();
  testFraudDetection();
  testHistoricalCalculations();
  testLeaderboardGeneration();

  const {
    testReadinessChecks,
    testFeatureEvaluation,
    testDependencyValidation,
    testTracingAggregation,
    testMetricsGeneration,
  } = await import("../dist/modules/platform/tests/platform.unit.js");
  testReadinessChecks();
  testFeatureEvaluation();
  testDependencyValidation();
  testTracingAggregation();
  testMetricsGeneration();

  console.log("Wave 1–10 + Phase 1 security + Phase B/C/D/E/F/G/H/I notification, certificate, signature, admin, developer, search, audit, compliance, evidence, retention, enterprise, organization, region, recovery, governance, wallet-sync, integration, marketplace, reputation & platform unit checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
