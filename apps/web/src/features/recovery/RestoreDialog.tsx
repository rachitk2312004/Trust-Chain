import { useState } from "react";
import { Button, FormHint, Input, Label, Modal } from "@trustchain/ui";

export function RestoreDialog({
  open,
  onClose,
  onRestore,
  pending,
  backupJobIdHint,
  regionHint,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (input: { backupJobId: string; targetRegionCode: string }) => void;
  pending?: boolean;
  backupJobIdHint?: string;
  regionHint?: string;
}) {
  const [backupJobId, setBackupJobId] = useState(backupJobIdHint ?? "");
  const [targetRegionCode, setTargetRegionCode] = useState(regionHint ?? "eu-west-1");

  return (
    <Modal open={open} title="Restore from backup" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onRestore({ backupJobId, targetRegionCode });
        }}
      >
        <FormHint>
          Validates checksum, expiry, and RTO target before recording a restore job.
        </FormHint>
        <div>
          <Label htmlFor="rs-backup">Backup job ID</Label>
          <Input
            id="rs-backup"
            value={backupJobId}
            onChange={(e) => setBackupJobId(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="rs-region">Target region</Label>
          <Input
            id="rs-region"
            value={targetRegionCode}
            onChange={(e) => setTargetRegionCode(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Restoring…" : "Restore"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
