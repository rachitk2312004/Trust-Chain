import { AppError } from "../../lib/errors.js";
import { MarketplaceDefaults } from "@trustchain/config";

/** Parse simple semver major.minor.patch (ignores pre-release). */
export function parseSemver(version: string): [number, number, number] {
  const cleaned = version.trim().replace(/^v/i, "");
  const parts = cleaned.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) {
    throw new AppError(400, "INVALID_VERSION", `Invalid semver: ${version}`);
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! - pb[i]!;
  }
  return 0;
}

export function isVersionInRange(input: {
  platformVersion: string;
  minPlatformVersion: string;
  maxPlatformVersion?: string | null;
}): boolean {
  if (compareSemver(input.platformVersion, input.minPlatformVersion) < 0) return false;
  if (
    input.maxPlatformVersion &&
    compareSemver(input.platformVersion, input.maxPlatformVersion) > 0
  ) {
    return false;
  }
  return true;
}

export type CompatibilityResult = {
  compatible: boolean;
  reasons: string[];
  platformVersion: string;
  resolvedVersion: string;
};

export function evaluateCompatibility(input: {
  platformVersion?: string;
  version: string;
  minPlatformVersion: string;
  maxPlatformVersion?: string | null;
  listingStatus: string;
  requiredFeatures?: string[];
  availableFeatures?: string[];
}): CompatibilityResult {
  const platformVersion = input.platformVersion ?? MarketplaceDefaults.platformVersion;
  const reasons: string[] = [];

  if (input.listingStatus !== "published") {
    reasons.push("listing_not_published");
  }
  if (
    !isVersionInRange({
      platformVersion,
      minPlatformVersion: input.minPlatformVersion,
      maxPlatformVersion: input.maxPlatformVersion,
    })
  ) {
    reasons.push("platform_version_out_of_range");
  }
  if (input.requiredFeatures?.length) {
    const available = new Set(input.availableFeatures ?? []);
    for (const f of input.requiredFeatures) {
      if (!available.has(f)) reasons.push(`missing_feature:${f}`);
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons,
    platformVersion,
    resolvedVersion: input.version,
  };
}

export function assertCompatible(result: CompatibilityResult): void {
  if (!result.compatible) {
    throw new AppError(
      400,
      "INCOMPATIBLE",
      `Connector incompatible: ${result.reasons.join(", ")}`,
    );
  }
}

export type VersionCandidate = {
  id: string;
  version: string;
  isLatest: boolean;
  minPlatformVersion: string;
  maxPlatformVersion?: string | null;
  publishedAt?: Date | string | null;
};

/** Resolve install version: explicit > latest published > highest semver. */
export function resolveInstallVersion(input: {
  candidates: VersionCandidate[];
  requestedVersion?: string | null;
  platformVersion?: string;
}): VersionCandidate {
  if (input.candidates.length === 0) {
    throw new AppError(400, "NO_VERSIONS", "Listing has no versions");
  }

  if (input.requestedVersion) {
    const found = input.candidates.find((c) => c.version === input.requestedVersion);
    if (!found) {
      throw new AppError(404, "VERSION_NOT_FOUND", `Version ${input.requestedVersion} not found`);
    }
    return found;
  }

  const platformVersion = input.platformVersion ?? MarketplaceDefaults.platformVersion;
  const compatible = input.candidates
    .filter((c) =>
      isVersionInRange({
        platformVersion,
        minPlatformVersion: c.minPlatformVersion,
        maxPlatformVersion: c.maxPlatformVersion,
      }),
    )
    .sort((a, b) => compareSemver(b.version, a.version));

  if (compatible.length === 0) {
    throw new AppError(400, "NO_COMPATIBLE_VERSION", "No compatible version for this platform");
  }

  const latest = compatible.find((c) => c.isLatest);
  return latest ?? compatible[0]!;
}

export type InstallationPlan = {
  listingId: string;
  versionId: string;
  version: string;
  createEcosystemIntegration: boolean;
  connectorKey: string | null;
};

export function buildInstallationPlan(input: {
  listingId: string;
  version: VersionCandidate;
  connectorKey?: string | null;
  listingStatus: string;
  alreadyInstalled?: boolean;
}): InstallationPlan {
  if (input.alreadyInstalled) {
    throw new AppError(409, "ALREADY_INSTALLED", "Connector already installed for organization");
  }
  const compat = evaluateCompatibility({
    version: input.version.version,
    minPlatformVersion: input.version.minPlatformVersion,
    maxPlatformVersion: input.version.maxPlatformVersion,
    listingStatus: input.listingStatus,
  });
  assertCompatible(compat);

  return {
    listingId: input.listingId,
    versionId: input.version.id,
    version: input.version.version,
    createEcosystemIntegration: Boolean(input.connectorKey),
    connectorKey: input.connectorKey ?? null,
  };
}
