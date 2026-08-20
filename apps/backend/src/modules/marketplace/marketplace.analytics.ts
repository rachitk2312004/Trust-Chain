export type ListingAnalyticsRow = {
  id: string;
  category: string;
  status: string;
  installCount: number;
  averageRating: number;
  reviewCount: number;
};

export type ReviewRow = {
  rating: number;
};

export function aggregateReviews(reviews: ReviewRow[]): {
  averageRating: number;
  reviewCount: number;
  distribution: Record<string, number>;
} {
  const distribution: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  for (const r of reviews) {
    const key = String(Math.min(5, Math.max(1, Math.round(r.rating))));
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? 0
      : Number(
          (reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(2),
        );
  return { averageRating, reviewCount, distribution };
}

export function buildMarketplaceAnalytics(input: {
  listings: ListingAnalyticsRow[];
  installations: Array<{ status: string; category?: string }>;
  reviews: ReviewRow[];
}): {
  listingsPublished: number;
  listingsDraft: number;
  totalInstalls: number;
  activeInstalls: number;
  averageRating: number;
  reviewCount: number;
  ratingDistribution: Record<string, number>;
  topCategories: Array<{ category: string; installs: number; listings: number }>;
  topRated: Array<{ id: string; averageRating: number; reviewCount: number; installCount: number }>;
} {
  const listingsPublished = input.listings.filter((l) => l.status === "published").length;
  const listingsDraft = input.listings.filter((l) => l.status === "draft").length;
  const totalInstalls = input.listings.reduce((s, l) => s + l.installCount, 0);
  const activeInstalls = input.installations.filter((i) => i.status === "installed").length;
  const reviewAgg = aggregateReviews(input.reviews);

  const categoryMap = new Map<string, { installs: number; listings: number }>();
  for (const l of input.listings) {
    const cur = categoryMap.get(l.category) ?? { installs: 0, listings: 0 };
    cur.listings += 1;
    cur.installs += l.installCount;
    categoryMap.set(l.category, cur);
  }
  const topCategories = [...categoryMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 5);

  const topRated = [...input.listings]
    .filter((l) => l.reviewCount > 0)
    .sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount)
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      averageRating: l.averageRating,
      reviewCount: l.reviewCount,
      installCount: l.installCount,
    }));

  return {
    listingsPublished,
    listingsDraft,
    totalInstalls,
    activeInstalls,
    averageRating: reviewAgg.averageRating,
    reviewCount: reviewAgg.reviewCount,
    ratingDistribution: reviewAgg.distribution,
    topCategories,
    topRated,
  };
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
