import { useEffect, useState } from "react";
import { Button, FormError, Input, Label } from "@trustchain/ui";
import { EmptyState } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { cn } from "../../lib/cn";
import { useSessionStore } from "../../lib/sessionStore";
import {
  useBug,
  useBugImage,
  useBugs,
  useCommentOnBug,
  useCreateBug,
  useRespondToBug,
} from "./hooks";
import { BUG_STATUS_LABEL, BUG_STATUSES, formatSupportTime, personLabel } from "./labels";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

async function fileToPayload(file: File) {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Screenshot must be PNG, JPEG, WebP, or GIF.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Screenshot must be 2 MB or smaller.");
  }
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read screenshot."));
    reader.readAsDataURL(file);
  });
  return {
    imageBase64,
    imageContentType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  };
}

export function BugInbox({
  isSuperAdmin,
  canCreate,
  organizationId,
}: {
  isSuperAdmin: boolean;
  canCreate: boolean;
  organizationId?: string | null;
}) {
  const selfId = useSessionStore((s) => s.user?.id);
  const list = useBugs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("acknowledged");
  const bug = useBug(selectedId);
  const imageUrl = useBugImage(selectedId, Boolean(bug.data?.hasImage));
  const create = useCreateBug();
  const respond = useRespondToBug(selectedId);
  const comment = useCommentOnBug(selectedId);

  useEffect(() => {
    if (selectedId || composing) return;
    const first = list.data?.[0]?.id;
    if (first) setSelectedId(first);
  }, [composing, list.data, selectedId]);

  useEffect(() => {
    if (bug.data?.status) setStatus(bug.data.status === "open" ? "acknowledged" : bug.data.status);
  }, [bug.data?.status]);

  const selected = bug.data ?? list.data?.find((row) => row.id === selectedId);

  return (
    <div className="grid min-h-[32rem] overflow-hidden rounded-2xl border border-tc-border bg-tc-surface lg:grid-cols-[20rem_1fr]">
      <aside className="border-b border-tc-border lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-tc-border px-4 py-3">
          <p className="text-sm font-semibold">{isSuperAdmin ? "Incoming reports" : "Your reports"}</p>
          {canCreate ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setComposing(true);
                setSelectedId(null);
              }}
            >
              Report
            </Button>
          ) : null}
        </div>
        {list.isError ? (
          <div className="m-3">
            <FormError>{getApiErrorMessage(list.error)}</FormError>
          </div>
        ) : null}
        {list.isLoading ? <p className="px-4 py-6 text-sm text-tc-muted">Loading reports…</p> : null}
        {!list.isLoading && !list.data?.length ? (
          <EmptyState
            className="m-3 py-8"
            title="No bug reports"
            description={isSuperAdmin ? "Reports from workspace users will appear here." : "File a report if something is broken."}
          />
        ) : (
          <ul className="max-h-[28rem] overflow-y-auto">
            {(list.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setSelectedId(row.id);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-tc-border px-4 py-3 text-left",
                    selectedId === row.id && !composing ? "bg-rose-500/10" : "hover:bg-tc-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{row.title}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-tc-muted">
                      {BUG_STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-tc-muted">
                    {row.lastResponse?.body || personLabel(row.reporter)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="flex min-h-[28rem] flex-col">
        {composing && canCreate ? (
          <form
            className="flex flex-1 flex-col gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              void (async () => {
                try {
                  const image = imageFile ? await fileToPayload(imageFile) : {};
                  const created = await create.mutateAsync({
                    title,
                    description,
                    ...(organizationId ? { organizationId } : {}),
                    ...image,
                  });
                  setTitle("");
                  setDescription("");
                  setImageFile(null);
                  setComposing(false);
                  setSelectedId(created.id);
                } catch (error) {
                  setFormError(error instanceof Error ? error.message : getApiErrorMessage(error));
                }
              })();
            }}
          >
            <div>
              <Label htmlFor="bug-title">Title</Label>
              <Input
                id="bug-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What went wrong?"
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="bug-description">Description</Label>
              <textarea
                id="bug-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={8}
                className="mt-1 min-h-[10rem] w-full rounded-xl border border-tc-border bg-tc-canvas px-3 py-2 text-sm"
                placeholder="Steps to reproduce, expected result, and what you saw instead."
              />
            </div>
            <div>
              <Label htmlFor="bug-image">Screenshot (optional)</Label>
              <input
                id="bug-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 block w-full text-sm"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </div>
            {formError ? <FormError>{formError}</FormError> : null}
            {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </form>
        ) : selected ? (
          <>
            <div className="border-b border-tc-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.title}</h2>
                  <p className="text-xs text-tc-muted">
                    {personLabel("reporter" in selected ? selected.reporter : bug.data?.reporter)}
                    {selected.organizationName ? ` · ${selected.organizationName}` : ""}
                    {` · ${formatSupportTime(selected.createdAt)}`}
                  </p>
                </div>
                <span className="rounded-full bg-tc-surface-2 px-2.5 py-1 text-xs text-tc-muted">
                  {BUG_STATUS_LABEL[selected.status] ?? selected.status}
                </span>
              </div>
              {bug.data?.description ? (
                <p className="mt-3 whitespace-pre-wrap text-sm">{bug.data.description}</p>
              ) : null}
              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
                  <img
                    src={imageUrl}
                    alt="Bug screenshot"
                    className="max-h-64 rounded-xl border border-tc-border object-contain"
                  />
                </a>
              ) : bug.data?.hasImage ? (
                <p className="mt-3 text-xs text-tc-muted">Loading screenshot…</p>
              ) : null}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {bug.isLoading ? <p className="text-sm text-tc-muted">Loading updates…</p> : null}
              {(bug.data?.responses ?? []).map((response) => {
                const mine = response.actor.id === selfId;
                return (
                  <div key={response.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-rose-500/10" : "bg-tc-surface-2",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{response.body}</p>
                      <p className="mt-1 text-[11px] text-tc-muted">
                        {personLabel(response.actor)}
                        {response.statusAfter
                          ? ` · ${BUG_STATUS_LABEL[response.statusAfter] ?? response.statusAfter}`
                          : ""}
                        {` · ${formatSupportTime(response.createdAt)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!bug.isLoading && !bug.data?.responses.length ? (
                <p className="text-sm text-tc-muted">
                  {isSuperAdmin ? "No response yet. Acknowledge or reply below." : "Waiting for a platform response."}
                </p>
              ) : null}
            </div>
            <form
              className="border-t border-tc-border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const text = reply.trim();
                if (!text) return;
                setReply("");
                if (isSuperAdmin) {
                  respond.mutate({ body: text, status }, { onError: () => setReply(text) });
                } else {
                  comment.mutate(text, { onError: () => setReply(text) });
                }
              }}
            >
              {respond.isError ? (
                <div className="mb-2">
                  <FormError>{getApiErrorMessage(respond.error)}</FormError>
                </div>
              ) : null}
              {comment.isError ? (
                <div className="mb-2">
                  <FormError>{getApiErrorMessage(comment.error)}</FormError>
                </div>
              ) : null}
              {isSuperAdmin ? (
                <div className="mb-2">
                  <Label htmlFor="bug-status">Set status</Label>
                  <select
                    id="bug-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-tc-border bg-tc-canvas px-3 py-2 text-sm"
                  >
                    {BUG_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {BUG_STATUS_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={2}
                  className="min-h-[2.75rem] flex-1 rounded-xl border border-tc-border bg-tc-canvas px-3 py-2 text-sm"
                  placeholder={isSuperAdmin ? "Acknowledge or explain the fix" : "Add a follow-up"}
                />
                <Button type="submit" disabled={!reply.trim() || respond.isPending || comment.isPending}>
                  {isSuperAdmin ? "Respond" : "Follow up"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState title="Select a report" description="Choose a bug report to review." />
          </div>
        )}
      </section>
    </div>
  );
}
