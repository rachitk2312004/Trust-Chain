import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireMfaChallenge } from "./guards";
import { SessionBootstrap } from "./SessionBootstrap";
import { LoadingScreen } from "../components/ui";
import { AppShellRoute } from "../layouts/AppShellRoute";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { MyCertificatesPage } from "../pages/MyCertificatesPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SessionsPage } from "../pages/SessionsPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { PublicVerificationPage } from "../pages/PublicVerificationPage";

function lazyPage(loader: () => Promise<Record<string, ComponentType<unknown>>>, exportName: string) {
  return lazy(async () => {
    const mod = await loader();
    const Comp = mod[exportName];
    if (!Comp) throw new Error(`Export ${exportName} not found`);
    return { default: Comp };
  });
}

const ForgotPasswordPage = lazyPage(() => import("../pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyPage(() => import("../pages/ResetPasswordPage"), "ResetPasswordPage");
const MfaPage = lazyPage(() => import("../pages/MfaPage"), "MfaPage");
const DashboardPage = lazyPage(() => import("../pages/DashboardPage"), "DashboardPage");
const OrganizationLayout = lazyPage(() => import("../layouts/OrganizationLayout"), "OrganizationLayout");
const OrganizationDetailPage = lazyPage(() => import("../pages/OrganizationDetailPage"), "OrganizationDetailPage");
const OrganizationSettingsPage = lazyPage(() => import("../pages/OrganizationSettingsPage"), "OrganizationSettingsPage");
const OrganizationMembersPage = lazyPage(() => import("../pages/OrganizationMembersPage"), "OrganizationMembersPage");
const OrganizationJoinRequestsPage = lazyPage(
  () => import("../pages/OrganizationJoinRequestsPage"),
  "OrganizationJoinRequestsPage",
);
const OrganizationInvitationsPage = lazyPage(
  () => import("../pages/OrganizationInvitationsPage"),
  "OrganizationInvitationsPage",
);
const OrganizationDepartmentsPage = lazyPage(
  () => import("../pages/OrganizationDepartmentsPage"),
  "OrganizationDepartmentsPage",
);
const OrganizationBranchesPage = lazyPage(() => import("../pages/OrganizationBranchesPage"), "OrganizationBranchesPage");
const DocumentLayout = lazyPage(() => import("../layouts/DocumentLayout"), "DocumentLayout");
const DocumentDetailPage = lazyPage(() => import("../pages/DocumentDetailPage"), "DocumentDetailPage");
const DocumentVersionsPage = lazyPage(() => import("../pages/DocumentVersionsPage"), "DocumentVersionsPage");
const DocumentSharePage = lazyPage(() => import("../pages/DocumentSharePage"), "DocumentSharePage");
const DocumentHistoryPage = lazyPage(() => import("../pages/DocumentHistoryPage"), "DocumentHistoryPage");
const DocumentsPage = lazyPage(() => import("../pages/DocumentsPage"), "DocumentsPage");
const CertificatesPage = lazyPage(() => import("../pages/CertificatesPage"), "CertificatesPage");
const WalletDashboardPage = lazyPage(() => import("../pages/WalletDashboardPage"), "WalletDashboardPage");
const SignaturesPage = lazyPage(() => import("../pages/SignaturesPage"), "SignaturesPage");
const VerificationPage = lazyPage(() => import("../pages/VerificationPage"), "VerificationPage");
const CertificateLayout = lazyPage(() => import("../layouts/CertificateLayout"), "CertificateLayout");
const CertificateDetailPage = lazyPage(() => import("../pages/CertificateDetailPage"), "CertificateDetailPage");
const CertificateHistoryPage = lazyPage(() => import("../pages/CertificateHistoryPage"), "CertificateHistoryPage");
const CertificateVerificationPage = lazyPage(
  () => import("../pages/CertificateVerificationPage"),
  "CertificateVerificationPage",
);
const PublicCertificateVerifyPage = lazyPage(
  () => import("../pages/PublicCertificateVerifyPage"),
  "PublicCertificateVerifyPage",
);
const VerificationHistoryPage = lazyPage(() => import("../pages/VerificationHistoryPage"), "VerificationHistoryPage");
const VerificationHashPage = lazyPage(() => import("../pages/VerificationHashPage"), "VerificationHashPage");
const VerificationUploadPage = lazyPage(() => import("../pages/VerificationUploadPage"), "VerificationUploadPage");
const VerificationDetailPage = lazyPage(() => import("../pages/VerificationDetailPage"), "VerificationDetailPage");
const QrPage = lazyPage(() => import("../pages/QrPage"), "QrPage");
const QrTemplatesPage = lazyPage(() => import("../pages/QrTemplatesPage"), "QrTemplatesPage");
const QrHistoryPage = lazyPage(() => import("../pages/QrHistoryPage"), "QrHistoryPage");
const QrAnalyticsPage = lazyPage(() => import("../pages/QrAnalyticsPage"), "QrAnalyticsPage");
const QrDetailPage = lazyPage(() => import("../pages/QrDetailPage"), "QrDetailPage");
const CertificateTemplatesPage = lazyPage(() => import("../pages/CertificateTemplatesPage"), "CertificateTemplatesPage");
const BulkUploadPage = lazyPage(() => import("../pages/BulkUploadPage"), "BulkUploadPage");
const CertificateAnalyticsPage = lazyPage(() => import("../pages/CertificateAnalyticsPage"), "CertificateAnalyticsPage");
const SignatureAnalyticsPage = lazyPage(() => import("../pages/SignatureAnalyticsPage"), "SignatureAnalyticsPage");
const SignatureHistoryPage = lazyPage(() => import("../pages/SignatureHistoryPage"), "SignatureHistoryPage");
const DetachedSignaturePage = lazyPage(() => import("../pages/DetachedSignaturePage"), "DetachedSignaturePage");
const SignaturePoliciesPage = lazyPage(() => import("../pages/SignaturePoliciesPage"), "SignaturePoliciesPage");
const SignatureWorkflowPage = lazyPage(() => import("../pages/SignatureWorkflowPage"), "SignatureWorkflowPage");
const SignatureWorkflowDetailPage = lazyPage(() => import("../pages/SignatureWorkflowDetailPage"), "SignatureWorkflowDetailPage");
const SignatureDetailPage = lazyPage(() => import("../pages/SignatureDetailPage"), "SignatureDetailPage");
const NotificationOpsPage = lazyPage(() => import("../features/notifications/NotificationOpsPage"), "NotificationOpsPage");
const NotificationPreferencesPage = lazyPage(() => import("../pages/NotificationPreferencesPage"), "NotificationPreferencesPage");
const NotificationHistoryPage = lazyPage(() => import("../pages/NotificationHistoryPage"), "NotificationHistoryPage");
const AdminDashboardPage = lazyPage(() => import("../pages/AdminDashboardPage"), "AdminDashboardPage");
const AdminUsersPage = lazyPage(() => import("../pages/AdminUsersPage"), "AdminUsersPage");
const AdminOrganizationsPage = lazyPage(() => import("../pages/AdminOrganizationsPage"), "AdminOrganizationsPage");
const AdminTenantsPage = lazyPage(() => import("../pages/AdminTenantsPage"), "AdminTenantsPage");
const AdminTenantDetailPage = lazyPage(() => import("../pages/AdminTenantDetailPage"), "AdminTenantDetailPage");
const AdminPermissionsPage = lazyPage(() => import("../pages/AdminPermissionsPage"), "AdminPermissionsPage");
const AdminFeatureFlagsPage = lazyPage(() => import("../pages/AdminFeatureFlagsPage"), "AdminFeatureFlagsPage");
const AdminAuditPage = lazyPage(() => import("../pages/AdminAuditPage"), "AdminAuditPage");
const AdminHealthPage = lazyPage(() => import("../pages/AdminHealthPage"), "AdminHealthPage");
const AdminInspectionPage = lazyPage(() => import("../pages/AdminInspectionPage"), "AdminInspectionPage");
const AdminConfigurationPage = lazyPage(() => import("../pages/AdminConfigurationPage"), "AdminConfigurationPage");
const AdminPoliciesPage = lazyPage(() => import("../pages/AdminPoliciesPage"), "AdminPoliciesPage");
const AdminPolicyDetailPage = lazyPage(() => import("../pages/AdminPolicyDetailPage"), "AdminPolicyDetailPage");
const AdminAnalyticsPage = lazyPage(() => import("../pages/AdminAnalyticsPage"), "AdminAnalyticsPage");
const DeveloperDashboardPage = lazyPage(() => import("../pages/DeveloperDashboardPage"), "DeveloperDashboardPage");
const DeveloperKeysPage = lazyPage(() => import("../pages/DeveloperKeysPage"), "DeveloperKeysPage");
const DeveloperWebhooksPage = lazyPage(() => import("../pages/DeveloperWebhooksPage"), "DeveloperWebhooksPage");
const DeveloperWebhookDetailPage = lazyPage(() => import("../pages/DeveloperWebhookDetailPage"), "DeveloperWebhookDetailPage");
const DeveloperUsagePage = lazyPage(() => import("../pages/DeveloperUsagePage"), "DeveloperUsagePage");
const DeveloperAnalyticsPage = lazyPage(() => import("../pages/DeveloperAnalyticsPage"), "DeveloperAnalyticsPage");
const DeveloperAuditPage = lazyPage(() => import("../pages/DeveloperAuditPage"), "DeveloperAuditPage");
const DeveloperApiExplorerPage = lazyPage(() => import("../pages/DeveloperApiExplorerPage"), "DeveloperApiExplorerPage");
const ApiDocsPage = lazyPage(() => import("../pages/ApiDocsPage"), "ApiDocsPage");
const SdkGuidePage = lazyPage(() => import("../pages/SdkGuidePage"), "SdkGuidePage");
const SearchPage = lazyPage(() => import("../pages/SearchPage"), "SearchPage");
const SearchAdministrationPage = lazyPage(() => import("../pages/SearchAdministrationPage"), "SearchAdministrationPage");
const AuditExplorerPage = lazyPage(() => import("../pages/AuditExplorerPage"), "AuditExplorerPage");
const AuditTimelinePage = lazyPage(() => import("../pages/AuditTimelinePage"), "AuditTimelinePage");
const ComplianceDashboardPage = lazyPage(() => import("../pages/ComplianceDashboardPage"), "ComplianceDashboardPage");
const ComplianceReportPage = lazyPage(() => import("../pages/ComplianceReportPage"), "ComplianceReportPage");
const EvidenceDashboardPage = lazyPage(() => import("../pages/EvidenceDashboardPage"), "EvidenceDashboardPage");
const EvidenceDetailPage = lazyPage(() => import("../pages/EvidenceDetailPage"), "EvidenceDetailPage");
const RetentionDashboardPage = lazyPage(() => import("../pages/RetentionDashboardPage"), "RetentionDashboardPage");
const LegalHoldPage = lazyPage(() => import("../pages/LegalHoldPage"), "LegalHoldPage");
const EnterpriseDashboardPage = lazyPage(() => import("../pages/EnterpriseDashboardPage"), "EnterpriseDashboardPage");
const EnterpriseRolesPage = lazyPage(() => import("../pages/EnterpriseRolesPage"), "EnterpriseRolesPage");
const OrganizationDashboardPage = lazyPage(() => import("../pages/OrganizationDashboardPage"), "OrganizationDashboardPage");
const OrganizationHierarchyPage = lazyPage(() => import("../pages/OrganizationHierarchyPage"), "OrganizationHierarchyPage");
const RegionDashboardPage = lazyPage(() => import("../pages/RegionDashboardPage"), "RegionDashboardPage");
const ResidencyReportPage = lazyPage(() => import("../pages/ResidencyReportPage"), "ResidencyReportPage");
const RecoveryDashboardPage = lazyPage(() => import("../pages/RecoveryDashboardPage"), "RecoveryDashboardPage");
const RecoveryReportsPage = lazyPage(() => import("../pages/RecoveryReportsPage"), "RecoveryReportsPage");
const GovernanceDashboardPage = lazyPage(() => import("../pages/GovernanceDashboardPage"), "GovernanceDashboardPage");
const GovernanceReportsPage = lazyPage(() => import("../pages/GovernanceReportsPage"), "GovernanceReportsPage");
const WalletHistoryPage = lazyPage(() => import("../pages/WalletHistoryPage"), "WalletHistoryPage");
const IntegrationDashboardPage = lazyPage(() => import("../pages/IntegrationDashboardPage"), "IntegrationDashboardPage");
const ConnectorMarketplacePage = lazyPage(() => import("../pages/ConnectorMarketplacePage"), "ConnectorMarketplacePage");
const MarketplaceDashboardPage = lazyPage(() => import("../pages/MarketplaceDashboardPage"), "MarketplaceDashboardPage");
const MarketplacePublisherPage = lazyPage(() => import("../pages/MarketplacePublisherPage"), "MarketplacePublisherPage");
const ReputationDashboardPage = lazyPage(() => import("../pages/ReputationDashboardPage"), "ReputationDashboardPage");
const ReputationLeaderboardPage = lazyPage(() => import("../pages/ReputationLeaderboardPage"), "ReputationLeaderboardPage");
const PlatformDashboardPage = lazyPage(() => import("../pages/PlatformDashboardPage"), "PlatformDashboardPage");
const PlatformOperationsPage = lazyPage(() => import("../pages/PlatformOperationsPage"), "PlatformOperationsPage");

function LazyPublic({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen className="min-h-screen" />}>{children}</Suspense>
  );
}

/** Authenticated app routes — shell stays mounted; only page content swaps. */
function AppRoutes() {
  return (
    <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verification/public" element={<PublicVerificationPage />} />
            <Route
              path="/certificates/verify/:publicId"
              element={
                <LazyPublic>
                  <PublicCertificateVerifyPage />
                </LazyPublic>
              }
            />

            <Route element={<PublicOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/forgot-password"
                element={
                  <LazyPublic>
                    <ForgotPasswordPage />
                  </LazyPublic>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <LazyPublic>
                    <ResetPasswordPage />
                  </LazyPublic>
                }
              />
            </Route>

            <Route element={<RequireMfaChallenge />}>
              <Route
                path="/mfa"
                element={
                  <LazyPublic>
                    <MfaPage />
                  </LazyPublic>
                }
              />
            </Route>

            <Route element={<RequireAuth />}>
              {/* Platform admin — standalone shell (AdminShellLayout inside each page). */}
              <Route path="/admin" element={<LazyPublic><AdminDashboardPage /></LazyPublic>} />
              <Route path="/admin/users" element={<LazyPublic><AdminUsersPage /></LazyPublic>} />
              <Route path="/admin/organizations" element={<LazyPublic><AdminOrganizationsPage /></LazyPublic>} />
              <Route path="/admin/tenants" element={<LazyPublic><AdminTenantsPage /></LazyPublic>} />
              <Route
                path="/admin/tenants/:tenantId"
                element={
                  <LazyPublic>
                    <AdminTenantDetailPage />
                  </LazyPublic>
                }
              />
              <Route path="/admin/permissions" element={<LazyPublic><AdminPermissionsPage /></LazyPublic>} />
              <Route path="/admin/feature-flags" element={<LazyPublic><AdminFeatureFlagsPage /></LazyPublic>} />
              <Route path="/admin/audit" element={<LazyPublic><AdminAuditPage /></LazyPublic>} />
              <Route path="/admin/health" element={<LazyPublic><AdminHealthPage /></LazyPublic>} />
              <Route path="/admin/inspection" element={<LazyPublic><AdminInspectionPage /></LazyPublic>} />
              <Route path="/admin/configuration" element={<LazyPublic><AdminConfigurationPage /></LazyPublic>} />
              <Route path="/admin/policies" element={<LazyPublic><AdminPoliciesPage /></LazyPublic>} />
              <Route
                path="/admin/policies/:policyId"
                element={
                  <LazyPublic>
                    <AdminPolicyDetailPage />
                  </LazyPublic>
                }
              />
              <Route path="/admin/analytics" element={<LazyPublic><AdminAnalyticsPage /></LazyPublic>} />
              <Route
                path="/platform"
                element={
                  <LazyPublic>
                    <PlatformDashboardPage />
                  </LazyPublic>
                }
              />
              <Route
                path="/platform/operations"
                element={
                  <LazyPublic>
                    <PlatformOperationsPage />
                  </LazyPublic>
                }
              />

              <Route element={<AppShellRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/organizations/:organizationId" element={<OrganizationLayout />}>
                <Route index element={<OrganizationDetailPage />} />
                <Route path="settings" element={<OrganizationSettingsPage />} />
                <Route path="members" element={<OrganizationMembersPage />} />
                <Route path="join-requests" element={<OrganizationJoinRequestsPage />} />
                <Route path="invitations" element={<OrganizationInvitationsPage />} />
                <Route path="departments" element={<OrganizationDepartmentsPage />} />
                <Route path="branches" element={<OrganizationBranchesPage />} />
              </Route>
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:documentId" element={<DocumentLayout />}>
                <Route index element={<DocumentDetailPage />} />
                <Route path="versions" element={<DocumentVersionsPage />} />
                <Route path="share" element={<DocumentSharePage />} />
                <Route path="history" element={<DocumentHistoryPage />} />
              </Route>
              <Route path="/verification" element={<VerificationPage />} />
              <Route path="/verification/history" element={<VerificationHistoryPage />} />
              <Route path="/verification/hash" element={<VerificationHashPage />} />
              <Route path="/verification/upload" element={<VerificationUploadPage />} />
              <Route path="/verification/:verificationId" element={<VerificationDetailPage />} />
              <Route path="/qr" element={<QrPage />} />
              <Route path="/qr/templates" element={<QrTemplatesPage />} />
              <Route path="/qr/history" element={<QrHistoryPage />} />
              <Route path="/qr/analytics" element={<QrAnalyticsPage />} />
              <Route path="/qr/:qrId" element={<QrDetailPage />} />
              <Route path="/my-certificates" element={<MyCertificatesPage />} />
              <Route path="/verify" element={<PublicVerificationPage />} />
              <Route path="/certificates" element={<CertificatesPage />} />
              <Route path="/certificates/templates" element={<CertificateTemplatesPage />} />
              <Route path="/certificates/bulk" element={<BulkUploadPage />} />
              <Route path="/certificates/analytics" element={<CertificateAnalyticsPage />} />
              <Route path="/certificates/:certificateId" element={<CertificateLayout />}>
                <Route index element={<CertificateDetailPage />} />
                <Route path="history" element={<CertificateHistoryPage />} />
                <Route path="verify" element={<CertificateVerificationPage />} />
              </Route>
              <Route path="/signatures" element={<SignaturesPage />} />
              <Route path="/signatures/analytics" element={<SignatureAnalyticsPage />} />
              <Route path="/signatures/history" element={<SignatureHistoryPage />} />
              <Route path="/signatures/detached" element={<DetachedSignaturePage />} />
              <Route path="/signatures/policies" element={<SignaturePoliciesPage />} />
              <Route path="/signatures/workflows" element={<SignatureWorkflowPage />} />
              <Route path="/signatures/workflows/:workflowId" element={<SignatureWorkflowDetailPage />} />
              <Route path="/signatures/:signatureId" element={<SignatureDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/notifications/ops" element={<NotificationOpsPage />} />
              <Route path="/notifications/preferences" element={<NotificationPreferencesPage />} />
              <Route path="/notifications/history" element={<NotificationHistoryPage />} />
              <Route path="/developer" element={<DeveloperDashboardPage />} />
              <Route path="/developer/keys" element={<DeveloperKeysPage />} />
              <Route path="/developer/webhooks" element={<DeveloperWebhooksPage />} />
              <Route path="/developer/webhooks/:webhookId" element={<DeveloperWebhookDetailPage />} />
              <Route path="/developer/usage" element={<DeveloperUsagePage />} />
              <Route path="/developer/analytics" element={<DeveloperAnalyticsPage />} />
              <Route path="/developer/audit" element={<DeveloperAuditPage />} />
              <Route path="/developer/explorer" element={<DeveloperApiExplorerPage />} />
              <Route path="/developer/docs" element={<ApiDocsPage />} />
              <Route path="/developer/sdk" element={<SdkGuidePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/search/admin" element={<SearchAdministrationPage />} />
              <Route path="/audit" element={<AuditExplorerPage />} />
              <Route path="/audit/timeline" element={<AuditTimelinePage />} />
              <Route path="/compliance" element={<ComplianceDashboardPage />} />
              <Route path="/compliance/reports" element={<ComplianceReportPage />} />
              <Route path="/evidence" element={<EvidenceDashboardPage />} />
              <Route path="/evidence/:id" element={<EvidenceDetailPage />} />
              <Route path="/retention" element={<RetentionDashboardPage />} />
              <Route path="/retention/holds" element={<LegalHoldPage />} />
              <Route path="/enterprise" element={<EnterpriseDashboardPage />} />
              <Route path="/enterprise/roles" element={<EnterpriseRolesPage />} />
              <Route path="/organization" element={<OrganizationDashboardPage />} />
              <Route path="/organization/hierarchy" element={<OrganizationHierarchyPage />} />
              <Route path="/regions" element={<RegionDashboardPage />} />
              <Route path="/regions/residency" element={<ResidencyReportPage />} />
              <Route path="/recovery" element={<RecoveryDashboardPage />} />
              <Route path="/recovery/reports" element={<RecoveryReportsPage />} />
              <Route path="/governance" element={<GovernanceDashboardPage />} />
              <Route path="/governance/reports" element={<GovernanceReportsPage />} />
              <Route path="/wallets" element={<WalletDashboardPage />} />
              <Route path="/wallets/history" element={<WalletHistoryPage />} />
              <Route path="/integrations" element={<IntegrationDashboardPage />} />
              <Route path="/integrations/marketplace" element={<ConnectorMarketplacePage />} />
              <Route path="/marketplace" element={<MarketplaceDashboardPage />} />
              <Route path="/marketplace/publisher" element={<MarketplacePublisherPage />} />
              <Route path="/reputation" element={<ReputationDashboardPage />} />
              <Route path="/reputation/leaderboard" element={<ReputationLeaderboardPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <AppRoutes />
      </SessionBootstrap>
    </BrowserRouter>
  );
}
