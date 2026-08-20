import assert from "node:assert/strict";
import { SearchEntityTypes } from "@trustchain/config";
import {
  buildIndexDocuments,
  filterIndexDocuments,
  indexCertificate,
  indexDocument,
  indexOrganization,
  indexSignature,
  indexUser,
  indexAuditEvent,
} from "../search.indexer.js";
import {
  buildSuggestions,
  editDistance,
  paginateResults,
  rankSearchResults,
  scoreDocument,
  scoreExactMatch,
  scoreFuzzyMatch,
  scoreKeywordMatch,
} from "../search.scoring.js";

const docs = [
  indexDocument({
    id: "11111111-1111-1111-1111-111111111111",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Trust Policy Handbook",
    description: "Internal compliance handbook",
    status: "active",
    publicVerifyCode: "DOC-ABC",
    createdAt: "2026-08-01T00:00:00.000Z",
  }),
  indexCertificate({
    id: "22222222-2222-2222-2222-222222222222",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    publicId: "CERT-1001",
    title: "ISO Training Certificate",
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    status: "issued",
    createdAt: "2026-08-02T00:00:00.000Z",
  }),
  indexSignature({
    id: "33333333-3333-3333-3333-333333333333",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    publicId: "SIG-9001",
    status: "active",
    algorithm: "ed25519",
    documentTitle: "Trust Policy Handbook",
    createdAt: "2026-08-03T00:00:00.000Z",
  }),
  indexUser({
    id: "44444444-4444-4444-4444-444444444444",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
  }),
  indexOrganization({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "Acme Trust",
    slug: "acme-trust",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  }),
  indexAuditEvent({
    id: "55555555-5555-5555-5555-555555555555",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    action: "developer.key.create",
    targetType: "api_key",
    targetId: "66666666-6666-6666-6666-666666666666",
    success: true,
    createdAt: "2026-08-03T12:00:00.000Z",
  }),
];

export function testIndexing(): void {
  assert.equal(docs[0]!.entityType, SearchEntityTypes.document);
  assert.ok(docs[0]!.keywords.includes("trust policy handbook"));
  assert.ok(docs[0]!.exactKeys.includes("doc-abc"));

  const built = buildIndexDocuments(SearchEntityTypes.certificate, [
    {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      publicId: "CERT-1001",
      title: "ISO Training Certificate",
      recipientName: "Ada Lovelace",
      recipientEmail: "ada@example.com",
      status: "issued",
      createdAt: "2026-08-02T00:00:00.000Z",
    },
  ]);
  assert.equal(built.length, 1);
  assert.equal(built[0]!.title, "ISO Training Certificate");
}

export function testFiltering(): void {
  const filtered = filterIndexDocuments(docs, {
    entityTypes: [SearchEntityTypes.certificate, SearchEntityTypes.user],
    status: "issued",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.entityType, SearchEntityTypes.certificate);

  const dated = filterIndexDocuments(docs, {
    from: "2026-08-02T00:00:00.000Z",
    to: "2026-08-03T23:59:59.000Z",
  });
  assert.ok(dated.every((d) => new Date(d.createdAtRef) >= new Date("2026-08-02T00:00:00.000Z")));
  assert.ok(dated.length >= 2);
}

export function testRanking(): void {
  assert.equal(editDistance("handbook", "handbook"), 0);
  assert.ok(editDistance("handbook", "handbok") <= 2);

  const exact = scoreExactMatch("CERT-1001", docs[1]!);
  assert.equal(exact, 100);

  const keyword = scoreKeywordMatch("compliance handbook", docs[0]!);
  assert.ok(keyword > 0);

  const fuzzy = scoreFuzzyMatch("handbok", docs[0]!);
  assert.ok(fuzzy > 0);

  const ranked = rankSearchResults(docs, "CERT-1001");
  assert.equal(ranked[0]!.entityType, SearchEntityTypes.certificate);
  assert.equal(ranked[0]!.matchKind, "exact");

  const policy = scoreDocument("Trust Policy Handbook", docs[0]!);
  assert.ok(policy.score >= 90);
}

export function testPagination(): void {
  const ranked = rankSearchResults(docs, "active");
  const page1 = paginateResults(ranked, 2, 0);
  assert.equal(page1.items.length, 2);
  assert.equal(page1.total, ranked.length);
  assert.equal(page1.limit, 2);
  assert.equal(page1.offset, 0);

  const page2 = paginateResults(ranked, 2, 2);
  assert.ok(page2.items.length <= 2);
  if (ranked.length > 2) {
    assert.notEqual(page1.items[0]!.entityId, page2.items[0]?.entityId);
  }
}

export function testSuggestions(): void {
  const suggestions = buildSuggestions(docs, "Ada", 5);
  assert.ok(suggestions.length >= 1);
  assert.ok(suggestions.some((s) => s.text.toLowerCase().includes("ada") || s.score > 0));
  assert.ok(suggestions.length <= 5);
}
