import { FormError, FormHint } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useCertificatePreview } from "./hooks";

export function CertificatePreview({
  organizationId,
  certificateId,
  publicId,
  enabled = true,
}: {
  organizationId: string;
  certificateId: string;
  publicId?: string;
  enabled?: boolean;
}) {
  const preview = useCertificatePreview(organizationId, certificateId, enabled);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-72 items-center justify-center rounded bg-[var(--tc-surface-2)] p-4">
        {preview.isLoading ? (
          <span className="text-sm text-[var(--tc-muted)]">Rendering preview…</span>
        ) : preview.data?.url ? (
          <img
            src={preview.data.url}
            alt={publicId ? `Certificate ${publicId}` : "Certificate preview"}
            className="max-h-[28rem] max-w-full object-contain shadow-sm"
          />
        ) : (
          <span className="text-sm text-[var(--tc-muted)]">Preview unavailable</span>
        )}
      </div>
      {preview.data?.warnings?.length ? (
        <FormHint>Warnings: {preview.data.warnings.join("; ")}</FormHint>
      ) : null}
      {preview.isError ? (
        <FormError>{getCertificateErrorMessage(preview.error)}</FormError>
      ) : null}
    </div>
  );
}
