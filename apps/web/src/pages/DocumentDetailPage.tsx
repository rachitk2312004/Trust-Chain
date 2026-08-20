import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { DocumentArchiveDialog } from "../features/documents/DocumentArchiveDialog";
import {
  DocumentAccessPolicyEditor,
  DocumentExpirationEditor,
  DocumentMetadataEditor,
} from "../features/documents/DocumentEditors";
import { DocumentShareDialog } from "../features/documents/DocumentShareDialog";
import { DocumentUploadDialog } from "../features/documents/DocumentUploadDialog";
import {
  useDocument,
  useDownloadDocument,
  useRestoreDocument,
} from "../features/documents/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import { getDocumentErrorMessage } from "../lib/docErrors";
import { useSessionStore } from "../lib/sessionStore";

export function DocumentDetailPage() {
  const { documentId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const doc = useDocument(organizationId, documentId);
  const restore = useRestoreDocument(organizationId ?? "");
  const download = useDownloadDocument(organizationId ?? "");
  const feedback = useFeedback();
  const perms = usePermissions(organizationId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (!organizationId) {
    return <FormError>Select an organization first.</FormError>;
  }

  if (doc.isError) {
    return <FormError>{getDocumentErrorMessage(doc.error)}</FormError>;
  }

  if (doc.isLoading || !doc.data) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading document…</p>;
  }

  const document = doc.data;
  const version = document.currentVersion;
  const permission = document.permission as "view" | "download" | "edit" | "manage" | undefined;
  const canEdit = perms.canDocument(permission, "edit");
  const canDownload = perms.canDocument(permission, "download");
  const canShare = perms.can("documents.share") && perms.canDocument(permission, "share");
  const canArchive = perms.can("documents.archive") && perms.canDocument(permission, "archive");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Current document fields</CardDescription>
        </CardHeader>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-[var(--tc-muted)]">Status</dt>
          <dd>
            <Badge>{document.status}</Badge>
          </dd>
          <dt className="text-[var(--tc-muted)]">Description</dt>
          <dd>{document.description || "—"}</dd>
          <dt className="text-[var(--tc-muted)]">Category</dt>
          <dd>{document.category?.name ?? "—"}</dd>
          <dt className="text-[var(--tc-muted)]">Tags</dt>
          <dd>
            {document.tags.length ? document.tags.map((t) => t.name).join(", ") : "—"}
          </dd>
          <dt className="text-[var(--tc-muted)]">Expires</dt>
          <dd>{document.expiresAt ? new Date(document.expiresAt).toLocaleString() : "—"}</dd>
          <dt className="text-[var(--tc-muted)]">Archived</dt>
          <dd>{document.archivedAt ? new Date(document.archivedAt).toLocaleString() : "—"}</dd>
          <dt className="text-[var(--tc-muted)]">Permission</dt>
          <dd>{document.permission ?? "—"}</dd>
          <dt className="text-[var(--tc-muted)]">Updated</dt>
          <dd>{new Date(document.updatedAt).toLocaleString()}</dd>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current version</CardTitle>
          <CardDescription>Integrity and file metadata</CardDescription>
        </CardHeader>
        {version ? (
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--tc-muted)]">Version</dt>
            <dd>v{version.versionNumber}</dd>
            <dt className="text-[var(--tc-muted)]">File</dt>
            <dd className="break-all">{version.originalFileName}</dd>
            <dt className="text-[var(--tc-muted)]">MIME</dt>
            <dd>{version.mimeType}</dd>
            <dt className="text-[var(--tc-muted)]">Size</dt>
            <dd>{version.sizeBytes.toLocaleString()} bytes</dd>
            <dt className="text-[var(--tc-muted)]">SHA-256</dt>
            <dd className="break-all font-mono text-xs">{version.contentHash}</dd>
            <dt className="text-[var(--tc-muted)]">Created</dt>
            <dd>{new Date(version.createdAt).toLocaleString()}</dd>
          </dl>
        ) : (
          <FormHint>No version yet. Upload a file to complete this document.</FormHint>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 lg:col-span-2">
        <Can capability="documents.upload" organizationId={organizationId}>
          {canEdit ? <Button onClick={() => setUploadOpen(true)}>Upload version</Button> : null}
        </Can>
        {canDownload && version ? (
          <Button
            variant="secondary"
            disabled={download.isPending}
            onClick={() =>
              download.mutate(
                {
                  documentId,
                  fileName: version.originalFileName || `${document.title}.bin`,
                },
                {
                  onSuccess: () => feedback.success("Download started"),
                  onError: (err) => feedback.error(err, "Download failed"),
                },
              )
            }
          >
            {download.isPending ? "Downloading…" : "Download"}
          </Button>
        ) : null}
        {canShare ? (
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            Share
          </Button>
        ) : null}
        {canArchive ? (
          document.status === "archived" ? (
            <Button
              variant="secondary"
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate(documentId, {
                  onSuccess: () => feedback.success("Document restored"),
                  onError: (err) => feedback.error(err, "Restore failed"),
                })
              }
            >
              {restore.isPending ? "Restoring…" : "Restore"}
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setArchiveOpen(true)}>
              Archive
            </Button>
          )
        ) : null}
        <Link
          to={`/documents/${documentId}/versions`}
          className="inline-flex h-10 items-center text-sm text-[var(--tc-accent)] hover:underline"
        >
          Versions
        </Link>
        <Link
          to={`/documents/${documentId}/share`}
          className="inline-flex h-10 items-center text-sm text-[var(--tc-accent)] hover:underline"
        >
          Shares
        </Link>
        <Link
          to={`/documents/${documentId}/history`}
          className="inline-flex h-10 items-center text-sm text-[var(--tc-accent)] hover:underline"
        >
          History
        </Link>
      </div>

      {canEdit ? (
        <>
          <DocumentMetadataEditor organizationId={organizationId} document={document} />
          <DocumentExpirationEditor organizationId={organizationId} document={document} />
          <div className="lg:col-span-2">
            <DocumentAccessPolicyEditor
              organizationId={organizationId}
              documentId={documentId}
            />
          </div>
        </>
      ) : null}

      <DocumentUploadDialog
        organizationId={organizationId}
        documentId={documentId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => feedback.success("Upload complete")}
      />
      <DocumentShareDialog
        organizationId={organizationId}
        documentId={documentId}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={() => feedback.success("Share created")}
      />
      <DocumentArchiveDialog
        organizationId={organizationId}
        documentId={documentId}
        title={document.title}
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onArchived={() => feedback.success("Document archived")}
      />
    </div>
  );
}
