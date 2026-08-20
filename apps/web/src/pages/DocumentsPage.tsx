import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  FormError,
  FormHint,
  Input,
  Select,
  TD,
  TH,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { CategorySelector } from "../components/CategorySelector";
import { PageHeader } from "../components/PageHeader";
import { VirtualizedTable } from "../components/VirtualizedTable";
import { DocumentUploadDialog } from "../features/documents/DocumentUploadDialog";
import { useDocuments, useSearchDocuments } from "../features/documents/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getDocumentErrorMessage } from "../lib/docErrors";
import { useSessionStore } from "../lib/sessionStore";

const PAGE_SIZE = 50;

const statusTone: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending_upload: "warning",
  draft: "info",
  active: "success",
  archived: "neutral",
  expired: "danger",
};

export function DocumentsPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const feedback = useFeedback();
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);

  const listParams = useMemo(
    () => ({
      status: status || undefined,
      categoryId: categoryId || undefined,
      q: query || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [status, categoryId, query, offset],
  );

  const documents = useDocuments(organizationId, listParams);
  const search = useSearchDocuments(organizationId, searchInput, searchInput.trim().length >= 2);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Documents" description="Organization-scoped document workspace." />
        <FormHint>
          Select an organization in the switcher, or{" "}
          <Link to="/organizations" className="text-[var(--tc-accent)] hover:underline">
            create one
          </Link>
          .
        </FormHint>
      </AppShellLayout>
    );
  }

  const rows = documents.data?.documents ?? [];
  const canPrev = offset > 0;
  const canNext = rows.length >= PAGE_SIZE;
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <AppShellLayout>
      <PageHeader
        title="Documents"
        description="List, search, and upload documents for the active organization."
        actions={
          <Can capability="documents.upload" organizationId={organizationId}>
            <Button onClick={() => setUploadOpen(true)}>Upload</Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Input
            placeholder="Filter list (title, description, tags)…"
            value={query}
            onChange={(e) => {
              setOffset(0);
              setQuery(e.target.value);
            }}
            aria-label="Filter documents"
          />
        </div>
        <Select
          className="w-40"
          value={status}
          onChange={(e) => {
            setOffset(0);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="pending_upload">Pending upload</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="expired">Expired</option>
        </Select>
        <div className="min-w-[12rem]">
          <CategorySelector
            organizationId={organizationId}
            value={categoryId}
            onChange={(id) => {
              setOffset(0);
              setCategoryId(id);
            }}
            allowCreate={false}
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Input
            placeholder="Dedicated search…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search documents"
          />
        </div>
      </div>

      {searchInput.trim().length >= 2 && search.data ? (
        <div className="mb-4 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--tc-muted)]">
            Search results ({search.data.documents.length})
          </p>
          <ul className="space-y-1 text-sm">
            {search.data.documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  to={`/documents/${doc.id}`}
                  className="text-[var(--tc-accent)] hover:underline"
                >
                  {doc.title}
                </Link>{" "}
                <span className="text-[var(--tc-muted)]">· {doc.status}</span>
              </li>
            ))}
          </ul>
          {search.data.documents.length === 0 ? (
            <FormHint>No documents matched that search.</FormHint>
          ) : null}
        </div>
      ) : null}

      {documents.isError ? (
        <FormError>{getDocumentErrorMessage(documents.error)}</FormError>
      ) : null}

      {documents.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading documents…</p>
      ) : (
        <VirtualizedTable
          rows={rows}
          getRowKey={(doc) => doc.id}
          header={
            <>
              <TH>Title</TH>
              <TH>Status</TH>
              <TH>Version</TH>
              <TH>Updated</TH>
            </>
          }
          empty={<FormHint>No documents yet. Upload one to get started.</FormHint>}
          renderRow={(doc) => (
            <>
              <TD>
                <Link
                  to={`/documents/${doc.id}`}
                  className="font-medium text-[var(--tc-accent)] hover:underline"
                >
                  {doc.title}
                </Link>
                {doc.category ? (
                  <div className="text-xs text-[var(--tc-muted)]">{doc.category.name}</div>
                ) : null}
              </TD>
              <TD>
                <Badge tone={statusTone[doc.status] ?? "neutral"}>{doc.status}</Badge>
              </TD>
              <TD>{doc.currentVersion ? `v${doc.currentVersion.versionNumber}` : "—"}</TD>
              <TD>{new Date(doc.updatedAt).toLocaleString()}</TD>
            </>
          )}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!canPrev || documents.isFetching}
          onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canNext || documents.isFetching}
          onClick={() => setOffset((v) => v + PAGE_SIZE)}
        >
          Next
        </Button>
        <span className="text-xs text-[var(--tc-muted)]">
          Page {page} · showing {rows.length} (limit {PAGE_SIZE})
        </span>
      </div>

      <DocumentUploadDialog
        organizationId={organizationId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(id) => {
          feedback.success("Document uploaded");
          navigate(`/documents/${id}`);
        }}
      />
    </AppShellLayout>
  );
}
