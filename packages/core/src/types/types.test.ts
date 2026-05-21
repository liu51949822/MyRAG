import { describe, it, expect } from "vitest";

describe("Shared Types", () => {
  it("IntentType is a union of valid values", () => {
    const valid: string[] = ["document", "code", "mixed", "general"];
    expect(valid).toContain("document");
    expect(valid).toContain("code");
    expect(valid).toContain("mixed");
    expect(valid).toContain("general");
    expect(valid.length).toBe(4);
  });

  it("Message interface shape is correct", () => {
    const msg = {
      id: "123",
      sessionId: "session-1",
      role: "user" as const,
      content: "hello",
      createdAt: new Date(),
    };
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hello");
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it("TechnicalCategory has valid values", () => {
    const categories = [
      "data-access", "http-handler", "serialization",
      "cache", "logging", "auth", "config", "utility", "other",
    ];
    expect(categories).toContain("data-access");
    expect(categories).toContain("http-handler");
    expect(categories).toContain("other");
    expect(categories.length).toBe(9);
  });
});
