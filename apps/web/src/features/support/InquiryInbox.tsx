import { useEffect, useMemo, useState } from "react";
import { Button, FormError, Input, Label } from "@trustchain/ui";
import { EmptyState } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { cn } from "../../lib/cn";
import { useSessionStore } from "../../lib/sessionStore";
import {
  useCloseInquiry,
  useCreateInquiry,
  useInquiries,
  useInquiry,
  useReplyInquiry,
} from "./hooks";
import { formatSupportTime, INQUIRY_STATUS_LABEL, personLabel } from "./labels";

export function InquiryInbox({
  canCreate,
  organizationId,
}: {
  canCreate: boolean;
  organizationId?: string | null;
}) {
  const selfId = useSessionStore((s) => s.user?.id);
  const list = useInquiries();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const inquiry = useInquiry(selectedId);
  const create = useCreateInquiry();
  const send = useReplyInquiry(selectedId);
  const close = useCloseInquiry();

  useEffect(() => {
    if (selectedId || composing) return;
    const first = list.data?.[0]?.id;
    if (first) setSelectedId(first);
  }, [composing, list.data, selectedId]);

  const selected = inquiry.data ?? list.data?.find((row) => row.id === selectedId);
  const statusLabel = selected ? INQUIRY_STATUS_LABEL[selected.status] ?? selected.status : "";

  const composerError = useMemo(
    () => (create.isError ? getApiErrorMessage(create.error) : send.isError ? getApiErrorMessage(send.error) : null),
    [create.error, create.isError, send.error, send.isError],
  );

  return (
    <div className="grid min-h-[32rem] overflow-hidden rounded-2xl border border-tc-border bg-tc-surface lg:grid-cols-[20rem_1fr]">
      <aside className="border-b border-tc-border lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-tc-border px-4 py-3">
          <p className="text-sm font-semibold">Queries</p>
          {canCreate ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setComposing(true);
                setSelectedId(null);
              }}
            >
              New
            </Button>
          ) : null}
        </div>
        {list.isError ? (
          <div className="m-3">
            <FormError>{getApiErrorMessage(list.error)}</FormError>
          </div>
        ) : null}
        {list.isLoading ? <p className="px-4 py-6 text-sm text-tc-muted">Loading queries…</p> : null}
        {!list.isLoading && !list.data?.length ? (
          <EmptyState
            className="m-3 py-8"
            title="No queries yet"
            description="Organization admins can send a question to platform administration."
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
                    selectedId === row.id && !composing ? "bg-amber-500/10" : "hover:bg-tc-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{row.subject}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-tc-muted">
                      {INQUIRY_STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-tc-muted">{row.preview || personLabel(row.createdBy)}</p>
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
              create.mutate(
                {
                  subject,
                  body,
                  ...(organizationId ? { organizationId } : {}),
                },
                {
                  onSuccess: (created) => {
                    setSubject("");
                    setBody("");
                    setComposing(false);
                    setSelectedId(created.id);
                  },
                },
              );
            }}
          >
            <div>
              <Label htmlFor="inquiry-subject">Subject</Label>
              <Input
                id="inquiry-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ask platform administration"
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="inquiry-body">Message</Label>
              <textarea
                id="inquiry-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                className="mt-1 min-h-[12rem] w-full rounded-xl border border-tc-border bg-tc-canvas px-3 py-2 text-sm"
                placeholder="What do you need help with?"
              />
            </div>
            {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Sending…" : "Send query"}
              </Button>
            </div>
          </form>
        ) : selected ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-tc-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <p className="text-xs text-tc-muted">
                  {selected.organizationName ? `${selected.organizationName} · ` : ""}
                  {personLabel("createdBy" in selected ? selected.createdBy : inquiry.data?.createdBy)}
                  {selected.lastMessageAt || selected.createdAt
                    ? ` · ${formatSupportTime(selected.lastMessageAt ?? selected.createdAt)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-tc-surface-2 px-2.5 py-1 text-xs text-tc-muted">{statusLabel}</span>
                {selected.status !== "closed" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={close.isPending}
                    onClick={() => close.mutate(selected.id)}
                  >
                    Close
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {inquiry.isLoading ? <p className="text-sm text-tc-muted">Loading thread…</p> : null}
              {(inquiry.data?.messages ?? []).map((message) => {
                const mine = message.sender.id === selfId;
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-amber-500/15 text-tc-fg" : "bg-tc-surface-2 text-tc-fg",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className="mt-1 text-[11px] text-tc-muted">
                        {personLabel(message.sender)} · {formatSupportTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              className="border-t border-tc-border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const text = reply.trim();
                if (!text) return;
                setReply("");
                send.mutate(text, { onError: () => setReply(text) });
              }}
            >
              {composerError ? (
                <div className="mb-2">
                  <FormError>{composerError}</FormError>
                </div>
              ) : null}
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={2}
                  className="min-h-[2.75rem] flex-1 rounded-xl border border-tc-border bg-tc-canvas px-3 py-2 text-sm"
                  placeholder="Write a reply"
                />
                <Button type="submit" disabled={send.isPending || !reply.trim()}>
                  Reply
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState title="Select a query" description="Choose a thread or start a new one." />
          </div>
        )}
      </section>
    </div>
  );
}
