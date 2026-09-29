import { CERTIFICATE_LAYOUT_PRESETS, type CertificateLayoutPreset } from "@trustchain/config";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@trustchain/ui";

type Props = {
  disabled?: boolean;
  existingCodes: Set<string>;
  onUse: (preset: CertificateLayoutPreset) => void;
};

export function CertificatePresetGallery({ disabled, existingCodes, onUse }: Props) {
  return (
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
          </Card>
        );
      })}
    </div>
  );
}
