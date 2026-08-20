import { Badge } from "@trustchain/ui";
import type { MarketplaceListing } from "../../services/marketplaceApi";

export function ConnectorDetailCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{listing.name}</h3>
          <p className="mt-1 text-sm text-[var(--tc-muted)]">{listing.summary}</p>
        </div>
        <Badge
          tone={
            listing.status === "published"
              ? "success"
              : listing.status === "suspended"
                ? "danger"
                : "neutral"
          }
        >
          {listing.status}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-[var(--tc-muted)]">Category</span>
          <div className="font-mono text-xs">{listing.category}</div>
        </div>
        <div>
          <span className="text-[var(--tc-muted)]">Auth</span>
          <div className="font-mono text-xs">{listing.authMode}</div>
        </div>
        <div>
          <span className="text-[var(--tc-muted)]">Latest</span>
          <div className="font-mono text-xs">{listing.latestVersion ?? "—"}</div>
        </div>
        <div>
          <span className="text-[var(--tc-muted)]">Rating</span>
          <div className="text-xs">
            {listing.reviewCount > 0
              ? `${listing.averageRating.toFixed(1)} / 5 · ${listing.reviewCount} reviews`
              : "No reviews"}
          </div>
        </div>
      </div>
      {listing.description ? (
        <p className="mt-4 text-sm whitespace-pre-wrap">{listing.description}</p>
      ) : null}
      {listing.versions && listing.versions.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Versions</div>
          <ul className="mt-2 space-y-1 text-xs">
            {listing.versions.map((v) => (
              <li key={v.id} className="font-mono">
                {v.version}
                {v.isLatest ? " · latest" : ""} · platform {v.minPlatformVersion}
                {v.maxPlatformVersion ? `–${v.maxPlatformVersion}` : "+"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
