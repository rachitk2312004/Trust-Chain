import { Button, FormError, Modal } from "@trustchain/ui";
import { useArchiveDocument } from "./hooks";
import { getDocumentErrorMessage } from "../../lib/docErrors";

export function DocumentArchiveDialog({
  organizationId,
  documentId,
  title,
  open,
  onClose,
  onArchived,
}: {
  organizationId: string;
  documentId: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onArchived?: () => void;
}) {
  const archive = useArchiveDocument(organizationId);

  return (
    <Modal
      open={open}
      title="Archive document"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={archive.isPending}
            onClick={() =>
              archive.mutate(documentId, {
                onSuccess: () => {
                  onClose();
                  onArchived?.();
                },
              })
            }
          >
            {archive.isPending ? "Archiving…" : "Archive"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--tc-fg)]">
        Archive <strong>{title}</strong>? Archived documents cannot receive new uploads until
        restored.
      </p>
      <FormError>{archive.error ? getDocumentErrorMessage(archive.error) : null}</FormError>
    </Modal>
  );
}
