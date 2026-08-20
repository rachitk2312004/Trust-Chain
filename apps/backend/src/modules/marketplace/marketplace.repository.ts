import {
  IntegrationAuthModes,
  IntegrationStatuses,
  MarketplaceDefaults,
  MarketplaceInstallStatuses,
  MarketplaceListingStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { aggregateReviews, buildMarketplaceAnalytics, slugifyName } from "./marketplace.analytics.js";
import {
  buildInstallationPlan,
  evaluateCompatibility,
  resolveInstallVersion,
} from "./marketplace.installation.js";

function toPublicListing(row: {
  id: string;
  publisherOrgId: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  category: string;
  connectorKey: string | null;
  authMode: string;
  status: string;
  latestVersion: string | null;
  installCount: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    publisherOrgId: row.publisherOrgId,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    description: row.description,
    category: row.category,
    connectorKey: row.connectorKey,
    authMode: row.authMode,
    status: row.status,
    latestVersion: row.latestVersion,
    installCount: row.installCount,
    averageRating: row.averageRating,
    reviewCount: row.reviewCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function refreshListingRatings(listingId: string) {
  const reviews = await prisma.marketplaceReview.findMany({
    where: { listingId },
    select: { rating: true },
  });
  const agg = aggregateReviews(reviews);
  await prisma.marketplaceListing.update({
    where: { id: listingId },
    data: {
      averageRating: agg.averageRating,
      reviewCount: agg.reviewCount,
    },
  });
  return agg;
}

export async function listMarketplace(query: {
  organizationId?: string;
  category?: string;
  status?: string;
  publisherOrgId?: string;
  q?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.MarketplaceListingWhereInput = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.status
      ? { status: query.status }
      : query.publisherOrgId
        ? {}
        : { status: MarketplaceListingStatuses.published }),
    ...(query.publisherOrgId ? { publisherOrgId: query.publisherOrgId } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { summary: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [listings, total] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where,
      orderBy: [{ installCount: "desc" }, { averageRating: "desc" }],
      take: query.limit,
      skip: query.offset,
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
    prisma.marketplaceListing.count({ where }),
  ]);

  let installations: Array<{
    id: string;
    listingId: string;
    status: string;
    installedVersion: string;
  }> = [];
  if (query.organizationId) {
    installations = await prisma.marketplaceInstallation.findMany({
      where: {
        organizationId: query.organizationId,
        status: { not: MarketplaceInstallStatuses.uninstalled },
      },
      select: {
        id: true,
        listingId: true,
        status: true,
        installedVersion: true,
      },
    });
  }

  return {
    listings: listings.map((l) => ({
      ...toPublicListing(l),
      versions: l.versions.map((v) => ({
        id: v.id,
        version: v.version,
        changelog: v.changelog,
        minPlatformVersion: v.minPlatformVersion,
        maxPlatformVersion: v.maxPlatformVersion,
        isLatest: v.isLatest,
        publishedAt: v.publishedAt?.toISOString() ?? null,
      })),
      compatibility: l.latestVersion
        ? evaluateCompatibility({
            version: l.latestVersion,
            minPlatformVersion:
              l.versions.find((v) => v.isLatest)?.minPlatformVersion ?? "1.0.0",
            maxPlatformVersion:
              l.versions.find((v) => v.isLatest)?.maxPlatformVersion ?? null,
            listingStatus: l.status,
          })
        : null,
    })),
    installations,
    total,
    limit: query.limit,
    offset: query.offset,
    platformVersion: MarketplaceDefaults.platformVersion,
  };
}

export async function publishConnector(input: {
  publisherOrgId: string;
  publishedById: string;
  name: string;
  slug?: string;
  summary: string;
  description?: string;
  category: string;
  connectorKey?: string | null;
  authMode: string;
  version: string;
  changelog?: string;
  minPlatformVersion: string;
  maxPlatformVersion?: string | null;
  publish?: boolean;
}) {
  const slug = input.slug ?? slugifyName(input.name);
  if (!slug) throw new AppError(400, "VALIDATION_ERROR", "Invalid slug");

  try {
    const listing = await prisma.marketplaceListing.create({
      data: {
        publisherOrgId: input.publisherOrgId,
        publishedById: input.publishedById,
        slug,
        name: input.name,
        summary: input.summary,
        description: input.description ?? null,
        category: input.category,
        connectorKey: input.connectorKey ?? null,
        authMode: input.authMode,
        status: input.publish
          ? MarketplaceListingStatuses.published
          : MarketplaceListingStatuses.draft,
        latestVersion: input.version,
      },
    });

    const version = await prisma.marketplaceListingVersion.create({
      data: {
        listingId: listing.id,
        version: input.version,
        changelog: input.changelog ?? null,
        minPlatformVersion: input.minPlatformVersion,
        maxPlatformVersion: input.maxPlatformVersion ?? null,
        isLatest: true,
        publishedAt: input.publish ? new Date() : null,
        compatibilityJson: {
          platformVersion: MarketplaceDefaults.platformVersion,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      listing: toPublicListing(listing),
      version: {
        id: version.id,
        version: version.version,
        isLatest: version.isLatest,
        publishedAt: version.publishedAt?.toISOString() ?? null,
      },
    };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new AppError(409, "CONFLICT", "Listing slug already exists");
    }
    throw err;
  }
}

export async function patchConnector(
  id: string,
  input: {
    name?: string;
    summary?: string;
    description?: string | null;
    status?: string;
    version?: string;
    changelog?: string;
    minPlatformVersion?: string;
    maxPlatformVersion?: string | null;
    publishVersion?: boolean;
  },
) {
  const existing = await prisma.marketplaceListing.findUnique({
    where: { id },
    include: { versions: true },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Listing not found");

  let newVersion = null;
  if (input.version) {
    const dup = existing.versions.find((v) => v.version === input.version);
    if (dup) throw new AppError(409, "CONFLICT", "Version already exists");

    await prisma.marketplaceListingVersion.updateMany({
      where: { listingId: id, isLatest: true },
      data: { isLatest: false },
    });

    newVersion = await prisma.marketplaceListingVersion.create({
      data: {
        listingId: id,
        version: input.version,
        changelog: input.changelog ?? null,
        minPlatformVersion:
          input.minPlatformVersion ??
          existing.versions.find((v) => v.isLatest)?.minPlatformVersion ??
          "1.0.0",
        maxPlatformVersion:
          input.maxPlatformVersion !== undefined
            ? input.maxPlatformVersion
            : existing.versions.find((v) => v.isLatest)?.maxPlatformVersion ?? null,
        isLatest: true,
        publishedAt:
          input.publishVersion || existing.status === MarketplaceListingStatuses.published
            ? new Date()
            : null,
      },
    });
  }

  const listing = await prisma.marketplaceListing.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.version !== undefined ? { latestVersion: input.version } : {}),
    },
  });

  return {
    listing: toPublicListing(listing),
    version: newVersion
      ? {
          id: newVersion.id,
          version: newVersion.version,
          isLatest: newVersion.isLatest,
          publishedAt: newVersion.publishedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function installConnector(input: {
  organizationId: string;
  listingId: string;
  version?: string;
  installedById: string;
  review?: { rating: number; title: string; body?: string };
}) {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: input.listingId },
    include: { versions: true },
  });
  if (!listing) throw new AppError(404, "NOT_FOUND", "Listing not found");

  const existingInstall = await prisma.marketplaceInstallation.findUnique({
    where: {
      organizationId_listingId: {
        organizationId: input.organizationId,
        listingId: listing.id,
      },
    },
  });

  if (
    existingInstall &&
    existingInstall.status === MarketplaceInstallStatuses.installed &&
    input.review
  ) {
    const review = await upsertReview({
      organizationId: input.organizationId,
      listingId: listing.id,
      userId: input.installedById,
      ...input.review,
    });
    return {
      installation: {
        id: existingInstall.id,
        status: existingInstall.status,
        installedVersion: existingInstall.installedVersion,
        listingId: listing.id,
      },
      review,
      reused: true,
    };
  }

  const resolved = resolveInstallVersion({
    candidates: listing.versions.map((v) => ({
      id: v.id,
      version: v.version,
      isLatest: v.isLatest,
      minPlatformVersion: v.minPlatformVersion,
      maxPlatformVersion: v.maxPlatformVersion,
      publishedAt: v.publishedAt,
    })),
    requestedVersion: input.version,
  });

  const plan = buildInstallationPlan({
    listingId: listing.id,
    version: resolved,
    connectorKey: listing.connectorKey,
    listingStatus: listing.status,
    alreadyInstalled:
      existingInstall?.status === MarketplaceInstallStatuses.installed,
  });

  let ecosystemIntegrationId: string | null = null;
  if (plan.createEcosystemIntegration && plan.connectorKey) {
    const integration = await prisma.ecosystemIntegration.create({
      data: {
        organizationId: input.organizationId,
        connectorKey: plan.connectorKey,
        name: `${listing.name} (marketplace)`,
        status: IntegrationStatuses.draft,
        authMode: listing.authMode || IntegrationAuthModes.oauth,
        scopesJson: [],
        configJson: {
          source: "marketplace",
          listingId: listing.id,
          version: plan.version,
        } as Prisma.InputJsonValue,
        createdById: input.installedById,
      },
    });
    ecosystemIntegrationId = integration.id;
  }

  const installation = existingInstall
    ? await prisma.marketplaceInstallation.update({
        where: { id: existingInstall.id },
        data: {
          versionId: plan.versionId,
          status: MarketplaceInstallStatuses.installed,
          installedVersion: plan.version,
          ecosystemIntegrationId,
          installedById: input.installedById,
          installedAt: new Date(),
          uninstalledAt: null,
          errorMessage: null,
        },
      })
    : await prisma.marketplaceInstallation.create({
        data: {
          organizationId: input.organizationId,
          listingId: listing.id,
          versionId: plan.versionId,
          status: MarketplaceInstallStatuses.installed,
          installedVersion: plan.version,
          ecosystemIntegrationId,
          installedById: input.installedById,
          installedAt: new Date(),
        },
      });

  await prisma.marketplaceListing.update({
    where: { id: listing.id },
    data: { installCount: { increment: existingInstall ? 0 : 1 } },
  });

  let review = null;
  if (input.review) {
    review = await upsertReview({
      organizationId: input.organizationId,
      listingId: listing.id,
      userId: input.installedById,
      ...input.review,
    });
  }

  return {
    installation: {
      id: installation.id,
      status: installation.status,
      installedVersion: installation.installedVersion,
      listingId: listing.id,
      ecosystemIntegrationId,
      compatibility: evaluateCompatibility({
        version: plan.version,
        minPlatformVersion: resolved.minPlatformVersion,
        maxPlatformVersion: resolved.maxPlatformVersion,
        listingStatus: listing.status,
      }),
    },
    review,
    reused: false,
  };
}

async function upsertReview(input: {
  organizationId: string;
  listingId: string;
  userId: string;
  rating: number;
  title: string;
  body?: string;
}) {
  const review = await prisma.marketplaceReview.upsert({
    where: {
      listingId_userId: {
        listingId: input.listingId,
        userId: input.userId,
      },
    },
    create: {
      organizationId: input.organizationId,
      listingId: input.listingId,
      userId: input.userId,
      rating: input.rating,
      title: input.title,
      body: input.body ?? null,
    },
    update: {
      rating: input.rating,
      title: input.title,
      body: input.body ?? null,
    },
  });
  const agg = await refreshListingRatings(input.listingId);
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    averageRating: agg.averageRating,
    reviewCount: agg.reviewCount,
    createdAt: review.createdAt.toISOString(),
  };
}

export async function listReviews(query: {
  organizationId?: string;
  listingId?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.MarketplaceReviewWhereInput = {
    ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.listingId ? { listingId: query.listingId } : {}),
  };
  const [reviews, total] = await Promise.all([
    prisma.marketplaceReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: { listing: { select: { name: true, slug: true } } },
    }),
    prisma.marketplaceReview.count({ where }),
  ]);

  const allForAgg = query.listingId
    ? await prisma.marketplaceReview.findMany({
        where: { listingId: query.listingId },
        select: { rating: true },
      })
    : reviews.map((r) => ({ rating: r.rating }));

  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      listingName: r.listing.name,
      listingSlug: r.listing.slug,
      organizationId: r.organizationId,
      userId: r.userId,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
    aggregation: aggregateReviews(allForAgg),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getMarketplaceAnalytics(query: {
  organizationId?: string;
  publisherOrgId?: string;
}) {
  const listingWhere: Prisma.MarketplaceListingWhereInput = {
    ...(query.publisherOrgId ? { publisherOrgId: query.publisherOrgId } : {}),
  };
  const [listings, installations, reviews] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where: listingWhere,
      select: {
        id: true,
        category: true,
        status: true,
        installCount: true,
        averageRating: true,
        reviewCount: true,
      },
    }),
    prisma.marketplaceInstallation.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.publisherOrgId
          ? { listing: { publisherOrgId: query.publisherOrgId } }
          : {}),
      },
      select: { status: true, listing: { select: { category: true } } },
    }),
    prisma.marketplaceReview.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.publisherOrgId
          ? { listing: { publisherOrgId: query.publisherOrgId } }
          : {}),
      },
      select: { rating: true },
    }),
  ]);

  return {
    analytics: buildMarketplaceAnalytics({
      listings,
      installations: installations.map((i) => ({
        status: i.status,
        category: i.listing.category,
      })),
      reviews,
    }),
    platformVersion: MarketplaceDefaults.platformVersion,
  };
}

export async function getListingPublisherOrgId(id: string): Promise<string | null> {
  const row = await prisma.marketplaceListing.findUnique({
    where: { id },
    select: { publisherOrgId: true },
  });
  return row?.publisherOrgId ?? null;
}

// re-export for tests via service
export { evaluateCompatibility, resolveInstallVersion };
