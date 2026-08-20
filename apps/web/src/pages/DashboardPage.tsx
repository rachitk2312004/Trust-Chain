import { Link } from "react-router-dom";
import {
  Award,
  Building2,
  FileText,
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
  const activeId = useSessionStore((s) => s.activeOrganizationId);
  const active = (orgs.data ?? []).find((o) => o.id === activeId) ?? orgs.data?.[0];
  const membershipCount = me.data?.memberships.length ?? orgs.data?.length ?? 0;

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
        title="Dashboard"
        description={
          me.data?.user
            ? `Signed in as ${me.data.user.email}`
            : "Your TrustChain workspace overview."
        }
        actions={
          <Link
            to="/certificates"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Issue certificate
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      <GradientCard
        title={active ? active.name : "Select an organization"}
        description="Issue, verify, and govern trust artifacts from one operational surface."
        action={
          active ? (
            <Badge tone={active.status === "active" ? "success" : "warning"}>{active.status}</Badge>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link to={active ? `/organizations/${active.id}` : "/organizations"} className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Organization
          </Link>
          <Link to="/documents" className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Documents
          </Link>
          <Link to="/verification" className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Verification
          </Link>
          <Link to="/developer" className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
            Developer
          </Link>
        </div>
      </GradientCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizations" value={membershipCount} icon={<Building2 className="h-5 w-5" />} tone="info" />
        <StatCard label="Active workspace" value={active ? 1 : 0} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Quick paths" value={4} hint="Docs · Verify · QR · Certs" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Security" value="MFA" hint="Manage sessions & devices" icon={<Signature className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <MetricCard title="Trust activity" subtitle="Illustrative weekly volume" className="lg:col-span-2" value="Operational">
          <AreaTrendChart data={spark} />
        </MetricCard>
        <Card>
          <SectionHeader title="Activity" description="Recent memberships" />
          {activity.length ? (
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
              icon={<Award className="h-6 w-6" />}
            />
          )}
        </Card>
      </div>
    </AppShellLayout>
  );
}
