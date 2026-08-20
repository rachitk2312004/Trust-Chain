import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Clock, Search, UserPlus, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  Input,
  Select,
} from "@trustchain/ui";
import {
  useApproveJoinRequest,
  useOrganizationJoinRequests,
  useRejectJoinRequest,
} from "../features/organizations/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getOrganizationErrorMessage } from "../lib/orgErrors";
import { roleDisplayLabel } from "../lib/roleDisplay";

export function OrganizationJoinRequestsPage() {
  const { organizationId = "" } = useParams();
  const requests = useOrganizationJoinRequests(organizationId);
  const approve = useApproveJoinRequest(organizationId);
  const reject = useRejectJoinRequest(organizationId);
  const feedback = useFeedback();
  const [query, setQuery] = useState("");
  const [roleByRequest, setRoleByRequest] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = requests.data ?? [];
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.email ?? ""} ${r.firstName ?? ""} ${r.lastName ?? ""} ${r.message ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [requests.data, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-tc-fg">Join requests</h2>
          <p className="mt-1 max-w-2xl text-sm text-tc-muted">
            People who applied to join without an invitation. Approve to enroll them immediately
            with the role you choose.
          </p>
        </div>
        <Badge tone={filtered.length ? "warning" : "info"} className="gap-1">
          <Clock className="h-3.5 w-3.5" />
          {filtered.length} pending
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tc-muted" />
        <Input
          className="pl-9"
          placeholder="Search by name, email, or message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search join requests"
        />
      </div>

      {requests.isError ? (
        <FormError>{getOrganizationErrorMessage(requests.error)}</FormError>
      ) : null}

      {requests.isLoading ? (
        <p className="text-sm text-tc-muted">Loading join requests…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-tc-muted" />
              No pending requests
            </CardTitle>
            <CardDescription>
              When someone uses <strong>Join org</strong> in the top bar and picks your
              organization, their request will appear here for approval.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((request) => {
            const name = [request.firstName, request.lastName].filter(Boolean).join(" ") || "—";
            const roleKey = roleByRequest[request.id] ?? request.requestedRole ?? "employee";
            return (
              <Card
                key={request.id}
                className="overflow-hidden border-tc-border shadow-soft transition hover:border-emerald-500/20"
              >
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-tc-fg">{request.email}</p>
                      <Badge tone="info">{roleDisplayLabel(request.requestedRole)}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-tc-muted">{name}</p>
                    {request.message ? (
                      <p className="mt-3 rounded-lg bg-tc-surface-2 px-3 py-2 text-sm text-tc-muted">
                        “{request.message}”
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-tc-muted">
                      Requested {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-[11rem]">
                      <label className="mb-1 block text-xs font-medium text-tc-muted">
                        Assign role on approve
                      </label>
                      <Select
                        className="h-9 w-full"
                        value={roleKey}
                        onChange={(e) =>
                          setRoleByRequest((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                      >
                        <option value="employee">Employee</option>
                        <option value="public_user">Certificate holder</option>
                        <option value="org_admin">Organization admin</option>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={approve.isPending || reject.isPending}
                        onClick={() =>
                          approve.mutate(
                            {
                              requestId: request.id,
                              roleKey: roleKey as "org_admin" | "employee" | "public_user",
                            },
                            {
                              onSuccess: () =>
                                feedback.success("Approved", `${request.email} is now a member.`),
                              onError: (err) => feedback.error(err, "Approve failed"),
                            },
                          )
                        }
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        disabled={approve.isPending || reject.isPending}
                        onClick={() =>
                          reject.mutate(
                            { requestId: request.id },
                            {
                              onSuccess: () => feedback.success("Request rejected"),
                              onError: (err) => feedback.error(err, "Reject failed"),
                            },
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
