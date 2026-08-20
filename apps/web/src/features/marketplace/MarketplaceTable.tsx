import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { MarketplaceListing } from "../../services/marketplaceApi";

export function MarketplaceTable({
  listings,
  installedListingIds,
  onInstall,
  onSelect,
}: {
  listings: MarketplaceListing[];
  installedListingIds?: Set<string>;
  onInstall?: (listing: MarketplaceListing) => void;
  onSelect?: (listing: MarketplaceListing) => void;
}) {
  if (listings.length === 0) {
    return <FormHint>No marketplace listings yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Connector</TH>
          <TH>Category</TH>
          <TH>Version</TH>
          <TH>Rating</TH>
          <TH>Installs</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {listings.map((l) => {
          const installed = installedListingIds?.has(l.id);
          return (
            <TR key={l.id}>
              <TD>
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onSelect?.(l)}
                >
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-[var(--tc-muted)]">{l.summary}</div>
                </button>
              </TD>
              <TD className="font-mono text-xs">{l.category}</TD>
              <TD className="font-mono text-xs">{l.latestVersion ?? "—"}</TD>
              <TD className="text-xs">
                {l.reviewCount > 0 ? `${l.averageRating.toFixed(1)} (${l.reviewCount})` : "—"}
              </TD>
              <TD className="text-xs">{l.installCount}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  {l.compatibility ? (
                    <Badge tone={l.compatibility.compatible ? "success" : "danger"}>
                      {l.compatibility.compatible ? "compatible" : "incompatible"}
                    </Badge>
                  ) : null}
                  {installed ? (
                    <Badge tone="success">installed</Badge>
                  ) : onInstall ? (
                    <Button type="button" variant="ghost" onClick={() => onInstall(l)}>
                      Install
                    </Button>
                  ) : null}
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
