import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Input,
  Textarea,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  ConfigurationHistory,
  useAdminConfiguration,
  useAdminConfigurationHistory,
  useUpdateAdminConfiguration,
} from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";

export function AdminConfigurationPage() {
  const { isSuperAdmin } = usePermissions();
  const config = useAdminConfiguration(isSuperAdmin);
  const history = useAdminConfigurationHistory({ limit: 50 }, isSuperAdmin);
  const update = useUpdateAdminConfiguration();
  const feedback = useFeedback();
  const [key, setKey] = useState("admin.platform_settings");
  const [valueJson, setValueJson] = useState('{"maintenance": false}');
  const [description, setDescription] = useState("");

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin configuration" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin configuration"
        description="System configuration keys, history, and rollback."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current keys</CardTitle>
            <CardDescription>
              Known: {(config.data?.knownKeys ?? []).join(", ") || "—"}
            </CardDescription>
          </CardHeader>
          {config.isLoading ? (
            <FormHint>Loading…</FormHint>
          ) : (
            <ul className="space-y-2 text-sm">
              {(config.data?.configurations ?? []).map((row) => (
                <li key={row.id} className="rounded border border-[var(--tc-border)] p-2">
                  <p className="font-mono text-xs">{row.key}</p>
                  <pre className="mt-1 overflow-auto text-[10px]">
                    {JSON.stringify(row.value, null, 2)}
                  </pre>
                </li>
              ))}
              {(config.data?.configurations ?? []).length === 0 ? (
                <FormHint>No configuration rows yet.</FormHint>
              ) : null}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update configuration</CardTitle>
            <CardDescription>Stores previous/new values in the audit trail</CardDescription>
          </CardHeader>
          <div className="space-y-2">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" />
            <Textarea
              value={valueJson}
              onChange={(e) => setValueJson(e.target.value)}
              rows={6}
              placeholder='{"maintenance": false}'
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="description (optional)"
            />
            <Button
              size="sm"
              disabled={!key.trim() || update.isPending}
              onClick={() => {
                let parsed: unknown;
                try {
                  parsed = JSON.parse(valueJson);
                } catch {
                  feedback.error(new Error("Invalid JSON"), "Invalid JSON value");
                  return;
                }
                update.mutate(
                  {
                    key: key.trim(),
                    value: parsed,
                    description: description.trim() || null,
                  },
                  {
                    onSuccess: () => {
                      feedback.success("Configuration updated");
                      void history.refetch();
                      void config.refetch();
                    },
                    onError: (err) => feedback.error(err, "Update failed"),
                  },
                );
              }}
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
            <FormError>{update.error ? getApiErrorMessage(update.error) : null}</FormError>
          </div>
        </Card>
      </div>

      {history.isError ? <FormError>{getApiErrorMessage(history.error)}</FormError> : null}
      {history.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>
      ) : (
        <ConfigurationHistory history={history.data?.history ?? []} />
      )}
    </AdminShellLayout>
  );
}
