/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { formatLastSeen, formatMessageTime } from "./chatTime";

describe("chatTime", () => {
  it("formats a message timestamp", () => {
    expect(formatMessageTime("2026-09-09T00:30:00.000Z")).toMatch(/\d/);
  });

  it("describes last seen", () => {
    expect(formatLastSeen(new Date().toISOString(), true)).toBe("Online now");
    expect(formatLastSeen(undefined, false)).toBe("Last online unknown");
    expect(formatLastSeen(new Date(Date.now() - 3 * 60_000).toISOString(), false)).toBe(
      "Last online 3m ago",
    );
  });
});
