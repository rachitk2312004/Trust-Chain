import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckSquare,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button, FormError, FormHint, Input, Modal } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/ui";
import {
  useAddConversationMembers,
  useConversationMessages,
  useConversations,
  useCreateConversation,
  useDeleteMessages,
  useEditMessage,
  useMarkConversationRead,
  useMessageDirectory,
  useRemoveConversationMember,
  useSendMessage,
} from "../features/messages/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { PlanGate } from "../features/billing/PlanGate";
import { formatLastSeen, formatMessageTime } from "../lib/chatTime";
import { cn } from "../lib/cn";
import { useSessionStore } from "../lib/sessionStore";
import type { ChatMember, ChatMessage } from "../types/api";

function otherMembers(members: ChatMember[], selfId?: string) {
  return members.filter((member) => member.userId !== selfId);
}

function presenceLabel(members: ChatMember[], selfId?: string, type?: string) {
  const others = otherMembers(members, selfId);
  if (type === "dm") {
    const peer = others[0] ?? members[0];
    if (!peer) return "Last online unknown";
    return formatLastSeen(peer.lastSeenAt, peer.online);
  }
  const online = others.filter((member) => member.online).length;
  if (online) return `${online} online · ${members.length} members`;
  return `${members.length} members`;
}

export function MessagesPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const selfId = useSessionStore((s) => s.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("c") ?? searchParams.get("conversation");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [draft, setDraft] = useState("");
  const [composer, setComposer] = useState<"dm" | "group" | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [pickedMessages, setPickedMessages] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const directory = useMessageDirectory(organizationId);
  const conversations = useConversations(organizationId);
  const thread = useConversationMessages(organizationId, selectedId);
  const createConversation = useCreateConversation(organizationId ?? "");
  const send = useSendMessage(organizationId ?? "", selectedId ?? "");
  const editMessage = useEditMessage(organizationId ?? "", selectedId ?? "");
  const deleteMessages = useDeleteMessages(organizationId ?? "", selectedId ?? "");
  const addMembers = useAddConversationMembers(organizationId ?? "", selectedId ?? "");
  const removeMember = useRemoveConversationMember(organizationId ?? "", selectedId ?? "");
  const markRead = useMarkConversationRead(organizationId ?? "");

  const selected = useMemo(
    () => (conversations.data ?? []).find((item) => item.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );
  const selectedRef = useRef(selected);
  if (selected) selectedRef.current = selected;
  const visible = selected ?? (selectedId ? selectedRef.current : null);
  const threadMessages = thread.data ?? [];
  const deleteTargets = threadMessages.filter((message) => deleteIds.includes(message.id));
  const canDeleteForAll =
    deleteTargets.length > 0 &&
    deleteTargets.every((message) => message.sender.userId === selfId && !message.deletedAt);

  useEffect(() => {
    if (requestedId && requestedId !== selectedId) {
      setSelectedId(requestedId);
    }
  }, [requestedId, selectedId]);

  useEffect(() => {
    if (!selectedId && !requestedId && conversations.data?.[0]) {
      setSelectedId(conversations.data[0].id);
    }
  }, [conversations.data, selectedId, requestedId]);

  useEffect(() => {
    function closeMenu() {
      setMenuId(null);
    }
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  function openConversation(id: string) {
    setSelectedId(id);
    setSearchParams({ c: id }, { replace: true });
    setEditingId(null);
    setMembersOpen(false);
    setSelecting(false);
    setPickedMessages([]);
    setMenuId(null);
    setDeleteIds([]);
  }

  useEffect(() => {
    if (selectedId && organizationId) {
      markRead.mutate(selectedId);
    }
    // Intentionally only when the open thread changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, organizationId]);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Messages" description="Talk with people in your organization." />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  function togglePick(userId: string) {
    setPickedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  function toggleMessage(messageId: string) {
    setPickedMessages((current) =>
      current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId],
    );
  }

  async function startConversation() {
    if (!composer) return;
    const conversation = await createConversation.mutateAsync({
      type: composer,
      title: composer === "group" ? groupTitle : undefined,
      memberIds: pickedIds,
    });
    openConversation(conversation.id);
    setComposer(null);
    setGroupTitle("");
    setPickedIds([]);
  }

  async function submitMessage() {
    const body = draft.trim();
    if (!body || !selectedId) return;
    setDraft("");
    try {
      await send.mutateAsync(body);
    } catch {
      setDraft(body);
    }
  }

  async function saveEdit(message: ChatMessage) {
    const body = editDraft.trim();
    if (!body || !selectedId) return;
    await editMessage.mutateAsync({ messageId: message.id, body });
    setEditingId(null);
  }

  async function confirmDelete(scope: "me" | "all") {
    if (!deleteIds.length) return;
    await deleteMessages.mutateAsync({ messageIds: deleteIds, scope });
    setDeleteIds([]);
    setSelecting(false);
    setPickedMessages([]);
    setMenuId(null);
  }

  const memberIds = new Set((visible?.members ?? []).map((member) => member.userId));
  const addable = (directory.data ?? []).filter((member) => !memberIds.has(member.userId));

  return (
    <AppShellLayout>
      <PageHeader
        title="Messages"
        description="Direct and group chat for certificate issue and verification work."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setComposer("dm");
                setPickedIds([]);
              }}
            >
              New message
            </Button>
            <Button
              onClick={() => {
                setComposer("group");
                setPickedIds([]);
              }}
            >
              New group
            </Button>
          </div>
        }
      />
      <PlanGate feature="messaging">

      {conversations.isError ? (
        <FormError>{getApiErrorMessage(conversations.error)}</FormError>
      ) : null}

      {composer ? (
        <div className="mb-4 rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-panel)] p-4">
          <p className="text-sm font-semibold text-tc-fg">
            {composer === "dm" ? "Start a direct message" : "Create a group chat"}
          </p>
          {composer === "group" ? (
            <Input
              className="mt-3"
              placeholder="Group name"
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
            />
          ) : null}
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {(directory.data ?? []).map((member) => (
              <label
                key={member.userId}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--tc-hover)]"
              >
                <input
                  type={composer === "dm" ? "radio" : "checkbox"}
                  name="chat-member"
                  checked={pickedIds.includes(member.userId)}
                  onChange={() => {
                    if (composer === "dm") setPickedIds([member.userId]);
                    else togglePick(member.userId);
                  }}
                />
                <span className="font-medium">{member.name}</span>
                <span className="text-tc-muted">{member.email}</span>
              </label>
            ))}
            {!directory.data?.length ? (
              <p className="text-sm text-tc-muted">No other staff members yet.</p>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              disabled={
                createConversation.isPending ||
                !pickedIds.length ||
                (composer === "group" && !groupTitle.trim())
              }
              onClick={() => void startConversation()}
            >
              Start chat
            </Button>
            <Button variant="ghost" onClick={() => setComposer(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-[520px] overflow-hidden rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-panel)] lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--tc-border)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--tc-border)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-tc-muted">
            Conversations
          </div>
          <ul className="max-h-[240px] overflow-y-auto lg:max-h-[620px]">
            {(conversations.data ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openConversation(item.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors",
                    selectedId === item.id ? "bg-sky-500/10" : "hover:bg-[var(--tc-hover)]",
                  )}
                >
                  <span className="mt-0.5 text-tc-muted">
                    {item.type === "group" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-tc-fg">{item.title}</span>
                      {item.unread ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-tc-muted">
                      {item.lastMessage?.deletedAt
                        ? "Message deleted"
                        : (item.lastMessage?.body ?? "No messages yet")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!conversations.data?.length ? (
            <EmptyState
              title="No conversations yet"
              description="Start a direct message or a group for issue and verify questions."
              icon={<MessageSquare className="h-6 w-6" />}
            />
          ) : null}
        </aside>

        <section className="flex min-h-[420px] flex-col">
          {selectedId && visible ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--tc-border)] px-5 py-3">
                <div>
                  <p className="font-display text-sm font-semibold">{visible.title}</p>
                  <p className="text-xs text-tc-muted">
                    {selecting
                      ? `${pickedMessages.length} selected`
                      : presenceLabel(visible.members, selfId, visible.type)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selecting ? (
                    <>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!pickedMessages.length}
                        onClick={() => setDeleteIds(pickedMessages)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelecting(false);
                          setPickedMessages([]);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelecting(true);
                        setMenuId(null);
                      }}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Select
                    </Button>
                  )}
                  {visible.type === "group" ? (
                    <Button variant="secondary" size="sm" onClick={() => setMembersOpen(true)}>
                      <UserPlus className="h-3.5 w-3.5" />
                      Members
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {threadMessages.map((message) => {
                  const mine = message.sender.userId === selfId;
                  const deleted = Boolean(message.deletedAt);
                  const checked = pickedMessages.includes(message.id);
                  return (
                    <div
                      key={message.id}
                      className={cn("group flex items-start gap-2", mine ? "justify-end" : "justify-start")}
                    >
                      {selecting ? (
                        <input
                          type="checkbox"
                          className="mt-3"
                          checked={checked}
                          onChange={() => toggleMessage(message.id)}
                        />
                      ) : null}
                      <div
                        className={cn(
                          "relative max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          mine ? "bg-emerald-600 text-white" : "bg-[var(--tc-hover)] text-tc-fg",
                          selecting && checked && "ring-2 ring-sky-400",
                        )}
                        onClick={() => {
                          if (selecting) toggleMessage(message.id);
                        }}
                      >
                        {!mine ? (
                          <p className="mb-0.5 text-[11px] font-semibold opacity-80">
                            {message.sender.name}
                          </p>
                        ) : null}
                        {editingId === message.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => void saveEdit(message)}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className={cn("whitespace-pre-wrap", deleted && "italic opacity-80")}>
                            {deleted ? "This message was deleted" : message.body}
                          </p>
                        )}
                        <p className={cn("mt-1 text-[11px]", mine ? "text-white/70" : "text-tc-muted")}>
                          {formatMessageTime(message.createdAt)}
                          {message.editedAt && !deleted ? " · edited" : ""}
                        </p>
                      </div>
                      {!selecting && !deleted && !message.id.startsWith("temp-") ? (
                        <div className="relative pt-1">
                          <button
                            type="button"
                            className="rounded-lg p-1 text-tc-muted opacity-70 hover:bg-[var(--tc-hover)] sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label="Message actions"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMenuId((current) => (current === message.id ? null : message.id));
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuId === message.id ? (
                            <div
                              className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-[var(--tc-border)] bg-[var(--tc-panel)] py-1 text-sm shadow-lg"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {mine ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--tc-hover)]"
                                  onClick={() => {
                                    setEditingId(message.id);
                                    setEditDraft(message.body);
                                    setMenuId(null);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-[var(--tc-hover)]"
                                onClick={() => {
                                  setDeleteIds([message.id]);
                                  setMenuId(null);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <form
                className="flex gap-2 border-t border-[var(--tc-border)] p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitMessage();
                }}
              >
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about an issue or verification…"
                  autoComplete="off"
                />
                <Button type="submit" disabled={!draft.trim()}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                title="Select a conversation"
                description="Choose a teammate or create a group to coordinate certificate work."
                icon={<MessageSquare className="h-6 w-6" />}
              />
            </div>
          )}
        </section>
      </div>

      <Modal
        open={deleteIds.length > 0}
        title={deleteIds.length > 1 ? `Delete ${deleteIds.length} messages` : "Delete message"}
        onClose={() => setDeleteIds([])}
      >
        <p className="text-sm text-tc-muted">
          Delete for me hides these messages only in your chat. Delete for everyone removes them for
          the whole conversation, and only works on messages you sent.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setDeleteIds([])}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            disabled={deleteMessages.isPending}
            onClick={() => void confirmDelete("me")}
          >
            Delete for me
          </Button>
          <Button
            variant="danger"
            disabled={!canDeleteForAll || deleteMessages.isPending}
            onClick={() => void confirmDelete("all")}
          >
            Delete for everyone
          </Button>
        </div>
      </Modal>

      <Modal
        open={membersOpen && visible?.type === "group"}
        title="Group members"
        onClose={() => {
          setMembersOpen(false);
          setAddIds([]);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMembersOpen(false)}>
              Done
            </Button>
            <Button
              disabled={!addIds.length || addMembers.isPending}
              onClick={async () => {
                await addMembers.mutateAsync(addIds);
                setAddIds([]);
              }}
            >
              Add selected
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {(visible?.members ?? []).map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--tc-border)] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {member.name}
                    {member.userId === selfId ? " (you)" : ""}
                  </p>
                  <p className="text-xs text-tc-muted">
                    {formatLastSeen(member.lastSeenAt, member.online)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removeMember.isPending || (visible?.members.length ?? 0) <= 1}
                  onClick={async () => {
                    const result = await removeMember.mutateAsync(member.userId);
                    if (result.left) {
                      setMembersOpen(false);
                      setSelectedId(null);
                      setSearchParams({}, { replace: true });
                    }
                  }}
                >
                  {member.userId === selfId ? "Leave" : "Remove"}
                </Button>
              </div>
            ))}
          </div>
          {addable.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-tc-muted">
                Add people
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {addable.map((member) => (
                  <label
                    key={member.userId}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--tc-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={addIds.includes(member.userId)}
                      onChange={() =>
                        setAddIds((current) =>
                          current.includes(member.userId)
                            ? current.filter((id) => id !== member.userId)
                            : [...current, member.userId],
                        )
                      }
                    />
                    <span>{member.name}</span>
                    <span className="text-tc-muted">{member.email}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-tc-muted">Everyone in your directory is already in this group.</p>
          )}
        </div>
      </Modal>
      </PlanGate>
    </AppShellLayout>
  );
}
