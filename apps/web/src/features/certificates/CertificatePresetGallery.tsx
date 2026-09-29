import { useState } from "react";
import { CERTIFICATE_LAYOUT_PRESETS, type CertificateLayoutPreset } from "@trustchain/config";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Modal,
} from "@trustchain/ui";
import { TemplateLayoutPreview } from "./TemplateLayoutPreview";

type Props = {
  organizationId: string;
  disabled?: boolean;
  existingCodes: Set<string>;
  onUse: (preset: CertificateLayoutPreset) => void;
};

export function CertificatePresetGallery({
  organizationId,
  disabled,
  existingCodes,
  onUse,
}: Props) {
  const [previewPreset, setPreviewPreset] = useState<CertificateLayoutPreset | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CERTIFICATE_LAYOUT_PRESETS.map((preset) => {
          const taken = existingCodes.has(preset.code);
          return (
            <Card key={preset.id} className="overflow-hidden">
              <div
                className="h-2 w-full"
                style={{
                  background: `linear-gradient(90deg, ${preset.layout.accentColor} 0%, ${preset.layout.borderColor} 100%)`,
                }}
              />
              <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{preset.name}</CardTitle>
                  <Badge tone="neutral">{preset.layout.orientation}</Badge>
                  <Badge tone="neutral">{preset.layout.pageSize}</Badge>
                </div>
                <CardDescription className="text-xs leading-relaxed">{preset.description}</CardDescription>
              </CardHeader>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--tc-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-6 w-6 rounded border border-[var(--tc-border)]"
                    style={{ backgroundColor: preset.layout.backgroundColor }}
                    title="Background"
                  />
                  <span
                    className="inline-block h-6 w-6 rounded"
                    style={{ backgroundColor: preset.layout.accentColor }}
                    title="Accent"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewPreset(preset)}
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={taken ? "ghost" : "primary"}
                    disabled={disabled || taken}
                    onClick={() => onUse(preset)}
                  >
                    {taken ? "Added" : "Use preset"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={Boolean(previewPreset)}
        title={previewPreset ? `Preview · ${previewPreset.name}` : "Preview"}
        onClose={() => setPreviewPreset(null)}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewPreset(null)}>
              Close
            </Button>
            {previewPreset ? (
              <Button
                disabled={disabled || existingCodes.has(previewPreset.code)}
                onClick={() => {
                  onUse(previewPreset);
                  setPreviewPreset(null);
                }}
              >
                {existingCodes.has(previewPreset.code) ? "Already added" : "Use this preset"}
              </Button>
            ) : null}
          </>
        }
      >
        {previewPreset ? (
          <TemplateLayoutPreview
            organizationId={organizationId}
            layout={{ ...previewPreset.layout }}
            enabled={Boolean(previewPreset)}
            title={`${previewPreset.layout.orientation} · ${previewPreset.layout.pageSize}`}
          />
        ) : null}
      </Modal>
    </>
  );
}
