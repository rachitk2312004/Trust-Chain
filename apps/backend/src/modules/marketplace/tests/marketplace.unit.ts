import assert from "node:assert/strict";
import {
  aggregateReviews,
  buildMarketplaceAnalytics,
  slugifyName,
} from "../marketplace.analytics.js";
import {
  buildInstallationPlan,
  compareSemver,
  evaluateCompatibility,
  resolveInstallVersion,
} from "../marketplace.installation.js";
import { AppError } from "../../../lib/errors.js";

export function testConnectorPublication(): void {
  assert.equal(slugifyName("My Cool Connector!"), "my-cool-connector");
  assert.equal(compareSemver("1.2.0", "1.1.9"), 1);
  assert.equal(compareSemver("2.0.0", "2.0.0"), 0);
  assert.equal(compareSemver("1.0.0", "1.0.1"), -1);
}

export function testConnectorInstallation(): void {
  const version = {
    id: "v1",
    version: "1.2.0",
    isLatest: true,
    minPlatformVersion: "1.0.0",
    maxPlatformVersion: "2.0.0",
  };
  const plan = buildInstallationPlan({
    listingId: "listing-1",
    version,
    connectorKey: "slack",
    listingStatus: "published",
  });
  assert.equal(plan.version, "1.2.0");
  assert.equal(plan.createEcosystemIntegration, true);

  assert.throws(
    () =>
      buildInstallationPlan({
        listingId: "listing-1",
        version,
        listingStatus: "published",
        alreadyInstalled: true,
      }),
    (err: unknown) => err instanceof AppError,
  );
}

export function testCompatibilityChecks(): void {
  const ok = evaluateCompatibility({
    version: "1.1.0",
    minPlatformVersion: "1.0.0",
    maxPlatformVersion: "2.0.0",
    listingStatus: "published",
    platformVersion: "1.3.0",
  });
  assert.equal(ok.compatible, true);

  const badStatus = evaluateCompatibility({
    version: "1.1.0",
    minPlatformVersion: "1.0.0",
    listingStatus: "draft",
    platformVersion: "1.3.0",
  });
  assert.equal(badStatus.compatible, false);
  assert.ok(badStatus.reasons.includes("listing_not_published"));

  const outOfRange = evaluateCompatibility({
    version: "1.1.0",
    minPlatformVersion: "2.0.0",
    listingStatus: "published",
    platformVersion: "1.3.0",
  });
  assert.equal(outOfRange.compatible, false);
  assert.ok(outOfRange.reasons.includes("platform_version_out_of_range"));
}

export function testVersionResolution(): void {
  const candidates = [
    {
      id: "a",
      version: "1.0.0",
      isLatest: false,
      minPlatformVersion: "1.0.0",
      maxPlatformVersion: null,
    },
    {
      id: "b",
      version: "1.2.0",
      isLatest: true,
      minPlatformVersion: "1.0.0",
      maxPlatformVersion: "2.0.0",
    },
    {
      id: "c",
      version: "1.5.0",
      isLatest: false,
      minPlatformVersion: "1.4.0",
      maxPlatformVersion: null,
    },
  ];

  const latest = resolveInstallVersion({
    candidates,
    platformVersion: "1.3.0",
  });
  assert.equal(latest.version, "1.2.0");

  const explicit = resolveInstallVersion({
    candidates,
    requestedVersion: "1.0.0",
  });
  assert.equal(explicit.id, "a");

  assert.throws(
    () =>
      resolveInstallVersion({
        candidates,
        requestedVersion: "9.9.9",
      }),
    (err: unknown) => err instanceof AppError,
  );
}

export function testReviewAggregation(): void {
  const agg = aggregateReviews([
    { rating: 5 },
    { rating: 4 },
    { rating: 5 },
    { rating: 3 },
  ]);
  assert.equal(agg.reviewCount, 4);
  assert.equal(agg.averageRating, 4.25);
  assert.equal(agg.distribution["5"], 2);

  const analytics = buildMarketplaceAnalytics({
    listings: [
      {
        id: "l1",
        category: "communication",
        status: "published",
        installCount: 10,
        averageRating: 4.5,
        reviewCount: 4,
      },
      {
        id: "l2",
        category: "identity",
        status: "draft",
        installCount: 0,
        averageRating: 0,
        reviewCount: 0,
      },
    ],
    installations: [
      { status: "installed", category: "communication" },
      { status: "uninstalled", category: "communication" },
    ],
    reviews: [{ rating: 5 }, { rating: 4 }],
  });
  assert.equal(analytics.listingsPublished, 1);
  assert.equal(analytics.listingsDraft, 1);
  assert.equal(analytics.activeInstalls, 1);
  assert.equal(analytics.topCategories[0]?.category, "communication");
}
