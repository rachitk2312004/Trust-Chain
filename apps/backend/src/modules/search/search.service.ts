import { RoleKeys, SearchEntityTypeList, SearchEntityTypes, type SearchEntityType } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  buildIndexDocuments,
  filterIndexDocuments,
} from "./search.indexer.js";
import * as repo from "./search.repository.js";
import {
  buildSuggestions,
  paginateResults,
  rankSearchResults,
  type SearchableDocument,
} from "./search.scoring.js";

async function assertSearchReader(userId: string, organizationId?: string) {
  if (!organizationId) {
    const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
    if (!ok) {
      throw new AppError(400, "VALIDATION_ERROR", "organizationId is required");
    }
    return;
  }
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization membership required");
  }
}

async function assertSearchAdmin(userId: string, organizationId?: string) {
  if (!organizationId) {
    const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
    if (!ok) {
      throw new AppError(403, "FORBIDDEN", "Super admin role required for global reindex");
    }
    return;
  }
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

function applySort(
  hits: Array<SearchableDocument & { score: number; matchKind: string }>,
  sort: string,
) {
  if (sort === "created_at_asc") {
    return [...hits].sort(
      (a, b) => new Date(a.createdAtRef).getTime() - new Date(b.createdAtRef).getTime(),
    );
  }
  if (sort === "created_at_desc") {
    return [...hits].sort(
      (a, b) => new Date(b.createdAtRef).getTime() - new Date(a.createdAtRef).getTime(),
    );
  }
  if (sort === "title_asc") {
    return [...hits].sort((a, b) => a.title.localeCompare(b.title));
  }
  return hits;
}

function toPublicHit(
  hit: SearchableDocument & { score: number; matchKind: string },
) {
  return {
    entityType: hit.entityType,
    entityId: hit.entityId,
    organizationId: hit.organizationId,
    title: hit.title,
    subtitle: hit.subtitle,
    status: hit.status,
    createdAt: new Date(hit.createdAtRef).toISOString(),
    score: hit.score,
    matchKind: hit.matchKind,
  };
}

export async function search(
  actorId: string,
  query: {
    q?: string;
    organizationId?: string;
    entityTypes?: string[];
    status?: string;
    from?: string;
    to?: string;
    sort: string;
    limit: number;
    offset: number;
  },
) {
  await assertSearchReader(actorId, query.organizationId);

  const candidates = await repo.loadSearchCandidates({
    organizationId: query.organizationId,
    entityTypes: query.entityTypes,
    status: query.status,
    from: query.from,
    to: query.to,
    // Broad candidate pull; scoring handles exact/fuzzy. When q present, also prefilter via ILIKE.
    q: query.q && query.q.length >= 3 ? query.q : undefined,
    take: 500,
  });

  // If short query, load org-scoped candidates without ILIKE so fuzzy/prefix still work.
  let docs = candidates;
  if (query.q && query.q.length < 3) {
    docs = await repo.loadSearchCandidates({
      organizationId: query.organizationId,
      entityTypes: query.entityTypes,
      status: query.status,
      from: query.from,
      to: query.to,
      take: 500,
    });
  }

  docs = filterIndexDocuments(docs, {
    entityTypes: query.entityTypes,
    status: query.status,
    organizationId: query.organizationId,
    from: query.from,
    to: query.to,
  });

  const ranked = rankSearchResults(docs, query.q ?? "", { requireMatch: Boolean(query.q) });
  const sorted = applySort(ranked, query.sort);
  const page = paginateResults(sorted, query.limit, query.offset);

  return {
    results: page.items.map(toPublicHit),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    query: {
      q: query.q ?? null,
      organizationId: query.organizationId ?? null,
      entityTypes: query.entityTypes ?? null,
      status: query.status ?? null,
      sort: query.sort,
    },
  };
}

export async function suggestions(
  actorId: string,
  query: { q: string; organizationId?: string; limit: number },
) {
  await assertSearchReader(actorId, query.organizationId);
  const docs = await repo.loadSearchCandidates({
    organizationId: query.organizationId,
    q: query.q.length >= 3 ? query.q : undefined,
    take: 200,
  });
  const scoped =
    query.q.length < 3
      ? await repo.loadSearchCandidates({
          organizationId: query.organizationId,
          take: 200,
        })
      : docs;

  return {
    suggestions: buildSuggestions(scoped, query.q, query.limit),
  };
}

export async function reindex(
  actorId: string,
  body: { organizationId?: string; entityTypes?: string[] },
) {
  await assertSearchAdmin(actorId, body.organizationId);
  const entityTypes = (body.entityTypes?.length
    ? body.entityTypes
    : SearchEntityTypeList) as SearchEntityType[];

  const job = await repo.createSearchIndexJob({
    organizationId: body.organizationId ?? null,
    entityTypes,
    triggeredById: actorId,
  });

  try {
    if (body.organizationId) {
      await repo.deleteSearchDocumentsForOrg(body.organizationId, entityTypes);
    }

    let indexedCount = 0;
    for (const entityType of entityTypes) {
      const source = await repo.loadSourceForEntityType(entityType, body.organizationId);
      const docs = buildIndexDocuments(entityType, source);
      indexedCount += await repo.upsertSearchDocuments(docs);
    }

    const finished = await repo.finishSearchIndexJob(job.id, {
      status: "completed",
      indexedCount,
    });

    return {
      job: {
        id: finished.id,
        status: finished.status,
        indexedCount: finished.indexedCount,
        entityTypes,
        organizationId: body.organizationId ?? null,
        finishedAt: finished.finishedAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    await repo.finishSearchIndexJob(job.id, {
      status: "failed",
      indexedCount: 0,
      errorMessage: error instanceof Error ? error.message : "Reindex failed",
    });
    throw error;
  }
}

export async function getStatus(actorId: string, organizationId?: string) {
  await assertSearchAdmin(actorId, organizationId);
  const status = await repo.getSearchIndexStatus(organizationId);
  return {
    organizationId: organizationId ?? null,
    entityTypes: SearchEntityTypeList,
    ...status,
  };
}

export { SearchEntityTypes };
