import { useState, type FormEvent } from "react";
import { Button, Field, FormError, FormHint, Input, Label, Modal, Select } from "@trustchain/ui";
import { useShareDocument } from "./hooks";
import { getDocumentErrorMessage } from "../../lib/docErrors";
import type { DocumentPermission } from "../../types/api";

export function DocumentShareDialog({
  organizationId,
  documentId,
  open,
  onClose,
  onShared,
}: {
  organizationId: string;
  documentId: string;
  open: boolean;
  onClose: () => void;
  onShared?: () => void;
}) {
  const share = useShareDocument(organizationId, documentId);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<DocumentPermission>("view");
  const [expiresAt, setExpiresAt] = useState("");

  function handleClose() {
    setEmail("");
    setPermission("view");
    setExpiresAt("");
    share.reset();
    onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    share.mutate(
      {
        sharedWithEmail: email.trim(),
        permission,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
      {
        onSuccess: () => {
          handleClose();
          onShared?.();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title="Share document"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="doc-share-form" disabled={share.isPending}>
            {share.isPending ? "Sharing…" : "Share"}
          </Button>
        </>
      }
    >
      <form id="doc-share-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="share-email">Recipient email</Label>
          <Input
            id="share-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="share-permission">Permission</Label>
          <Select
            id="share-permission"
            value={permission}
            onChange={(e) => setPermission(e.target.value as DocumentPermission)}
          >
            <option value="view">View</option>
            <option value="download">Download</option>
            <option value="edit">Edit</option>
            <option value="manage">Manage</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="share-expires">Expires (optional)</Label>
          <Input
            id="share-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <FormHint>Leave empty for no expiration.</FormHint>
        </Field>
        <FormError>{share.error ? getDocumentErrorMessage(share.error) : null}</FormError>
      </form>
    </Modal>
  );
}
