import { useState } from "react";
import { Badge, Button, FormHint, Input, Label, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { EnterpriseRole } from "../../services/enterpriseApi";

export function RoleEditor({
  roles,
  pending,
  onCreate,
}: {
  roles: EnterpriseRole[];
  pending?: boolean;
  onCreate: (input: {
    key: string;
    name: string;
    parentRoleId?: string;
    permissions: string[];
  }) => void;
}) {
  const [key, setKey] = useState("editor");
  const [name, setName] = useState("Editor");
  const [parentRoleId, setParentRoleId] = useState("");
  const [permissions, setPermissions] = useState("docs:read,docs:write");

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded border border-[var(--tc-border)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({
            key,
            name,
            parentRoleId: parentRoleId || undefined,
            permissions: permissions
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
          });
        }}
      >
        <h2 className="text-sm font-semibold">Create role</h2>
        <FormHint>Roles support parent inheritance — child permissions include ancestors.</FormHint>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="role-key">Key</Label>
            <Input id="role-key" value={key} onChange={(e) => setKey(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="role-parent">Parent role</Label>
            <select
              id="role-parent"
              className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
              value={parentRoleId}
              onChange={(e) => setParentRoleId(e.target.value)}
            >
              <option value="">None</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.key}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="role-perms">Permissions</Label>
            <Input
              id="role-perms"
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
              placeholder="docs:read,docs:write"
            />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create role"}
        </Button>
      </form>

      {roles.length === 0 ? (
        <FormHint>No enterprise roles yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Role</TH>
              <TH>Permissions</TH>
              <TH>Inherited</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {roles.map((r) => (
              <TR key={r.id}>
                <TD>
                  <div className="font-medium">{r.name}</div>
                  <div className="font-mono text-xs text-[var(--tc-muted)]">
                    {r.key}
                    {r.ancestors && r.ancestors.length > 1
                      ? ` · ${r.ancestors.join(" ← ")}`
                      : ""}
                  </div>
                </TD>
                <TD className="font-mono text-xs">{r.permissions.join(", ") || "—"}</TD>
                <TD className="font-mono text-xs">
                  {(r.inheritedPermissions ?? r.permissions).join(", ") || "—"}
                </TD>
                <TD>
                  <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
