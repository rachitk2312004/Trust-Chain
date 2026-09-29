import assert from "node:assert/strict";
import { parseBody } from "../../../lib/validate.js";
import {
  filterVisibleMessages,
  inboxCacheKey,
  isOnline,
  laterIso,
  shouldServeThreadFromCache,
  threadCacheKey,
} from "../messages.cache.js";
import {
  canDeleteForEveryone,
  canMutateOwnMessage,
  createConversationBodySchema,
  dmMemberKey,
} from "../messages.schemas.js";

export function testDirectMessagePairKey(): void {
  assert.equal(dmMemberKey("b", "a"), dmMemberKey("a", "b"));
  assert.notEqual(dmMemberKey("a", "b"), dmMemberKey("a", "c"));
}

export function testConversationValidation(): void {
  const dm = parseBody(createConversationBodySchema, {
    organizationId: "11111111-1111-1111-1111-111111111111",
    type: "dm",
    memberIds: ["22222222-2222-2222-2222-222222222222"],
  });
  assert.equal(dm.type, "dm");

  assert.throws(() =>
    parseBody(createConversationBodySchema, {
      organizationId: "11111111-1111-1111-1111-111111111111",
      type: "dm",
      memberIds: [
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
      ],
    }),
  );

  const group = parseBody(createConversationBodySchema, {
    organizationId: "11111111-1111-1111-1111-111111111111",
    type: "group",
    title: "Issuance desk",
    memberIds: ["22222222-2222-2222-2222-222222222222"],
  });
  assert.equal(group.title, "Issuance desk");

  assert.throws(() =>
    parseBody(createConversationBodySchema, {
      organizationId: "11111111-1111-1111-1111-111111111111",
      type: "group",
      memberIds: ["22222222-2222-2222-2222-222222222222"],
    }),
  );
}

export function testMessageCacheKeys(): void {
  assert.equal(
    inboxCacheKey("org", "user"),
    "msg:inbox:org:user",
  );
  assert.equal(threadCacheKey("c1"), "msg:thread:c1");
  assert.equal(shouldServeThreadFromCache({}), true);
  assert.equal(shouldServeThreadFromCache({ after: "11111111-1111-1111-1111-111111111111" }), false);
}

export function testMessageOwnershipAndPresence(): void {
  assert.equal(canMutateOwnMessage("a", "a", null), true);
  assert.equal(canMutateOwnMessage("a", "b", null), false);
  assert.equal(canMutateOwnMessage("a", "a", new Date()), false);
  assert.equal(laterIso("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"), "2026-01-02T00:00:00.000Z");
  assert.equal(isOnline(new Date().toISOString()), true);
  assert.equal(isOnline("2020-01-01T00:00:00.000Z"), false);
  assert.equal(canDeleteForEveryone("a", "a", null), true);
  assert.equal(canDeleteForEveryone("a", "b", null), false);
  assert.deepEqual(
    filterVisibleMessages([{ id: "1" }, { id: "2" }], ["2"]),
    [{ id: "1" }],
  );
}
