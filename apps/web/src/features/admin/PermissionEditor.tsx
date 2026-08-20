import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Select,
} from "@trustchain/ui";
import { getApiErrorMessage } from "../../services/http";
import { useFeedback } from "../../hooks/useFeedback";
import type { AdminPermissionsResponse } from "../../types/api";
import { useAssignAdminPermissions } from "./hooks";

export function PermissionEditor({
  permissions,
}: {
  permissions: AdminPermissionsResponse | undefined;
}) {
  const feedback = useFeedback();
  const assign = useAssignAdminPermissions();
  const roleKeys = useMemo(
    () => Object.keys(permissions?.roleCapabilities ?? permissions?.defaults ?? {}),
    [permissions],
  );
  const [roleKey, setRoleKey] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!roleKey && roleKeys.length) setRoleKey(roleKeys[0]!);
  }, [roleKey, roleKeys]);

  useEffect(() => {
    if (!permissions || !roleKey) return;
    setSelected([...(permissions.roleCapabilities[roleKey] ?? [])]);
  }, [permissions, roleKey]);

  if (!permissions) {
    return <FormHint>Loading permissions…</FormHint>;
  }

  const catalog = permissions.catalog;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission assignment</CardTitle>
        <CardDescription>Assign admin capabilities to roles</CardDescription>
      </CardHeader>

      <div className="mb-3 max-w-sm">
        <label className="mb-1 block text-sm font-medium">Role</label>
        <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
          {roleKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </Select>
      </div>

      <ul className="mb-4 space-y-2">
        {catalog.map((entry) => {
          const checked = selected.includes(entry.key);
          return (
            <li key={entry.key} className="flex items-start gap-2 text-sm">
              <input
                id={`cap-${entry.key}`}
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={() =>
                  setSelected((prev) =>
                    checked ? prev.filter((c) => c !== entry.key) : [...prev, entry.key],
                  )
                }
              />
              <label htmlFor={`cap-${entry.key}`}>
                <span className="font-medium">{entry.name}</span>
                <span className="ml-2 font-mono text-xs text-[var(--tc-muted)]">{entry.key}</span>
                <p className="text-[var(--tc-muted)]">{entry.description}</p>
              </label>
            </li>
          );
        })}
      </ul>

      <Button
        size="sm"
        disabled={!roleKey || assign.isPending}
        onClick={() =>
          assign.mutate(
            { roleKey, capabilities: selected },
            {
              onSuccess: () => feedback.success(`Updated permissions for ${roleKey}`),
              onError: (err) => feedback.error(err, "Permission update failed"),
            },
          )
        }
      >
        {assign.isPending ? "Saving…" : "Save permissions"}
      </Button>
      <FormError>{assign.error ? getApiErrorMessage(assign.error) : null}</FormError>
    </Card>
  );
}
