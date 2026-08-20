import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ApprovalWorkflowCard,
  BusinessUnitTable,
  DepartmentTable,
  useCreateBusinessUnit,
  useCreateOrgApproval,
  useCreateOrgDepartment,
  useOrgPlatform,
} from "../features/organization-platform";

export function OrganizationDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const dashboard = useOrgPlatform(organizationId, canManage);
  const createDept = useCreateOrgDepartment();
  const createBu = useCreateBusinessUnit();
  const createApproval = useCreateOrgApproval();

  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [buKey, setBuKey] = useState("engineering");
  const [buName, setBuName] = useState("Engineering");
  const [ccCode, setCcCode] = useState("CC-ENG");

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Organization" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Organization" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const data = dashboard.data;

  return (
    <AppShellLayout>
      <PageHeader
        title="Organization platform"
        description="Departments, business units, cost centers, approvals, and policy inheritance."
        actions={
          <Link
            to="/organization/hierarchy"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            Hierarchy
          </Link>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}
      {createDept.isError ? <FormError>{getApiErrorMessage(createDept.error)}</FormError> : null}
      {createBu.isError ? <FormError>{getApiErrorMessage(createBu.error)}</FormError> : null}
      {createApproval.isError ? (
        <FormError>{getApiErrorMessage(createApproval.error)}</FormError>
      ) : null}

      {dashboard.isLoading || !data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading organization…</p>
      ) : (
        <div className="space-y-10">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Departments</div>
              <div className="mt-1 text-3xl font-semibold">{data.report.departments}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Business units</div>
              <div className="mt-1 text-3xl font-semibold">{data.report.businessUnits}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Cost centers</div>
              <div className="mt-1 text-3xl font-semibold">{data.report.costCenters}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Owner coverage</div>
              <div className="mt-1 text-3xl font-semibold">
                {Math.round(data.report.coverage * 100)}%
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <form
              className="space-y-3 rounded border border-[var(--tc-border)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                createBu.mutate({
                  organizationId,
                  key: buKey,
                  name: buName,
                  costCenter: { code: ccCode, name: `${buName} cost center` },
                });
              }}
            >
              <h2 className="text-sm font-semibold">Add business unit</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="bu-key">Key</Label>
                  <Input id="bu-key" value={buKey} onChange={(e) => setBuKey(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="bu-name">Name</Label>
                  <Input id="bu-name" value={buName} onChange={(e) => setBuName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="cc-code">Cost center</Label>
                  <Input id="cc-code" value={ccCode} onChange={(e) => setCcCode(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" disabled={createBu.isPending}>
                {createBu.isPending ? "Creating…" : "Create BU"}
              </Button>
            </form>

            <form
              className="space-y-3 rounded border border-[var(--tc-border)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                createDept.mutate({
                  organizationId,
                  name: deptName,
                  code: deptCode || undefined,
                  businessUnitId: data.businessUnits[0]?.id,
                  policy: { classification: "internal" },
                });
                setDeptName("");
                setDeptCode("");
              }}
            >
              <h2 className="text-sm font-semibold">Add department</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dept-name">Name</Label>
                  <Input
                    id="dept-name"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dept-code">Code</Label>
                  <Input id="dept-code" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} />
                </div>
              </div>
              <FormHint>
                Attaches to first business unit when present ({data.businessUnits[0]?.key ?? "none"}).
              </FormHint>
              <Button type="submit" disabled={createDept.isPending || !deptName}>
                {createDept.isPending ? "Creating…" : "Create department"}
              </Button>
            </form>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Business units
            </h2>
            <BusinessUnitTable units={data.businessUnits} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Departments
            </h2>
            <DepartmentTable departments={data.departments} />
          </section>

          <ApprovalWorkflowCard
            approvals={data.approvals}
            pending={createApproval.isPending}
            onCreate={(input) =>
              createApproval.mutate({
                organizationId,
                ...input,
              })
            }
          />
        </div>
      )}
    </AppShellLayout>
  );
}
