# Web portal routes

| Path | Auth | Purpose |
|------|------|---------|
| `/` | public | Marketing/home |
| `/login` | public-only | Sign in |
| `/register` | public-only | Create account |
| `/forgot-password` | public-only | Request reset |
| `/reset-password` | public-only | Complete reset |
| `/mfa` | MFA challenge | TOTP verification |
| `/dashboard` | auth | Workspace overview |
| `/organizations` | auth | Org list / create |
| `/organizations/:organizationId` | auth | Org overview |
| `/organizations/:organizationId/members` | auth | Members |
| `/organizations/:organizationId/invitations` | auth | Invitations |
| `/organizations/:organizationId/branches` | auth | Branches |
| `/organizations/:organizationId/departments` | auth | Departments |
| `/organizations/:organizationId/settings` | auth | Profile + branding |
| `/documents` | auth | Document list/upload |
| `/documents/:documentId` | auth | Detail + editors |
| `/documents/:documentId/versions` | auth | Versions |
| `/documents/:documentId/share` | auth | Shares |
| `/documents/:documentId/history` | auth | Audit history |
| `/verification` | auth | Verification dashboard |
| `/verification/history` | auth | History |
| `/verification/hash` | auth | Hash / identifier verify |
| `/verification/upload` | auth | File verify |
| `/verification/:verificationId` | auth | Detail |
| `/verification/public` | public | Anonymous verify |
| `/qr` | auth | QR dashboard |
| `/qr/templates` | auth | Templates |
| `/qr/history` | auth | Scan events |
| `/qr/analytics` | auth | Analytics |
| `/qr/:qrId` | auth | QR detail (`publicCode`) |
| `/settings` | auth | Account settings |
| `/sessions` | auth | Session management |
| `/notifications` | auth | Notification inbox |
| `/notifications/preferences` | auth | Event channel preferences |
| `/notifications/history` | auth | Notification history |
| `/admin` | auth (super_admin) | Administration dashboard |
| `/admin/users` | auth (super_admin) | User administration |
| `/admin/organizations` | auth (super_admin) | Organization administration |
| `/admin/tenants` | auth (super_admin) | Tenant lifecycle & quotas |
| `/admin/tenants/:tenantId` | auth (super_admin) | Tenant detail |
| `/admin/permissions` | auth (super_admin) | Roles & permission assignment |
| `/admin/feature-flags` | auth (super_admin) | Feature flag management |
| `/admin/audit` | auth (super_admin) | Audit browser |
| `/admin/health` | auth (super_admin) | System health |
| `/admin/inspection` | auth (super_admin) | Platform inspection |
| `/admin/configuration` | auth (super_admin) | Configuration + rollback |
| `/admin/policies` | auth (super_admin) | Policy engine |
| `/admin/policies/:policyId` | auth (super_admin) | Policy detail |
| `/admin/analytics` | auth (super_admin) | Analytics & operations |
| `/developer` | auth (org_admin) | Developer dashboard |
| `/developer/keys` | auth (org_admin) | API key management |
| `/developer/webhooks` | auth (org_admin) | Webhook management |
