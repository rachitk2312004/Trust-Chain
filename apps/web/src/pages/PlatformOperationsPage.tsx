import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import {
  FeatureFlagTable,
  MetricsPanel,
  usePatchPlatformConfiguration,
  usePatchPlatformFeature,
  usePlatformConfiguration,
  usePlatformFeatures,
  usePlatformMetrics,
} from "../features/platform";

export function PlatformOperationsPage() {
  const { isSuperAdmin } = usePermissions();
  const configuration = usePlatformConfiguration(isSuperAdmin);
  const features = usePlatformFeatures(isSuperAdmin);
  const metrics = usePlatformMetrics(isSuperAdmin);
  const patchConfig = usePatchPlatformConfiguration();
  const patchFeature = usePatchPlatformFeature();

  const [windowMs, setWindowMs] = useState("60000");
  const [maxRequests, setMaxRequests] = useState("120");
  const [message, setMessage] = useState<string | null>(null);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Platform operations" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Platform operations"
        description="Configuration, feature flags, rate limits, and metrics."
        actions={
          <Link to="/platform" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {message ? <FormHint>{message}</FormHint> : null}
      {patchConfig.isError ? (
        <FormError>{getApiErrorMessage(patchConfig.error)}</FormError>
      ) : null}
      {patchFeature.isError ? (
        <FormError>{getApiErrorMessage(patchFeature.error)}</FormError>
      ) : null}

      <div className="space-y-10">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Rate-limit configuration
          </h2>
          <form
            className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              patchConfig.mutate(
                {
                  entries: [
                    {
                      key: "platform.rate_limits",
                      value: {
                        windowMs: Number(windowMs),
                        maxRequests: Number(maxRequests),
                      },
                      description: "Platform API rate-limit policy",
                    },
                  ],
                },
                {
                  onSuccess: () => setMessage("Rate-limit configuration saved"),
                },
              );
            }}
          >
            <div>
              <Label htmlFor="rl-window">Window (ms)</Label>
              <Input
                id="rl-window"
                value={windowMs}
                onChange={(e) => setWindowMs(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="rl-max">Max requests</Label>
              <Input
                id="rl-max"
                value={maxRequests}
                onChange={(e) => setMaxRequests(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={patchConfig.isPending}>
                {patchConfig.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>

          {configuration.isLoading || !configuration.data ? (
            <p className="mt-3 text-sm text-[var(--tc-muted)]">Loading configuration…</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {configuration.data.entries.map((entry) => (
                <li key={entry.key} className="rounded border border-[var(--tc-border)] p-3">
                  <div className="font-mono text-sm">{entry.key}</div>
                  <pre className="mt-1 overflow-x-auto text-xs text-[var(--tc-muted)]">
                    {JSON.stringify(entry.value, null, 2)}
                  </pre>
                  {entry.default ? (
                    <span className="text-xs text-[var(--tc-muted)]">default</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Feature flags
          </h2>
          {features.isLoading || !features.data ? (
            <p className="text-sm text-[var(--tc-muted)]">Loading features…</p>
          ) : (
            <FeatureFlagTable
              features={features.data.features}
              togglingId={patchFeature.isPending ? patchFeature.variables?.id : null}
              onToggleKill={(flag) => {
                patchFeature.mutate(
                  {
                    id: flag.id,
                    body: {
                      killSwitch: !flag.killSwitch,
                      status: !flag.killSwitch ? "suspended" : "active",
                    },
                  },
                  {
                    onSuccess: () =>
                      setMessage(
                        `Flag ${flag.key} kill switch ${!flag.killSwitch ? "enabled" : "cleared"}`,
                      ),
                  },
                );
              }}
            />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Live metrics
          </h2>
          {metrics.isLoading || !metrics.data ? (
            <p className="text-sm text-[var(--tc-muted)]">Loading metrics…</p>
          ) : (
            <MetricsPanel metrics={metrics.data.metrics} tracing={metrics.data.tracing} />
          )}
        </section>
      </div>
    </AdminShellLayout>
  );
}
