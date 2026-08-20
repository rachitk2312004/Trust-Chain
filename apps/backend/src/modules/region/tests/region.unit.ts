import assert from "node:assert/strict";
import {
  buildResidencyReport,
  evaluateReplicationHealth,
  selectFailoverTarget,
  validateReplicationTargets,
} from "../region.replication.js";
import { enforceResidency, selectRegion } from "../region.routing.js";
import { AppError } from "../../../lib/errors.js";

const regions = [
  {
    code: "eu-west-1",
    status: "active",
    priority: 10,
    latencyWeight: 50,
    jurisdiction: "EU",
  },
  {
    code: "us-east-1",
    status: "active",
    priority: 20,
    latencyWeight: 80,
    jurisdiction: "US",
  },
  {
    code: "ap-south-1",
    status: "offline",
    priority: 30,
    latencyWeight: 40,
    jurisdiction: "IN",
  },
];

export function testRegionSelection(): void {
  const home = selectRegion({
    regions,
    residency: {
      homeRegionCode: "eu-west-1",
      mode: "strict",
      allowedRegions: ["eu-west-1", "us-east-1"],
      lockedClasses: ["pii"],
    },
    routing: { strategy: "home", stickyTtlSeconds: 3600 },
  });
  assert.equal(home.regionCode, "eu-west-1");

  const nearest = selectRegion({
    regions,
    residency: {
      homeRegionCode: "eu-west-1",
      mode: "preferred",
      allowedRegions: ["eu-west-1", "us-east-1"],
      lockedClasses: [],
    },
    routing: { strategy: "nearest", stickyTtlSeconds: 3600 },
    clientRegionHint: "us-east-1",
  });
  assert.equal(nearest.regionCode, "us-east-1");

  const locked = selectRegion({
    regions,
    residency: {
      homeRegionCode: "eu-west-1",
      mode: "strict",
      allowedRegions: ["eu-west-1", "us-east-1"],
      lockedClasses: ["pii"],
    },
    routing: { strategy: "nearest", stickyTtlSeconds: 3600 },
    clientRegionHint: "us-east-1",
    dataClass: "pii",
  });
  assert.equal(locked.regionCode, "eu-west-1");
  assert.equal(locked.reason, "locked_class_home");
}

export function testResidencyEnforcement(): void {
  const ok = enforceResidency({
    residency: {
      homeRegionCode: "eu-west-1",
      mode: "strict",
      allowedRegions: ["eu-west-1"],
      lockedClasses: ["pii"],
    },
    targetRegionCode: "eu-west-1",
    dataClass: "pii",
  });
  assert.equal(ok.allowed, true);

  const blocked = enforceResidency({
    residency: {
      homeRegionCode: "eu-west-1",
      mode: "strict",
      allowedRegions: ["eu-west-1"],
      lockedClasses: ["pii"],
    },
    targetRegionCode: "us-east-1",
    dataClass: "pii",
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "locked_class");
}

export function testFailoverHandling(): void {
  const none = selectFailoverTarget({
    policy: {
      mode: "manual",
      primaryRegionCode: "eu-west-1",
      standbyRegions: ["us-east-1"],
      healthFailThreshold: 3,
    },
    regions,
    consecutivePrimaryFailures: 1,
  });
  assert.equal(none.action, "none");

  const forced = selectFailoverTarget({
    policy: {
      mode: "manual",
      primaryRegionCode: "eu-west-1",
      standbyRegions: ["us-east-1"],
      healthFailThreshold: 3,
    },
    regions,
    consecutivePrimaryFailures: 0,
    force: true,
  });
  assert.equal(forced.action, "failover");
  assert.equal(forced.toRegionCode, "us-east-1");

  assert.throws(
    () =>
      selectFailoverTarget({
        policy: {
          mode: "automatic",
          primaryRegionCode: "eu-west-1",
          standbyRegions: ["ap-south-1"],
          healthFailThreshold: 1,
        },
        regions,
        consecutivePrimaryFailures: 5,
      }),
    (err: unknown) => err instanceof AppError && err.code === "FAILOVER_UNAVAILABLE",
  );
}

export function testReplicationPolicies(): void {
  const valid = validateReplicationTargets({
    homeRegionCode: "eu-west-1",
    policy: {
      mode: "async",
      targetRegions: ["us-east-1", "eu-west-1"],
      lagSecondsMax: 300,
    },
    availableRegionCodes: ["eu-west-1", "us-east-1"],
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.targets, ["us-east-1"]);

  const health = evaluateReplicationHealth({
    policy: { mode: "async", targetRegions: ["us-east-1"], lagSecondsMax: 60 },
    lagByRegion: { "us-east-1": 120 },
  });
  assert.equal(health.healthy, false);
  assert.equal(health.violations[0]?.region, "us-east-1");

  const syncOk = evaluateReplicationHealth({
    policy: { mode: "sync", targetRegions: ["us-east-1"], lagSecondsMax: 300 },
    lagByRegion: { "us-east-1": 0 },
  });
  assert.equal(syncOk.healthy, true);
}

export function testRoutingDecisions(): void {
  const sticky = selectRegion({
    regions,
    residency: {
      homeRegionCode: "eu-west-1",
      mode: "preferred",
      allowedRegions: ["eu-west-1", "us-east-1"],
      lockedClasses: [],
    },
    routing: { strategy: "sticky", stickyTtlSeconds: 3600 },
    stickyRegion: "us-east-1",
  });
  assert.equal(sticky.regionCode, "us-east-1");
  assert.equal(sticky.reason, "sticky_session");

  const report = buildResidencyReport({
    homeRegionCode: "eu-west-1",
    mode: "strict",
    allowedRegions: ["eu-west-1", "us-east-1"],
    lockedClasses: ["pii"],
    activeRegionCodes: ["eu-west-1", "us-east-1"],
    replicationTargets: ["us-east-1"],
    primaryRegionCode: "eu-west-1",
    standbyRegions: ["us-east-1"],
  });
  assert.equal(report.compliance.homeActive, true);
  assert.equal(report.compliance.allowedCoverage, 1);
  assert.equal(report.compliance.replicationAligned, true);
}
