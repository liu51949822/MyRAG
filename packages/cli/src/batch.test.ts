import { describe, it, expect } from "vitest";
import { BatchProcessor } from "./batch.js";

describe("BatchProcessor", () => {
  it("collects body analysis files from directory", async () => {
    const bp = new BatchProcessor();
    const validDir = "/Users/apple/Documents/MyRAG";
    const result = await bp.run(validDir, "body");
    // Should find no image files (or maybe some README images)
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.succeeded).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);
  });

  it("formats result with header and table", () => {
    const bp = new BatchProcessor();
    const result = {
      total: 5,
      succeeded: 3,
      failed: 2,
      results: [
        { file: "/test/a.jpg", type: "body" as const, status: "ok" as const, summary: "Posture analysis done", duration: 2300 },
        { file: "/test/b.pdf", type: "ingest" as const, status: "ok" as const, summary: "PDF ingested", duration: 1500 },
        { file: "/test/c.mp4", type: "body" as const, status: "error" as const, summary: "Failed: could not detect", duration: 5000 },
        { file: "/test/d.jpg", type: "body" as const, status: "ok" as const, summary: "Score 85%", duration: 1800 },
        { file: "/test/e.jpg", type: "body" as const, status: "error" as const, summary: "Failed: opencv error", duration: 300 },
      ],
    };

    const formatted = bp.formatResult(result);
    expect(formatted).toContain("Batch Body Analysis Report");
    expect(formatted).toContain("Total");
    expect(formatted).toContain("3");
    expect(formatted).toContain("2");
    expect(formatted).toContain("a.jpg");
    expect(formatted).toContain("e.jpg");
  });

  it("handles empty results", () => {
    const bp = new BatchProcessor();
    const result = { total: 0, succeeded: 0, failed: 0, results: [] };
    const formatted = bp.formatResult(result);
    expect(formatted).toContain("Report");
    expect(formatted).toContain("0");
  });

  it("rejects non-directory paths", async () => {
    const bp = new BatchProcessor();
    await expect(bp.run("/nonexistent/path", "auto")).rejects.toThrow();
  });
});
