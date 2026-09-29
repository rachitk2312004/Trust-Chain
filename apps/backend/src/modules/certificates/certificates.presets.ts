/** Re-export built-in certificate layout presets (single source: @trustchain/config). */
export {
  CERTIFICATE_LAYOUT_PRESETS,
  CertificateLayoutPresetIds,
  certificateLayoutPresetById,
  defaultCertificateLayoutPreset,
  type CertificateLayoutPreset,
  type CertificateLayoutPresetId,
} from "@trustchain/config";

import { CERTIFICATE_LAYOUT_PRESETS } from "@trustchain/config";

export function listCertificatePresetCatalog() {
  return CERTIFICATE_LAYOUT_PRESETS.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    orientation: p.layout.orientation,
    pageSize: p.layout.pageSize,
    accentColor: p.layout.accentColor,
    backgroundColor: p.layout.backgroundColor,
    layout: p.layout,
  }));
}
