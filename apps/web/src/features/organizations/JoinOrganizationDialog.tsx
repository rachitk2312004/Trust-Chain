import { useEffect, useRef, useState } from "react";
import { Building2, Search, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@trustchain/ui";
import { useCreateJoinRequest, useDiscoverOrganizations } from "./hooks";
import { useFeedback } from "../../hooks/useFeedback";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { getOrganizationErrorMessage } from "../../lib/orgErrors";

export function JoinOrganizationDialog({
  open,
  onClose,
  onRequested,
}: {
  open: boolean;
  onClose: () => void;
  onRequested?: () => void;
}) {
  const feedback = useFeedback();
  const createRequest = useCreateJoinRequest();
  const resetCreateRequest = createRequest.reset;
  const wasOpen = useRef(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [message, setMessage] = useState("");
  const [requestedRole, setRequestedRole] = useState<"employee" | "public_user">("employee");

  useEffect(() => {
    if (!open) return;
    setDebouncedQuery("");
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  // Reset form only when the dialog closes — not on every render while closed.
  useEffect(() => {
    if (wasOpen.current && !open) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedOrgId("");
      setMessage("");
      setRequestedRole("employee");
      resetCreateRequest();
    }
    wasOpen.current = open;
  }, [open, resetCreateRequest]);

  const discover = useDiscoverOrganizations(debouncedQuery, open);
  const results = discover.data ?? [];
  const selected = results.find((org) => org.id === selectedOrgId);

  function handleClose() {
    createRequest.reset();
    onClose();
  }

  function onSubmit() {
    if (!selectedOrgId) {
      feedback.error(new Error("Select an organization"), "Choose an organization first");
      return;
    }
    createRequest.mutate(
      { organizationId: selectedOrgId, message: message.trim() || undefined, requestedRole },
      {
        onSuccess: () => {
          feedback.success("Join request sent", "An organization admin will review your request.");
          onRequested?.();
          handleClose();
        },
        onError: (err) => feedback.error(err, getApiErrorMessage(err)),
      },
    );
  }

  const emptyMessage = discover.isError
    ? "Could not load organizations."
    : debouncedQuery
      ? `No organizations match “${debouncedQuery}”. Try the org name or slug without “/”.`
      : "Showing available organizations — search to narrow results.";

  return (
    <Modal
      open={open}
      title="Request to join an organization"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!selectedOrgId || createRequest.isPending || selected?.isMember}
          >
            {createRequest.isPending ? "Sending…" : "Send join request"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-tc-muted">
          <p className="font-medium text-tc-fg">No invite? Request access here.</p>
          <p className="mt-1">
            If an admin sends you an invitation and you accept it, you are enrolled automatically.
            Otherwise, search for your organization and submit a join request.
          </p>
        </div>

        <Field>
          <Label htmlFor="org-search">Search organizations</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tc-muted" />
            <Input
              id="org-search"
              className="pl-9"
              placeholder="Name or slug, e.g. acme-university"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedOrgId("");
              }}
              autoFocus
            />
          </div>
          <FormHint>Tip: enter the slug exactly as shown to admins (no leading slash).</FormHint>
        </Field>

        <div className="max-h-60 overflow-y-auto rounded-xl border border-tc-border bg-tc-surface-2/40">
          {discover.isLoading ? (
            <p className="p-4 text-sm text-tc-muted">Searching organizations…</p>
          ) : discover.isError ? (
            <div className="p-4">
              <FormError>{getOrganizationErrorMessage(discover.error)}</FormError>
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-tc-muted">{emptyMessage}</p>
          ) : (
            <ul className="divide-y divide-tc-border">
              {results.map((org) => {
                const disabled = org.isMember || org.hasPendingRequest;
                const isSelected = selectedOrgId === org.id;
                return (
                  <li key={org.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedOrgId(org.id)}
                      className={[
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                        isSelected ? "bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30" : "hover:bg-tc-surface",
                        disabled ? "cursor-not-allowed opacity-60" : "",
                      ].join(" ")}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900 text-tc-accent">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-tc-fg">{org.name}</span>
                        <span className="block font-mono text-xs text-tc-muted">/{org.slug}</span>
                      </span>
                      {org.isMember ? (
                        <Badge tone="success">Member</Badge>
                      ) : org.hasPendingRequest ? (
                        <Badge tone="warning">Pending</Badge>
                      ) : isSelected ? (
                        <Badge tone="info">Selected</Badge>
                      ) : (
                        <UserPlus className="mt-1 h-4 w-4 text-tc-muted" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <>
            <Field>
              <Label htmlFor="join-role">Request as</Label>
              <Select
                id="join-role"
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as "employee" | "public_user")}
              >
                <option value="employee">Employee / staff</option>
                <option value="public_user">Certificate holder</option>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="join-message">Message (optional)</Label>
              <Textarea
                id="join-message"
                rows={3}
                placeholder="Tell the admin why you need access…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
          </>
        ) : null}

        {createRequest.isError ? (
          <FormError>{getApiErrorMessage(createRequest.error)}</FormError>
        ) : null}
      </div>
    </Modal>
  );
}
