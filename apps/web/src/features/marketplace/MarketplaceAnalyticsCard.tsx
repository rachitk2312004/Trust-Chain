import { Badge } from "@trustchain/ui";
import type { MarketplaceAnalytics } from "../../services/marketplaceApi";

export function MarketplaceAnalyticsCard({
  analytics,
  platformVersion,
}: {
  analytics: MarketplaceAnalytics;
  platformVersion?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Published</div>
          <div className="mt-1 text-3xl font-semibold">{analytics.listingsPublished}</div>
          <p className="mt-1 text-xs text-[var(--tc-muted)]">{analytics.listingsDraft} drafts</p>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Installs</div>
          <div className="mt-1 text-3xl font-semibold">{analytics.totalInstalls}</div>
          <p className="mt-1 text-xs text-[var(--tc-muted)]">
            {analytics.activeInstalls} active
          </p>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Avg rating</div>
          <div className="mt-1 text-3xl font-semibold">
            {analytics.reviewCount > 0 ? analytics.averageRating.toFixed(1) : "—"}
          </div>
          <p className="mt-1 text-xs text-[var(--tc-muted)]">{analytics.reviewCount} reviews</p>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Platform</div>
          <div className="mt-1 font-mono text-xl font-semibold">
            {platformVersion ?? "1.3.0"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
            Top categories
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {analytics.topCategories.length === 0 ? (
              <li className="text-[var(--tc-muted)]">None yet</li>
            ) : (
              analytics.topCategories.map((c) => (
                <li key={c.category} className="flex justify-between gap-2">
                  <span className="font-mono text-xs">{c.category}</span>
                  <span className="text-xs text-[var(--tc-muted)]">
                    {c.installs} installs · {c.listings} listings
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
            Rating distribution
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(analytics.ratingDistribution)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([stars, count]) => (
                <li key={stars} className="flex items-center gap-2">
                  <Badge tone="neutral">{stars}★</Badge>
                  <span className="text-xs">{count}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
