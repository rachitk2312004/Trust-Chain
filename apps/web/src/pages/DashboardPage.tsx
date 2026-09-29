import { Link } from "react-router-dom";
import {
  Award,
  Building2,
  FileText,
  MessageSquare,
  ShieldCheck,
  Signature,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  ActivityFeed,
  AreaTrendChart,
  Card,
  EmptyState,
  GradientCard,
  MetricCard,
  SectionHeader,
  StatCard,
} from "../components/ui";
import { useCurrentUser } from "../features/auth/hooks";
import { useOrganizations } from "../features/organizations/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getWorkspacePersona } from "../lib/workspacePersona";
import { useSessionStore } from "../lib/sessionStore";

const spark = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 15 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 28 },
  { label: "Sat", value: 19 },
  { label: "Sun", value: 24 },
];

export function DashboardPage() {
  const orgs = useOrganizations();
  const me = useCurrentUser();
  const roles = useSessionStore((s) => s.roles);
  const activeId = useSessionStore((s) => s.activeOrganizationId);
  const active = (orgs.data ?? []).find((o) => o.id === activeId) ?? orgs.data?.[0];
  const membershipCount = me.data?.memberships.length ?? orgs.data?.length ?? 0;
  const persona = getWorkspacePersona(roles, activeId);
  const employee = persona.kind === "employee";
  const placement = (me.data?.memberships ?? []).find((m) => m.organizationId === active?.id);

  const activity = (me.data?.memberships ?? []).slice(0, 5).map((m, i) => ({
    id: m.id,
    title: m.organizationName,
    description: `Membership`,
    time: i === 0 ? "Active" : "Joined",
    tone: "success" as const,
  }));

  return (
    <AppShellLayout>
      <PageHeader
        title={employee ? "Employee console" : "Dashboard"}
        description={
          employee
            ? `Issue and verify for ${placement?.branchName ?? "the whole organization"}${
                placement?.departmentName ? ` · ${placement.departmentName}` : ""
              }.`
            : me.data?.user
              ? `Signed in as ${me.data.user.email}`
              : "Your TrustChain workspace overview."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/certificates"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Issue certificate
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            {employee ? (
              <Link
                to="/verification"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--tc-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--tc-hover)]"
              >
                Verify certificate
              </Link>
            ) : null}
          </div>
        }
      />

      <GradientCard
        title={active ? active.name : "Select an organization"}
        description={
          employee
            ? "Staff tools for issuing credentials and checking authenticity."
            : "Issue, verify, and govern trust artifacts from one operational surface."
        }
        action={
          active ? (
            <Badge tone={active.status === "active" ? "success" : "warning"}>{active.status}</Badge>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/certificates" className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Issue
          </Link>
          <Link to="/verification" className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Verify
          </Link>
          <Link to="/messages" className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Messages
          </Link>
          {!employee ? (
            <Link
              to={active ? `/organizations/${active.id}` : "/organizations"}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              Organization
            </Link>
          ) : null}
        </div>
      </GradientCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Organization"
          value={active?.name ?? "—"}
          icon={<Building2 className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Issue desk"
          value="Ready"
          hint="Create credentials for holders"
          icon={<Award className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Verify desk"
          value="Ready"
          hint="Check PDFs and CERT ID lists"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label={employee ? "Team chat" : "Memberships"}
          value={employee ? "Open" : membershipCount}
          hint={employee ? "Direct and group messages" : "Joined workspaces"}
          icon={employee ? <MessageSquare className="h-5 w-5" /> : <Signature className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <MetricCard
          title={employee ? "Staff activity" : "Trust activity"}
          subtitle="Illustrative weekly volume"
          className="lg:col-span-2"
          value="Operational"
        >
          <AreaTrendChart data={spark} />
        </MetricCard>
        <Card>
          <SectionHeader
            title={employee ? "Quick actions" : "Activity"}
            description={employee ? "Certificate workflows" : "Recent memberships"}
          />
          {employee ? (
            <div className="space-y-2 text-sm">
              <Link to="/certificates" className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--tc-hover)]">
                Issue a certificate
                <Award className="h-4 w-4 text-tc-muted" />
              </Link>
              <Link to="/verification" className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--tc-hover)]">
                Verify a document
                <ShieldCheck className="h-4 w-4 text-tc-muted" />
              </Link>
              <Link to="/messages" className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--tc-hover)]">
                Message org admin
                <MessageSquare className="h-4 w-4 text-tc-muted" />
              </Link>
            </div>
          ) : activity.length ? (
            <ActivityFeed items={activity} />
          ) : (
            <EmptyState
              title="No memberships yet"
              description="Create or join an organization to start issuing trust artifacts."
              action={
                <Link to="/organizations" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                  Open organizations
                </Link>
              }
              icon={<FileText className="h-6 w-6" />}
            />
          )}
        </Card>
      </div>
    </AppShellLayout>
  );
}
