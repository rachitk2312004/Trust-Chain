import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useCreateOrganization, useMyJoinRequests, useOrganizations } from "../features/organizations/hooks";
import { getOrganizationErrorMessage } from "../lib/orgErrors";
import { usePermissions } from "../hooks/usePermissions";
import { canSelfJoinOrganization } from "../lib/workspacePersona";
import { useSessionStore } from "../lib/sessionStore";

export function OrganizationsPage() {
  const navigate = useNavigate();
  const orgs = useOrganizations();
  const create = useCreateOrganization();
  const { can, roles, isSuperAdmin } = usePermissions();
  const allowJoin = canSelfJoinOrganization(roles);
  const myRequests = useMyJoinRequests(allowJoin);
  const setActive = useSessionStore((s) => s.setActiveOrganizationId);
  const canCreateOrg = can("org.create") && !isSuperAdmin;
  const approvedJoin = (myRequests.data ?? []).some((r) => r.status === "approved");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function onCreate(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { name: name.trim(), slug: slug.trim() || undefined },
      {
        onSuccess: (organization) => {
          setOpen(false);
          setName("");
          setSlug("");
          setActive(organization.id);
          navigate(`/organizations/${organization.id}`);
        },
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Organizations you belong to."
        actions={
          canCreateOrg ? (
            <Button onClick={() => setOpen(true)}>Create organization</Button>
          ) : undefined
        }
      />

      {orgs.isError ? <FormError>{getOrganizationErrorMessage(orgs.error)}</FormError> : null}
      {orgs.isLoading ? <p className="text-sm text-[var(--tc-muted)]">Loading organizations…</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(orgs.data ?? []).map((org) => (
          <Link
            key={org.id}
            to={`/organizations/${org.id}`}
            onClick={() => setActive(org.id)}
            className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)]"
          >
            <Card className="h-full transition hover:border-[var(--tc-accent)]">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{org.name}</CardTitle>
                  <Badge tone={org.status === "active" ? "success" : "warning"}>{org.status}</Badge>
                </div>
                <CardDescription>/{org.slug}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {!orgs.isLoading && (orgs.data?.length ?? 0) === 0 ? (
        <FormHint>
          {canCreateOrg
            ? "No organizations yet. Create one to get started."
            : isSuperAdmin
              ? "Provision organizations from Admin → Tenants and assign an organization admin by email."
              : approvedJoin
              ? "Your join request was approved. Refresh the page if your organization does not appear yet."
              : "No organizations yet. Use Join org in the top bar to request access, or wait for an invitation."}
        </FormHint>
      ) : null}

      {canCreateOrg ? (
      <Modal
        open={open}
        title="Create organization"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-org-form" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <form id="create-org-form" className="flex flex-col gap-3" onSubmit={onCreate}>
          <Field>
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="org-slug">Slug (optional)</Label>
            <Input
              id="org-slug"
              pattern="[a-z0-9-]+"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <FormHint>Lowercase letters, numbers, and hyphens. Auto-generated from name if empty.</FormHint>
          </Field>
          <FormError>{create.error ? getOrganizationErrorMessage(create.error) : null}</FormError>
        </form>
      </Modal>
      ) : null}
    </>
  );
}
