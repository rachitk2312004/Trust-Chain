import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Select,
  Textarea,
} from "@trustchain/ui";
import { CategorySelector } from "../../components/CategorySelector";
import { TagSelector } from "../../components/TagSelector";
import {
  useDocumentAccessPolicies,
  usePutDocumentAccessPolicies,
  useUpdateDocument,
  useUpdateDocumentExpiration,
} from "./hooks";
import { getDocumentErrorMessage } from "../../lib/docErrors";
import type { DocumentDetail, DocumentPermission } from "../../types/api";

export function DocumentMetadataEditor({
  organizationId,
  document,
}: {
  organizationId: string;
  document: DocumentDetail;
}) {
  const update = useUpdateDocument(organizationId, document.id);
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? "");
  const [categoryId, setCategoryId] = useState(document.categoryId ?? "");
  const [tagIds, setTagIds] = useState(document.tags.map((t) => t.id));
  const [status, setStatus] = useState<"draft" | "active">(
    document.status === "draft" ? "draft" : "active",
  );

  useEffect(() => {
    setTitle(document.title);
    setDescription(document.description ?? "");
    setCategoryId(document.categoryId ?? "");
    setTagIds(document.tags.map((t) => t.id));
    setStatus(document.status === "draft" ? "draft" : "active");
  }, [document]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    update.mutate({
      title: title.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      tagIds,
      status,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit metadata</CardTitle>
        <CardDescription>Title, category, tags, and status.</CardDescription>
      </CardHeader>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="doc-title">Title</Label>
          <Input id="doc-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="doc-description">Description</Label>
          <Textarea
            id="doc-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <CategorySelector
          organizationId={organizationId}
          value={categoryId}
          onChange={setCategoryId}
        />
        <TagSelector organizationId={organizationId} value={tagIds} onChange={setTagIds} />
        <Field>
          <Label htmlFor="doc-status">Status</Label>
          <Select
            id="doc-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "active")}
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>
        <FormError>{update.error ? getDocumentErrorMessage(update.error) : null}</FormError>
        {update.isSuccess ? <FormHint>Metadata saved.</FormHint> : null}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save metadata"}
        </Button>
      </form>
    </Card>
  );
}

export function DocumentExpirationEditor({
  organizationId,
  document,
}: {
  organizationId: string;
  document: DocumentDetail;
}) {
  const update = useUpdateDocumentExpiration(organizationId, document.id);
  const [expiresAt, setExpiresAt] = useState(
    document.expiresAt ? document.expiresAt.slice(0, 16) : "",
  );

  useEffect(() => {
    setExpiresAt(document.expiresAt ? document.expiresAt.slice(0, 16) : "");
  }, [document.expiresAt]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    update.mutate(expiresAt ? new Date(expiresAt).toISOString() : null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expiration</CardTitle>
        <CardDescription>Set or clear the document expiration time.</CardDescription>
      </CardHeader>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="doc-expires">Expires at</Label>
          <Input
            id="doc-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        <FormError>{update.error ? getDocumentErrorMessage(update.error) : null}</FormError>
        {update.isSuccess ? <FormHint>Expiration updated.</FormHint> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save expiration"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={update.isPending || !document.expiresAt}
            onClick={() => update.mutate(null)}
          >
            Clear
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function DocumentAccessPolicyEditor({
  organizationId,
  documentId,
}: {
  organizationId: string;
  documentId: string;
}) {
  const policies = useDocumentAccessPolicies(organizationId, documentId);
  const put = usePutDocumentAccessPolicies(organizationId, documentId);
  const [subjectType, setSubjectType] = useState<"user" | "role" | "organization">("role");
  const [subjectId, setSubjectId] = useState("employee");
  const [permission, setPermission] = useState<DocumentPermission>("view");

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const next = [
      ...(policies.data ?? []).map((p) => ({
        subjectType: p.subjectType,
        subjectId: p.subjectId,
        permission: p.permission,
      })),
      { subjectType, subjectId: subjectId.trim(), permission },
    ];
    put.mutate(next);
  }

  function onRemove(index: number) {
    const next = (policies.data ?? [])
      .filter((_, i) => i !== index)
      .map((p) => ({
        subjectType: p.subjectType,
        subjectId: p.subjectId,
        permission: p.permission,
      }));
    put.mutate(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access policies</CardTitle>
        <CardDescription>Role, user, or organization subjects with a permission level.</CardDescription>
      </CardHeader>
      <ul className="mb-3 space-y-2 text-sm">
        {(policies.data ?? []).map((policy, index) => (
          <li
            key={policy.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--tc-border)] px-3 py-2"
          >
            <span>
              {policy.subjectType}:{policy.subjectId} → {policy.permission}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onRemove(index)} disabled={put.isPending}>
              Remove
            </Button>
          </li>
        ))}
        {(policies.data ?? []).length === 0 && !policies.isLoading ? (
          <li className="text-[var(--tc-muted)]">No custom policies.</li>
        ) : null}
      </ul>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={onAdd}>
        <Field>
          <Label htmlFor="policy-type">Subject type</Label>
          <Select
            id="policy-type"
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value as typeof subjectType)}
          >
            <option value="role">Role</option>
            <option value="user">User</option>
            <option value="organization">Organization</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="policy-subject">
            {subjectType === "role" ? "Role key" : subjectType === "user" ? "User email / id" : "Org id"}
          </Label>
          <Input
            id="policy-subject"
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            placeholder={subjectType === "role" ? "employee" : "Identifier"}
          />
        </Field>
        <Field>
          <Label htmlFor="policy-perm">Permission</Label>
          <Select
            id="policy-perm"
            value={permission}
            onChange={(e) => setPermission(e.target.value as DocumentPermission)}
          >
            <option value="view">View</option>
            <option value="download">Download</option>
            <option value="edit">Edit</option>
            <option value="manage">Manage</option>
          </Select>
        </Field>
        <div className="sm:col-span-3">
          <FormError>{put.error ? getDocumentErrorMessage(put.error) : null}</FormError>
          <Button type="submit" disabled={put.isPending}>
            {put.isPending ? "Saving…" : "Add policy"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
