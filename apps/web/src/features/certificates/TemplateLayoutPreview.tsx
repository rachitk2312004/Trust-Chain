import { FormError, FormHint } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useTemplateLayoutPreview } from "./hooks";

export function TemplateLayoutPreview({
  organizationId,
  layout,
  enabled = true,
  title = "Preview",
  className,
}: {
  organizationId: string;
  layout: Record<string, unknown> | null;
  enabled?: boolean;
  title?: string;
  className?: string;
}) {
  const preview = useTemplateLayoutPreview(organizationId, layout, enabled);

  return (
    <div className={className ?? "flex flex-col gap-2"}>
      <p className="text-sm font-medium text-[var(--tc-fg)]">{title}</p>
      <div className="flex min-h-64 items-center justify-center rounded border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3">
        {preview.isFetching ? (
          <span className="text-sm text-[var(--tc-muted)]">Rendering preview…</span>
        ) : preview.data?.url ? (
          <img
            src={preview.data.url}
            alt="Certificate layout preview"
            className="max-h-[28rem] max-w-full object-contain"
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
      ) : (
        <FormHint>Sample recipient data. This is how the certificate will look when issued.</FormHint>
      )}
    </div>
  );
}
