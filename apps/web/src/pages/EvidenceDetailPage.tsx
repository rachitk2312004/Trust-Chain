import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, FormError, FormHint, Input, Label, Textarea } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import {
  EvidenceLinkDialog,
  EvidenceVersionPanel,
  useEvidenceDetail,
  useLinkEvidence,
  usePatchEvidence,
} from "../features/evidence";

export function EvidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const detail = useEvidenceDetail(id, canManage);
  const link = useLinkEvidence();
  const patch = usePatchEvidence();
  const [linkOpen, setLinkOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [newContent, setNewContent] = useState("");
  const [tags, setTags] = useState("");
  const [frameworks, setFrameworks] = useState("");

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Evidence" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  if (detail.isLoading) {
    return (
      <AppShellLayout>
        <PageHeader title="Evidence" />
        <p className="text-sm text-[var(--tc-muted)]">Loading…</p>
      </AppShellLayout>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <AppShellLayout>
        <PageHeader title="Evidence" />
        <FormError>{getApiErrorMessage(detail.error)}</FormError>
      </AppShellLayout>
    );
  }

  const { evidence, versions, links, custody, chainValid } = detail.data;

  return (
    <AppShellLayout>
      <PageHeader
        title={evidence.title}
        description={`${evidence.publicCode} · v${evidence.currentVersion}`}
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(true)}>
              Link
            </Button>
            <Link to="/evidence" className="text-sm text-[var(--tc-accent)] hover:underline">
              Back
            </Link>
          </div>
        }
      />

      {link.isError ? <FormError>{getApiErrorMessage(link.error)}</FormError> : null}
      {patch.isError ? <FormError>{getApiErrorMessage(patch.error)}</FormError> : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={evidence.status === "validated" ? "success" : "neutral"}>
          {evidence.status}
        </Badge>
        <Badge tone={chainValid ? "success" : "danger"}>
          custody {chainValid ? "intact" : "broken"}
        </Badge>
        {evidence.frameworks.map((fw) => (
          <Badge key={fw} tone="neutral">
            {fw}
          </Badge>
        ))}
      </div>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <p className="text-[var(--tc-muted)]">{evidence.description || "No description."}</p>
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Checksum</div>
            <div className="mt-1 break-all font-mono text-xs">{evidence.checksumSha256}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Tags</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {evidence.tags.length
                ? evidence.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">File</div>
            <p className="mt-1 text-xs">
              {evidence.fileName ?? "—"} · {evidence.sizeBytes} bytes · {evidence.mimeType ?? "—"}
            </p>
          </div>
        </div>

        <form
          className="space-y-3 rounded border border-[var(--tc-border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!id) return;
            patch.mutate({
              id,
              body: {
                contentText: newContent || undefined,
                changeNote: changeNote || undefined,
                tags: tags
                  ? tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                  : undefined,
                frameworks: frameworks
                  ? frameworks
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                  : undefined,
              },
            });
            setNewContent("");
            setChangeNote("");
          }}
        >
          <h2 className="text-sm font-semibold">Update / version</h2>
          <div>
            <Label htmlFor="ev-new-content">New content (creates version)</Label>
            <Textarea
              id="ev-new-content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="ev-note">Change note</Label>
            <Input id="ev-note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ev-tags-edit">Tags</Label>
            <Input
              id="ev-tags-edit"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={evidence.tags.join(", ")}
            />
          </div>
          <div>
            <Label htmlFor="ev-fw-edit">Frameworks</Label>
            <Input
              id="ev-fw-edit"
              value={frameworks}
              onChange={(e) => setFrameworks(e.target.value)}
              placeholder={evidence.frameworks.join(", ")}
            />
          </div>
          <Button type="submit" disabled={patch.isPending}>
            {patch.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </section>

      <section className="mb-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Versions
          </h2>
          <EvidenceVersionPanel versions={versions} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Links
          </h2>
          {links.length === 0 ? (
            <FormHint>No linked targets.</FormHint>
          ) : (
            <ul className="space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.id} className="rounded border border-[var(--tc-border)] px-3 py-2">
                  <span className="font-mono text-xs">{l.targetType}</span> → {l.targetId}
                  {l.label ? <span className="text-[var(--tc-muted)]"> · {l.label}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Chain of custody
        </h2>
        <ol className="space-y-2">
          {custody.map((c) => (
            <li key={c.id} className="rounded border border-[var(--tc-border)] px-3 py-2 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{c.action}</Badge>
                <span className="text-[var(--tc-muted)]">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 break-all font-mono text-[10px] text-[var(--tc-muted)]">
                {c.integrityHash}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <EvidenceLinkDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        pending={link.isPending}
        onLink={(input) => {
          if (!id) return;
          link.mutate(
            { id, ...input },
            {
              onSuccess: () => setLinkOpen(false),
            },
          );
        }}
      />
    </AppShellLayout>
  );
}
