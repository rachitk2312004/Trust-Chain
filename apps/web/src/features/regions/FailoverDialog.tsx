import { useState } from "react";
import { Button, FormHint, Input, Label, Modal } from "@trustchain/ui";

export function FailoverDialog({
  open,
  onClose,
  onFailover,
  pending,
  primaryHint,
  standbyHint,
}: {
  open: boolean;
  onClose: () => void;
  onFailover: (input: {
    reason: string;
    force: boolean;
    primaryRegionCode: string;
    standbyRegions: string[];
  }) => void;
  pending?: boolean;
  primaryHint?: string;
  standbyHint?: string;
}) {
  const [reason, setReason] = useState("Primary region health degraded");
  const [force, setForce] = useState(true);
  const [primary, setPrimary] = useState(primaryHint ?? "eu-west-1");
  const [standby, setStandby] = useState(standbyHint ?? "us-east-1");

  return (
    <Modal open={open} title="Trigger failover" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onFailover({
            reason,
            force,
            primaryRegionCode: primary,
            standbyRegions: standby
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          });
        }}
      >
        <FormHint>
          Promotes a standby region to primary. Strict residency may block non-allowed targets.
        </FormHint>
        <div>
          <Label htmlFor="fo-reason">Reason</Label>
          <Input id="fo-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fo-primary">Primary</Label>
            <Input id="fo-primary" value={primary} onChange={(e) => setPrimary(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fo-standby">Standbys</Label>
            <Input id="fo-standby" value={standby} onChange={(e) => setStandby(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Force (required for manual mode when primary still active)
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Failing over…" : "Failover"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
