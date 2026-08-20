import {
  AdminPolicyDecisions,
  AdminPolicyRetentionActions,
  AdminPolicyStatuses,
  AdminPolicyTypes,
  TenantQuotaKeys,
} from "@trustchain/config";

export type AdminPolicyType =
  (typeof AdminPolicyTypes)[keyof typeof AdminPolicyTypes];

export type AdminPolicyDecision =
  (typeof AdminPolicyDecisions)[keyof typeof AdminPolicyDecisions];

export type PolicyRules = Record<string, unknown>;

export type PolicyDefinitionLike = {
  id: string;
  name: string;
  policyType: string;
  status: string;
  priority: number;
  parentPolicyId: string | null;
  rules: PolicyRules;
};

export type PolicyAssignmentLike = {
  id: string;
  policyId: string;
  organizationId: string;
  inheritToChildren: boolean;
  enabled: boolean;
};

export type PolicyConflict = {
  policyType: string;
  key: string;
  leftPolicyId: string;
  rightPolicyId: string;
  leftValue: unknown;
  rightValue: unknown;
  reason: string;
};

export type EvaluationContext = {
  capability?: string;
  resource?: string;
  usage?: number;
  featureKey?: string;
  retentionAgeDays?: number;
  workflowStep?: string;
  approvalCount?: number;
  orgStatus?: string;
  childCount?: number;
};

export type RuleEvaluation = {
  decision: AdminPolicyDecision;
  policyId: string | null;
  reason: string;
  details?: Record<string, unknown>;
};

export type PolicyEvaluationResult = {
  decision: AdminPolicyDecision;
  policyType: string | null;
  matchedPolicyIds: string[];
  effectiveRules: PolicyRules;
  conflicts: PolicyConflict[];
  evaluations: RuleEvaluation[];
  reason: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Depth-first parent → child merge; child keys override parent. */
export function mergeInheritedRules(
  chain: PolicyDefinitionLike[],
): PolicyRules {
  const merged: PolicyRules = {};
  for (const policy of chain) {
    Object.assign(merged, policy.rules);
  }
  return merged;
}

/** Resolve parent→…→self inheritance chain for a policy (root first). */
export function resolveInheritanceChain(
  policy: PolicyDefinitionLike,
  byId: Map<string, PolicyDefinitionLike>,
): PolicyDefinitionLike[] {
  const chain: PolicyDefinitionLike[] = [];
  const seen = new Set<string>();
  let current: PolicyDefinitionLike | undefined = policy;
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentPolicyId
      ? byId.get(current.parentPolicyId)
      : undefined;
  }
  return chain;
}

/**
 * Policies applicable to an organization:
 * - assignment on the org itself, or
 * - assignment on an ancestor with inheritToChildren, or
 * - unassigned global policies (no assignments) treated as platform-wide when includeGlobal is true.
 */
export function collectApplicablePolicies(input: {
  policies: PolicyDefinitionLike[];
  assignments: PolicyAssignmentLike[];
  organizationId: string | null;
  ancestorOrganizationIds: string[];
  includeGlobal?: boolean;
  policyType?: string | null;
}): Array<PolicyDefinitionLike & { assignmentId: string | null; effectiveRules: PolicyRules }> {
  const byId = new Map(input.policies.map((p) => [p.id, p]));
  const active = input.policies.filter(
    (p) =>
      p.status === AdminPolicyStatuses.active &&
      (!input.policyType || p.policyType === input.policyType),
  );

  const assignedPolicyIds = new Set<string>();
  const applicableIds = new Set<string>();
  const assignmentByPolicy = new Map<string, string>();

  for (const assignment of input.assignments) {
    if (!assignment.enabled) continue;
    assignedPolicyIds.add(assignment.policyId);
    const onSelf =
      input.organizationId != null &&
      assignment.organizationId === input.organizationId;
    const onAncestor =
      assignment.inheritToChildren &&
      input.ancestorOrganizationIds.includes(assignment.organizationId);
    if (onSelf || onAncestor) {
      applicableIds.add(assignment.policyId);
      assignmentByPolicy.set(assignment.policyId, assignment.id);
    }
  }

  if (input.includeGlobal !== false) {
    for (const policy of active) {
      if (!assignedPolicyIds.has(policy.id)) {
        applicableIds.add(policy.id);
      }
    }
  }

  const result: Array<
    PolicyDefinitionLike & { assignmentId: string | null; effectiveRules: PolicyRules }
  > = [];

  for (const policy of active) {
    if (!applicableIds.has(policy.id)) continue;
    const chain = resolveInheritanceChain(policy, byId).filter(
      (p) => p.status === AdminPolicyStatuses.active || p.id === policy.id,
    );
    result.push({
      ...policy,
      assignmentId: assignmentByPolicy.get(policy.id) ?? null,
      effectiveRules: mergeInheritedRules(chain),
    });
  }

  return result.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

/** Detect conflicting rule values among same-type policies at equal priority. */
export function detectPolicyConflicts(
  policies: Array<PolicyDefinitionLike & { effectiveRules: PolicyRules }>,
): PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  const byType = new Map<string, Array<PolicyDefinitionLike & { effectiveRules: PolicyRules }>>();

  for (const policy of policies) {
    const list = byType.get(policy.policyType) ?? [];
    list.push(policy);
    byType.set(policy.policyType, list);
  }

  for (const [policyType, group] of byType) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = group[i]!;
        const right = group[j]!;
        if (left.priority !== right.priority) continue;
        if (
          left.parentPolicyId === right.id ||
          right.parentPolicyId === left.id
        ) {
          continue;
        }

        const keys = new Set([
          ...Object.keys(left.effectiveRules),
          ...Object.keys(right.effectiveRules),
        ]);
        for (const key of keys) {
          if (!(key in left.effectiveRules) || !(key in right.effectiveRules)) continue;
          const leftValue = left.effectiveRules[key];
          const rightValue = right.effectiveRules[key];
          if (stableEqual(leftValue, rightValue)) continue;
          conflicts.push({
            policyType,
            key,
            leftPolicyId: left.id,
            rightPolicyId: right.id,
            leftValue,
            rightValue,
            reason: `Conflicting '${key}' at priority ${left.priority}`,
          });
        }
      }
    }
  }

  return conflicts;
}

export function evaluatePermissionRules(
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  const capability = context.capability;
  if (!capability) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No capability in evaluation context",
    };
  }
  const grant = Array.isArray(rules.grant) ? (rules.grant as string[]) : [];
  const deny = Array.isArray(rules.deny) ? (rules.deny as string[]) : [];
  if (deny.includes(capability) || deny.includes("*")) {
    return {
      decision: AdminPolicyDecisions.deny,
      policyId,
      reason: `Capability '${capability}' denied`,
      details: { capability },
    };
  }
  if (grant.includes(capability) || grant.includes("*")) {
    return {
      decision: AdminPolicyDecisions.allow,
      policyId,
      reason: `Capability '${capability}' granted`,
      details: { capability },
    };
  }
  return {
    decision: AdminPolicyDecisions.notApplicable,
    policyId,
    reason: `Capability '${capability}' not addressed`,
  };
}

export function evaluateQuotaRules(
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  const resource = context.resource;
  if (!resource) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No quota resource in evaluation context",
    };
  }
  const limits = isPlainObject(rules.limits) ? rules.limits : rules;
  const limitRaw = limits[resource];
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) ? limitRaw : null;
  if (limit == null) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: `No quota limit for '${resource}'`,
    };
  }
  const usage = typeof context.usage === "number" ? context.usage : 0;
  if (usage >= limit) {
    return {
      decision: AdminPolicyDecisions.deny,
      policyId,
      reason: `Quota exceeded for '${resource}' (${usage}/${limit})`,
      details: { resource, usage, limit },
    };
  }
  return {
    decision: AdminPolicyDecisions.allow,
    policyId,
    reason: `Quota ok for '${resource}' (${usage}/${limit})`,
    details: { resource, usage, limit, remaining: limit - usage },
  };
}

export function evaluateRetentionRules(
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  const retainDaysRaw = rules.retainDays;
  const retainDays =
    typeof retainDaysRaw === "number" && Number.isFinite(retainDaysRaw)
      ? Math.floor(retainDaysRaw)
      : null;
  if (retainDays == null) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No retainDays in retention rules",
    };
  }
  const action =
    typeof rules.action === "string"
      ? rules.action
      : AdminPolicyRetentionActions.archive;
  const age =
    typeof context.retentionAgeDays === "number" ? context.retentionAgeDays : null;
  if (age == null) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No retentionAgeDays in evaluation context",
      details: { retainDays, action },
    };
  }
  if (age < retainDays) {
    return {
      decision: AdminPolicyDecisions.deny,
      policyId,
      reason: `Retention window active (${age}/${retainDays} days); action deferred`,
      details: { retainDays, action, age },
    };
  }
  if (action === AdminPolicyRetentionActions.retain) {
    return {
      decision: AdminPolicyDecisions.deny,
      policyId,
      reason: "Retention action is retain — disposal not permitted",
      details: { retainDays, action, age },
    };
  }
  return {
    decision: AdminPolicyDecisions.allow,
    policyId,
    reason: `Retention satisfied; '${action}' permitted`,
    details: { retainDays, action, age },
  };
}

export function evaluateWorkflowRules(
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  const steps = Array.isArray(rules.steps) ? (rules.steps as string[]) : [];
  const requiredApprovals =
    typeof rules.requiredApprovals === "number" ? rules.requiredApprovals : 0;
  const step = context.workflowStep;
  if (step && steps.length > 0 && !steps.includes(step)) {
    return {
      decision: AdminPolicyDecisions.deny,
      policyId,
      reason: `Workflow step '${step}' not permitted`,
      details: { step, steps },
    };
  }
  const approvals =
    typeof context.approvalCount === "number" ? context.approvalCount : 0;
  if (approvals < requiredApprovals) {
    return {
      decision: AdminPolicyDecisions.deny,
      policyId,
      reason: `Insufficient approvals (${approvals}/${requiredApprovals})`,
      details: { approvals, requiredApprovals },
    };
  }
  if (!step && requiredApprovals === 0 && steps.length === 0) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No workflow constraints to evaluate",
    };
  }
  return {
    decision: AdminPolicyDecisions.allow,
    policyId,
    reason: "Workflow constraints satisfied",
    details: { steps, requiredApprovals, approvals },
  };
}

export function evaluateFeatureRules(
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  const featureKey = context.featureKey;
  if (!featureKey) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No featureKey in evaluation context",
    };
  }
  const features = isPlainObject(rules.features) ? rules.features : rules;
  if (!(featureKey in features) && !("enabled" in features && rules.key === featureKey)) {
    if (typeof rules.key === "string" && rules.key === featureKey) {
      const enabled = rules.enabled !== false;
      return {
        decision: enabled ? AdminPolicyDecisions.allow : AdminPolicyDecisions.deny,
        policyId,
        reason: enabled
          ? `Feature '${featureKey}' enabled`
          : `Feature '${featureKey}' disabled`,
        details: { featureKey, enabled },
      };
    }
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: `Feature '${featureKey}' not addressed`,
    };
  }
  const enabled = features[featureKey] !== false && features[featureKey] !== 0;
  return {
    decision: enabled ? AdminPolicyDecisions.allow : AdminPolicyDecisions.deny,
    policyId,
    reason: enabled
      ? `Feature '${featureKey}' enabled`
      : `Feature '${featureKey}' disabled`,
    details: { featureKey, enabled },
  };
}

export function evaluateOrganizationRules(
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  const allowedStatuses = Array.isArray(rules.allowedStatuses)
    ? (rules.allowedStatuses as string[])
    : null;
  if (allowedStatuses && context.orgStatus) {
    if (!allowedStatuses.includes(context.orgStatus)) {
      return {
        decision: AdminPolicyDecisions.deny,
        policyId,
        reason: `Organization status '${context.orgStatus}' not allowed`,
        details: { orgStatus: context.orgStatus, allowedStatuses },
      };
    }
  }
  const maxChildren =
    typeof rules.maxChildren === "number" ? rules.maxChildren : null;
  if (maxChildren != null && typeof context.childCount === "number") {
    if (context.childCount >= maxChildren) {
      return {
        decision: AdminPolicyDecisions.deny,
        policyId,
        reason: `Child organization limit reached (${context.childCount}/${maxChildren})`,
        details: { childCount: context.childCount, maxChildren },
      };
    }
  }
  if (!allowedStatuses && maxChildren == null) {
    return {
      decision: AdminPolicyDecisions.notApplicable,
      policyId,
      reason: "No organization constraints to evaluate",
    };
  }
  return {
    decision: AdminPolicyDecisions.allow,
    policyId,
    reason: "Organization constraints satisfied",
    details: {
      orgStatus: context.orgStatus,
      childCount: context.childCount,
      maxChildren,
      allowedStatuses,
    },
  };
}

export function evaluateRulesForType(
  policyType: string,
  rules: PolicyRules,
  context: EvaluationContext,
  policyId: string | null,
): RuleEvaluation {
  switch (policyType) {
    case AdminPolicyTypes.permission:
      return evaluatePermissionRules(rules, context, policyId);
    case AdminPolicyTypes.quota:
      return evaluateQuotaRules(rules, context, policyId);
    case AdminPolicyTypes.retention:
      return evaluateRetentionRules(rules, context, policyId);
    case AdminPolicyTypes.workflow:
      return evaluateWorkflowRules(rules, context, policyId);
    case AdminPolicyTypes.feature:
      return evaluateFeatureRules(rules, context, policyId);
    case AdminPolicyTypes.organization:
      return evaluateOrganizationRules(rules, context, policyId);
    default:
      return {
        decision: AdminPolicyDecisions.notApplicable,
        policyId,
        reason: `Unknown policy type '${policyType}'`,
      };
  }
}

function pickDominantDecision(
  evaluations: RuleEvaluation[],
): AdminPolicyDecision {
  if (evaluations.some((e) => e.decision === AdminPolicyDecisions.deny)) {
    return AdminPolicyDecisions.deny;
  }
  if (evaluations.some((e) => e.decision === AdminPolicyDecisions.allow)) {
    return AdminPolicyDecisions.allow;
  }
  return AdminPolicyDecisions.notApplicable;
}

/** Merge effective rules by priority (higher wins on overlapping keys). */
export function mergeEffectiveRulesByPriority(
  policies: Array<PolicyDefinitionLike & { effectiveRules: PolicyRules }>,
): PolicyRules {
  const sorted = [...policies].sort((a, b) => a.priority - b.priority);
  const merged: PolicyRules = {};
  for (const policy of sorted) {
    Object.assign(merged, policy.effectiveRules);
  }
  return merged;
}

export function evaluatePolicies(input: {
  policies: PolicyDefinitionLike[];
  assignments: PolicyAssignmentLike[];
  organizationId: string | null;
  ancestorOrganizationIds: string[];
  policyType?: string | null;
  context: EvaluationContext;
  includeGlobal?: boolean;
}): PolicyEvaluationResult {
  const applicable = collectApplicablePolicies({
    policies: input.policies,
    assignments: input.assignments,
    organizationId: input.organizationId,
    ancestorOrganizationIds: input.ancestorOrganizationIds,
    policyType: input.policyType,
    includeGlobal: input.includeGlobal,
  });

  const conflicts = detectPolicyConflicts(applicable);
  if (conflicts.length > 0) {
    return {
      decision: AdminPolicyDecisions.conflict,
      policyType: input.policyType ?? null,
      matchedPolicyIds: applicable.map((p) => p.id),
      effectiveRules: mergeEffectiveRulesByPriority(applicable),
      conflicts,
      evaluations: [],
      reason: `${conflicts.length} policy conflict(s) detected`,
    };
  }

  const evaluations: RuleEvaluation[] = [];
  for (const policy of applicable) {
    evaluations.push(
      evaluateRulesForType(
        policy.policyType,
        policy.effectiveRules,
        input.context,
        policy.id,
      ),
    );
  }

  const decisive = evaluations.filter(
    (e) =>
      e.decision === AdminPolicyDecisions.allow ||
      e.decision === AdminPolicyDecisions.deny,
  );
  const decision = pickDominantDecision(decisive);

  return {
    decision,
    policyType: input.policyType ?? applicable[0]?.policyType ?? null,
    matchedPolicyIds: applicable.map((p) => p.id),
    effectiveRules: mergeEffectiveRulesByPriority(applicable),
    conflicts: [],
    evaluations,
    reason:
      decisive[0]?.reason ??
      (applicable.length === 0
        ? "No applicable policies"
        : "No decisive policy evaluation"),
  };
}

export function isKnownQuotaResource(resource: string): boolean {
  return (Object.values(TenantQuotaKeys) as string[]).includes(resource);
}
