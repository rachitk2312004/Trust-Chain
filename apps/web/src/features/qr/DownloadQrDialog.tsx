import { useState } from "react";
import { Button, FormError, FormHint, Modal, Select } from "@trustchain/ui";
import { useDownloadQr } from "./hooks";
import { getQrErrorMessage } from "../../lib/qrErrors";

export function DownloadQrDialog({
  organizationId,
  publicCode,
  open,
  onClose,
}: {
  organizationId: string;
  publicCode: string;
  open: boolean;
  onClose: () => void;
}) {
  const download = useDownloadQr(organizationId);
  const [format, setFormat] = useState<"png" | "svg" | "base64">("png");

  function triggerDownload() {
    download.mutate(
      { publicCode, format },
      {
        onSuccess: (result) => {
          if (result.format === "base64" && result.pngBase64) {
            const link = document.createElement("a");
            link.href = `data:image/png;base64,${result.pngBase64}`;
            link.download = `${publicCode}.png`;
            link.click();
            onClose();
            return;
          }
          if (result.blob) {
            const url = URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${publicCode}.${result.format === "svg" ? "svg" : "png"}`;
            link.click();
            URL.revokeObjectURL(url);
            onClose();
          }
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title="Download QR"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={download.isPending} onClick={triggerDownload}>
            {download.isPending ? "Preparing…" : "Download"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          value={format}
          onChange={(e) => setFormat(e.target.value as "png" | "svg" | "base64")}
          aria-label="Download format"
        >
          <option value="png">PNG</option>
          <option value="svg">SVG</option>
          <option value="base64">PNG (base64)</option>
        </Select>
        <FormHint>Downloads are recorded in QR analytics.</FormHint>
        <FormError>{download.error ? getQrErrorMessage(download.error) : null}</FormError>
      </div>
    </Modal>
  );
}
