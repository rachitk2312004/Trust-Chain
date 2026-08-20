import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Input,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { getApiErrorMessage } from "../../services/http";
import { useFeedback } from "../../hooks/useFeedback";
import type { AdminFeatureFlag } from "../../types/api";
import { useCreateAdminFeatureFlag, useUpdateAdminFeatureFlag } from "./hooks";

export function FeatureFlagEditor({ flags }: { flags: AdminFeatureFlag[] | undefined }) {
  const feedback = useFeedback();
  const create = useCreateAdminFeatureFlag();
  const update = useUpdateAdminFeatureFlag();
  const [key, setKey] = useState("");
  const [rollout, setRollout] = useState("0");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Create feature flag</CardTitle>
          <CardDescription>Platform or org-scoped feature toggles</CardDescription>
        </CardHeader>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            placeholder="flag.key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="max-w-xs"
          />
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="Rollout %"
            value={rollout}
            onChange={(e) => setRollout(e.target.value)}
            className="w-28"
          />
          <Button
            size="sm"
            disabled={!key.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  key: key.trim(),
                  rolloutPercent: Number.parseInt(rollout, 10) || 0,
                  status: "inactive",
                },
                {
                  onSuccess: () => {
                    feedback.success("Feature flag created");
                    setKey("");
                    setRollout("0");
                  },
                  onError: (err) => feedback.error(err, "Create failed"),
                },
              )
            }
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
        <FormError>{create.error ? getApiErrorMessage(create.error) : null}</FormError>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>{flags?.length ?? 0} flags</CardDescription>
        </CardHeader>
        {!flags || flags.length === 0 ? (
          <FormHint>No feature flags yet.</FormHint>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Key</TH>
                <TH>Code</TH>
                <TH>Status</TH>
                <TH>Rollout</TH>
                <TH>Kill</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {flags.map((flag) => (
                <TR key={flag.id}>
                  <TD className="font-mono text-xs">{flag.key}</TD>
                  <TD className="font-mono text-xs">{flag.publicCode}</TD>
                  <TD>
                    <Badge
                      tone={
                        flag.status === "active"
                          ? "success"
                          : flag.killSwitch
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {flag.status}
                    </Badge>
                  </TD>
                  <TD>{flag.rolloutPercent}%</TD>
                  <TD>{flag.killSwitch ? "on" : "off"}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate(
                            {
                              id: flag.id,
                              status: "active",
                              killSwitch: false,
                              rolloutPercent: Math.max(flag.rolloutPercent, 100),
                            },
                            {
                              onSuccess: () => feedback.success(`Activated ${flag.key}`),
                              onError: (err) => feedback.error(err, "Update failed"),
                            },
                          )
                        }
                      >
                        Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate(
                            { id: flag.id, killSwitch: true, status: "suspended" },
                            {
                              onSuccess: () => feedback.success(`Killed ${flag.key}`),
                              onError: (err) => feedback.error(err, "Update failed"),
                            },
                          )
                        }
                      >
                        Kill
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <FormError>{update.error ? getApiErrorMessage(update.error) : null}</FormError>
      </Card>
    </div>
  );
}
