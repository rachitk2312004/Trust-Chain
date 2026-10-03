import { useDeferredValue } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useTemplateLayoutPreview } from "./hooks";

function friendlyWarning(code: string): string {
  switch (code) {
    case "missing_logo":
      return "Organization logo not set yet — upload it in Settings → Branding";
    case "missing_logo_asset":
      return "Stored logo could not be loaded from storage";
    case "logo_convert_failed":
      return "Logo file could not be converted for the certificate";
    case "missing_signature":
      return "Signature image not set yet";
    case "missing_background":
      return "Custom background not set";
    case "missing_qr":
      return "QR preview unavailable";
    default:
      return code.replace(/_/g, " ");
  }
}

export function TemplateLayoutPreview({
  organizationId,
  layout,
  enabled = true,
  title = "Preview",
  subtitle,
  className,
  compact = false,
  certificateTitle,
  recipientName,
}: {
  organizationId: string;
  layout: Record<string, unknown> | null;
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
  /** Live form title — updates preview as the user types. */
  certificateTitle?: string;
  /** Live form recipient — updates preview as the user types. */
  recipientName?: string;
}) {
  const deferredTitle = useDeferredValue(certificateTitle);
  const deferredRecipient = useDeferredValue(recipientName);
  const preview = useTemplateLayoutPreview(
    organizationId,
    layout,
    enabled,
    deferredTitle,
    deferredRecipient,
  );
  const warnings = preview.data?.warnings ?? [];

  return (
    <div className={className ?? "flex flex-col gap-3"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--tc-fg)]">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--tc-muted)]">{subtitle}</p> : null}
        </div>
        {preview.isFetching ? (
          <span className="rounded-full bg-[var(--tc-surface-2)] px-2 py-0.5 text-[11px] text-[var(--tc-muted)]">
            Updating…
          </span>
        ) : null}
      </div>

      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-[var(--tc-border)] bg-[linear-gradient(160deg,var(--tc-surface-2),var(--tc-surface))] p-4 ${
          compact ? "min-h-52" : "min-h-72"
        }`}
      >
        {preview.isFetching && !preview.data?.url ? (
          <span className="text-sm text-[var(--tc-muted)]">Rendering preview…</span>
        ) : preview.data?.url ? (
          <img
            src={preview.data.url}
            alt="Certificate layout preview"
            className={`w-full rounded-md object-contain shadow-[0_12px_40px_-20px_rgba(0,0,0,0.45)] ${
              compact ? "max-h-56" : "max-h-[22rem]"
            }`}
          />
        ) : (
          <span className="text-sm text-[var(--tc-muted)]">Preview unavailable</span>
        )}
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Optional assets missing: {warnings.map(friendlyWarning).join(" · ")}
        </div>
      ) : null}

      {preview.isError ? (
        <FormError>{getCertificateErrorMessage(preview.error)}</FormError>
      ) : (
        <FormHint>
          Live preview updates as you type title and recipient. Final PDF/PNG uses the same layout.
        </FormHint>
      )}
    </div>
  );
}
