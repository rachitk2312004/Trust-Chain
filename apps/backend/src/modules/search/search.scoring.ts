import { SearchDefaults } from "@trustchain/config";

export type SearchableDocument = {
  entityType: string;
  entityId: string;
  organizationId: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  keywords: string;
  exactKeys: string;
  createdAtRef: string | Date;
};

export type ScoredHit = SearchableDocument & {
  score: number;
  matchKind: "exact" | "keyword" | "prefix" | "fuzzy" | "none";
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[\s,;|/]+/)
    .filter(Boolean);
}

/** Levenshtein distance capped for fuzzy matching. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length]!;
}

export function scoreExactMatch(query: string, doc: SearchableDocument): number {
  const q = normalize(query);
  if (!q) return 0;
  const keys = tokens(doc.exactKeys);
  if (keys.includes(q)) return 100;
  if (normalize(doc.entityId) === q) return 100;
  if (normalize(doc.title) === q) return 95;
  return 0;
}

export function scoreKeywordMatch(query: string, doc: SearchableDocument): number {
  const q = normalize(query);
  if (!q) return 0;
  const hay = normalize(`${doc.title} ${doc.subtitle ?? ""} ${doc.keywords}`);
  if (hay === q) return 90;
  if (hay.includes(q)) {
    const positionBoost = hay.startsWith(q) ? 10 : 0;
    return 70 + positionBoost;
  }
  const qTokens = tokens(q);
  if (qTokens.length === 0) return 0;
  const hayTokens = new Set(tokens(hay));
  const hitCount = qTokens.filter((t) => hayTokens.has(t)).length;
  if (hitCount === 0) return 0;
  return Math.round((hitCount / qTokens.length) * 60);
}

export function scorePrefixMatch(query: string, doc: SearchableDocument): number {
  const q = normalize(query);
  if (q.length < 2) return 0;
  const fields = [doc.title, doc.subtitle ?? "", ...tokens(doc.exactKeys), ...tokens(doc.keywords)];
  for (const field of fields) {
    const n = normalize(field);
    if (n.startsWith(q)) return 65;
    if (tokens(n).some((t) => t.startsWith(q))) return 55;
  }
  return 0;
}

export function scoreFuzzyMatch(
  query: string,
  doc: SearchableDocument,
  maxDistance: number = SearchDefaults.fuzzyMaxDistance,
): number {
  const q = normalize(query);
  if (q.length < 3) return 0;
  const candidates = [
    normalize(doc.title),
    ...tokens(doc.title),
    ...tokens(doc.keywords),
    ...tokens(doc.exactKeys),
  ].filter((c) => Math.abs(c.length - q.length) <= maxDistance + 1);

  let best = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = editDistance(q, c);
    if (d < best) best = d;
    if (best === 0) break;
  }
  if (!Number.isFinite(best) || best > maxDistance) return 0;
  return Math.max(20, 50 - best * 12);
}

export function scoreDocument(
  query: string,
  doc: SearchableDocument,
  options?: { fuzzyMaxDistance?: number },
): ScoredHit {
  const exact = scoreExactMatch(query, doc);
  if (exact > 0) return { ...doc, score: exact, matchKind: "exact" };

  const keyword = scoreKeywordMatch(query, doc);
  const prefix = scorePrefixMatch(query, doc);
  const fuzzy = scoreFuzzyMatch(query, doc, options?.fuzzyMaxDistance);

  const best = Math.max(keyword, prefix, fuzzy);
  const matchKind =
    best === 0
      ? "none"
      : best === keyword && keyword >= prefix && keyword >= fuzzy
        ? "keyword"
        : best === prefix && prefix >= fuzzy
          ? "prefix"
          : fuzzy > 0
            ? "fuzzy"
            : "keyword";

  return { ...doc, score: best, matchKind };
}

export function rankSearchResults(
  docs: SearchableDocument[],
  query: string,
  options?: { fuzzyMaxDistance?: number; requireMatch?: boolean },
): ScoredHit[] {
  const q = query.trim();
  const scored = docs.map((doc) =>
    q ? scoreDocument(q, doc, options) : { ...doc, score: 0, matchKind: "none" as const },
  );
  const filtered =
    q && options?.requireMatch !== false
      ? scored.filter((hit) => hit.score > 0)
      : scored;

  return filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = new Date(a.createdAtRef).getTime();
    const bTime = new Date(b.createdAtRef).getTime();
    return bTime - aTime;
  });
}

export function paginateResults<T>(
  items: T[],
  limit: number,
  offset: number,
): { items: T[]; total: number; limit: number; offset: number } {
  const safeLimit = Math.max(1, Math.min(SearchDefaults.maxLimit, limit));
  const safeOffset = Math.max(0, offset);
  return {
    items: items.slice(safeOffset, safeOffset + safeLimit),
    total: items.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export function buildSuggestions(
  docs: SearchableDocument[],
  query: string,
  limit: number = SearchDefaults.suggestionLimit,
): Array<{ text: string; entityType: string; entityId: string; score: number }> {
  const ranked = rankSearchResults(docs, query).slice(0, limit);
  return ranked.map((hit) => ({
    text: hit.title,
    entityType: hit.entityType,
    entityId: hit.entityId,
    score: hit.score,
  }));
}
